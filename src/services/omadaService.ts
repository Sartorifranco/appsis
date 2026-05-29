/**
 * omadaService.ts
 * Conecta con el controlador Omada SDN a través del proxy local
 * (server/nvr-proxy.cjs → localhost:3001).
 *
 * El proxy maneja la autenticación (cookie TPLINK_SESSIONID + Csrf-Token).
 * SSL self-signed del controlador se ignora server-side.
 */

// ── Tipos ──────────────────────────────────────────────────────────────────

export type OmadaDeviceType = 'ap' | 'switch' | 'gateway' | 'eapSwitch' | 'unknown'

/** Estado del dispositivo según la API de Omada */
export type OmadaDeviceStatus =
  | 'online'        // status 1, 14 (heartbeat), 15 (online v5+)
  | 'pending'       // status 2, 10
  | 'disconnecting' // status 11
  | 'isolated'      // status 13
  | 'upgrading'     // status 6, 7, 8
  | 'offline'       // status 0, otros

export interface OmadaDevice {
  mac: string
  name: string
  model: string
  type: OmadaDeviceType
  ip: string
  status: OmadaDeviceStatus
  statusCode: number
  clientNum: number
  /** Bytes/s download acumulado */
  txRate?: number
  /** Bytes/s upload acumulado */
  rxRate?: number
  uptime?: number
  firmwareVersion?: string
}

export interface OmadaClient {
  mac: string
  hostname?: string
  ip?: string
  deviceMac?: string  // AP o switch al que está conectado
  ssid?: string
  rxRate?: number
  txRate?: number
  download?: number
  upload?: number
}

export interface OmadaSiteStat {
  download?: number
  upload?: number
  available: boolean
}

export interface OmadaSiteInfo {
  id: string
  name: string
  lanUserNum:               number   // clientes cableados activos
  wlanUserNum:              number   // clientes WiFi activos
  wlanGuestNum:             number   // clientes WiFi invitados
  lanDeviceConnectedNum:    number   // switches/APs con cable online
  wlanDeviceConnectedNum:   number   // APs online
  lanDeviceDisconnectedNum: number
  wlanDeviceDisconnectedNum: number
  region:    string
  timeZone:  string
}

export interface OmadaSummary {
  devices:      OmadaDevice[]
  totalClients: number
  traffic: { download: number; upload: number }
  proxyOk: boolean
  omadaUrl: string
  siteInfo: OmadaSiteInfo | null
}

// ── Tipos extendidos (full device + switch ports) ───────────────────────────

export type OmadaLinkSpeed = 0 | 1 | 2 | 3 | 4   // 0=down, 1=100M, 2=1G, 3=1G, 4=2.5G

export interface OmadaPortStatus {
  linkStatus:   number   // 0=down, 1=up
  linkSpeed:    OmadaLinkSpeed
  duplex:       number   // 0=auto, 1=half, 2=full
  poe:          boolean
  tx:           number   // bytes totales
  rx:           number
  stpDiscarding:boolean
}

export interface OmadaPort {
  port:       number
  name:       string
  disable:    boolean
  type:       number   // 1=copper, 2=SFP/fiber
  supportPoe: boolean
  portStatus: OmadaPortStatus
}

export interface OmadaRadioInfo {
  actualChannel: string    // "6   / 2437MHz"
  maxTxRate:     number    // Mbps
  txPower:       number    // dBm
  bandWidth:     string    // "20MHz", "80MHz"
  rdMode:        string    // "b/g/n/ax mixed"
  txUtil:        number    // %
  rxUtil:        number    // %
  interUtil:     number    // % interferencia
}

/** Dispositivo con todos los campos extendidos (CPU, mem, radios, uplink) */
export interface OmadaDeviceFull extends OmadaDevice {
  cpuUtil:      number
  memUtil:      number
  uplinkMac:    string   // MAC del dispositivo upstream ('' = sin dato)
  clientNum2g:  number
  clientNum5g:  number
  userNum:      number
  guestNum:     number
  poeSupport:   boolean
  needUpgrade:  boolean
  radio2g:      OmadaRadioInfo | null
  radio5g:      OmadaRadioInfo | null
  download:     number   // bytes totales
  upload:       number
}

// ── Mapeos ─────────────────────────────────────────────────────────────────

function mapStatus(code: number): OmadaDeviceStatus {
  // Omada v5.x status codes
  if (code === 1 || code === 14 || code === 15) return 'online'
  if (code === 2 || code === 10 || code === 3 || code === 4 || code === 5) return 'pending'
  if (code === 11) return 'disconnecting'
  if (code === 12 || code === 13) return 'isolated'
  if (code === 6 || code === 7 || code === 8 || code === 9) return 'upgrading'
  return 'offline'
}

function mapType(raw: string | number | undefined): OmadaDeviceType {
  const s = String(raw ?? '').toLowerCase()
  if (s === 'ap' || s === '2')       return 'ap'
  if (s === 'switch' || s === '1')   return 'switch'
  if (s === 'gateway' || s === '3')  return 'gateway'
  if (s === 'eapswitch')             return 'eapSwitch'
  return 'unknown'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDevice(d: Record<string, any>): OmadaDevice {
  return {
    mac:             d.mac ?? '',
    name:            d.name ?? d.mac ?? 'Desconocido',
    model:           d.model ?? d.showModel ?? '',
    type:            mapType(d.type),
    ip:              d.ip ?? '',
    statusCode:      d.status ?? 0,
    status:          mapStatus(d.status ?? 0),
    clientNum:       d.clientNum ?? ((d.radioNum2gClientNum ?? 0) + (d.radioNum5gClientNum ?? 0) + (d.radioNum6gClientNum ?? 0)),
    txRate:          d.txRate ?? d.txBytes ?? undefined,
    rxRate:          d.rxRate ?? d.rxBytes ?? undefined,
    uptime:          d.uptimeLong ?? d.uptime ?? undefined,
    firmwareVersion: d.firmwareVersion ?? d.version ?? undefined,
  }
}

// ── Fetch helper ────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`/api/omada${path}`, {
    signal: AbortSignal.timeout(14_000),
  })
  const body = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) {
    throw new Error(
      String(body['error'] ?? body['msg'] ?? `Error ${res.status}`)
    )
  }
  return body as T
}

// ── API pública ─────────────────────────────────────────────────────────────

/** Verifica si el proxy puede conectarse al controlador */
export async function checkOmadaProxy(): Promise<{ ok: boolean; url?: string; error?: string }> {
  try {
    return await apiFetch<{ ok: boolean; url: string }>('/health')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

/** Lista de dispositivos del sitio (APs, Switches, Gateways) */
export async function fetchOmadaDevices(): Promise<OmadaDevice[]> {
  const res = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/devices')
  return (res.data ?? []).map(d => mapDevice(d as Record<string, unknown>))
}

/** Clientes conectados + tráfico agregado */
export async function fetchOmadaClients(): Promise<{
  clients: OmadaClient[]
  total: number
  traffic: { download: number; upload: number }
}> {
  const res = await apiFetch<{
    success: boolean
    data: OmadaClient[]
    total: number
    traffic: { download: number; upload: number }
  }>('/clients')
  return {
    clients: res.data ?? [],
    total:   res.total ?? 0,
    traffic: res.traffic ?? { download: 0, upload: 0 },
  }
}

/** Estadísticas de tráfico del sitio */
export async function fetchOmadaStat(): Promise<OmadaSiteStat> {
  const res = await apiFetch<{ success: boolean; data: Record<string, number>; available: boolean }>('/stat')
  return { ...res.data, available: res.available ?? false } as OmadaSiteStat
}

/** Datos del sitio activo (clientes cableados/WiFi, dispositivos) */
export async function fetchOmadaSiteInfo(): Promise<OmadaSiteInfo | null> {
  try {
    const res = await apiFetch<{ ok: boolean; site: OmadaSiteInfo | null }>('/site')
    return res.site
  } catch {
    return null
  }
}

/** Combina devices + clients + site info en un único resumen */
export async function fetchOmadaSummary(): Promise<OmadaSummary> {
  const [devices, clientData, health, site] = await Promise.allSettled([
    fetchOmadaDevices(),
    fetchOmadaClients(),
    checkOmadaProxy(),
    fetchOmadaSiteInfo(),
  ])

  return {
    devices:      devices.status === 'fulfilled' ? devices.value : [],
    totalClients: clientData.status === 'fulfilled' ? clientData.value.total : 0,
    traffic:      clientData.status === 'fulfilled' ? clientData.value.traffic : { download: 0, upload: 0 },
    proxyOk:      health.status === 'fulfilled' && health.value.ok,
    omadaUrl:     health.status === 'fulfilled' ? (health.value.url ?? '') : '',
    siteInfo:     site.status === 'fulfilled' ? site.value : null,
  }
}

// ── Full device / switch ports ──────────────────────────────────────────────

const SPEED_LABEL: Record<number, string> = {
  0: 'Auto',
  1: '100M',
  2: '1G',
  3: '1G',
  4: '2.5G',
  5: '5G',
  6: '10G',
}
export function portSpeedLabel(s: number): string { return SPEED_LABEL[s] ?? `${s}` }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRadio(r: Record<string, any> | undefined): OmadaRadioInfo | null {
  if (!r) return null
  return {
    actualChannel: String(r.actualChannel ?? '—').trim(),
    maxTxRate:     r.maxTxRate ?? 0,
    txPower:       r.txPower   ?? 0,
    bandWidth:     String(r.bandWidth ?? '—'),
    rdMode:        String(r.rdMode    ?? '—'),
    txUtil:        r.txUtil    ?? 0,
    rxUtil:        r.rxUtil    ?? 0,
    interUtil:     r.interUtil ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDeviceFull(d: Record<string, any>): OmadaDeviceFull {
  const base = mapDevice(d)
  return {
    ...base,
    cpuUtil:     d.cpuUtil     ?? 0,
    memUtil:     d.memUtil     ?? 0,
    uplinkMac:   d.uplink      ?? '',
    clientNum2g: d.clientNum2g ?? 0,
    clientNum5g: d.clientNum5g ?? 0,
    userNum:     d.userNum     ?? 0,
    guestNum:    d.guestNum    ?? 0,
    poeSupport:  d.poeSupport  ?? false,
    needUpgrade: d.needUpgrade ?? false,
    radio2g:     mapRadio(d.wp2g),
    radio5g:     mapRadio(d.wp5g),
    download:    d.download    ?? 0,
    upload:      d.upload      ?? 0,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPort(p: Record<string, any>): OmadaPort {
  const ps = p.portStatus ?? {}
  return {
    port:       p.port    ?? 0,
    name:       p.name    ?? `Port${p.port}`,
    disable:    p.disable ?? false,
    type:       p.type    ?? 1,
    supportPoe: p.supportPoe ?? false,
    portStatus: {
      linkStatus:    ps.linkStatus    ?? 0,
      linkSpeed:     (ps.linkSpeed    ?? 0) as OmadaLinkSpeed,
      duplex:        ps.duplex        ?? 0,
      poe:           ps.poe           ?? false,
      tx:            ps.tx            ?? 0,
      rx:            ps.rx            ?? 0,
      stpDiscarding: ps.stpDiscarding ?? false,
    },
  }
}

/** Lista de dispositivos con todos los campos extendidos */
export async function fetchDevicesFull(): Promise<OmadaDeviceFull[]> {
  const res = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>('/devices/full')
  return (res.data ?? []).map(d => mapDeviceFull(d as Record<string, unknown>))
}

/** Puertos de un switch específico */
export async function fetchSwitchPorts(mac: string): Promise<OmadaPort[]> {
  const res = await apiFetch<{ success: boolean; data: Record<string, unknown>[] }>(`/switch/${mac}/ports`)
  return (res.data ?? []).map(p => mapPort(p as Record<string, unknown>))
}
