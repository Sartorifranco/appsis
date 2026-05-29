import { useCallback, useEffect, useState } from 'react'
import {
  RefreshCw, Camera, Wifi, WifiOff, HardDrive,
  Video, AlertTriangle, Circle, Activity,
  Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAllNvrs } from '@/hooks/useNvrStatus'
import type { NvrChannel, NvrHdd, NvrStatus } from '@/types'

// ── Ping de IPs individuales ──────────────────────────────────────────────────

const PING_TIMEOUT_MS = 5000

function getCameraIps(): string[] {
  const raw = import.meta.env.VITE_CAMERA_IPS
  if (!raw) return []
  return raw.split(',').map((s: string) => s.trim()).filter(Boolean)
}

function getCheckPort(): number {
  const p = import.meta.env.VITE_CAMERA_CHECK_PORT
  const n = Number(p)
  return Number.isFinite(n) && n > 0 ? n : 80
}

type PingStatus = 'checking' | 'online' | 'offline'

async function pingIp(ip: string, port: number): Promise<boolean> {
  const url = port === 443 ? `https://${ip}` : `http://${ip}:${port}`
  const ctl = new AbortController()
  const t   = setTimeout(() => ctl.abort(), PING_TIMEOUT_MS)
  try {
    const r = await fetch(url, { method: 'HEAD', mode: 'cors', signal: ctl.signal })
    return r.ok || r.status === 401 || r.status === 403
  } catch { return false }
  finally { clearTimeout(t) }
}

// ── Indicadores visuales ──────────────────────────────────────────────────────

function StatusDot({ status }: { status: 'recording' | 'motion' | 'online' | 'offline' | 'checking' | 'error' }) {
  const map: Record<string, string> = {
    recording: 'bg-green-500 shadow-[0_0_6px_2px_rgba(34,197,94,0.5)]',
    motion:    'bg-blue-400 shadow-[0_0_6px_2px_rgba(96,165,250,0.45)] animate-pulse',
    online:    'bg-yellow-400 shadow-[0_0_6px_2px_rgba(234,179,8,0.4)]',
    offline:   'bg-red-500',
    checking:  'bg-muted-foreground animate-pulse',
    error:     'bg-red-800',
  }
  return (
    <span
      className={cn('inline-block h-2.5 w-2.5 rounded-full shrink-0', map[status] ?? map['error'])}
      aria-label={status}
    />
  )
}

function StatusBadge({ status }: { status: NvrChannel['status'] | PingStatus }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
    recording: { label: 'Grabando',         cls: 'text-green-400 bg-green-500/10 border-green-500/30',  icon: <Video     className="h-3.5 w-3.5" /> },
    motion:    { label: 'Listo/Movimiento', cls: 'text-blue-400  bg-blue-500/10  border-blue-400/30',   icon: <Activity  className="h-3.5 w-3.5" /> },
    online:    { label: 'En línea',         cls: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30', icon: <Wifi    className="h-3.5 w-3.5" /> },
    offline:   { label: 'Offline',          cls: 'text-red-400   bg-red-500/10   border-red-500/30',    icon: <WifiOff   className="h-3.5 w-3.5" /> },
    checking:  { label: 'Verificando…',     cls: 'text-muted-foreground bg-muted/30 border-border',     icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" /> },
    error:     { label: 'Error',            cls: 'text-red-800   bg-red-900/10   border-red-800/30',    icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  }
  const c = cfg[status] ?? cfg['error']
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', c.cls)}>
      {c.icon}{c.label}
    </span>
  )
}

function RecBadge({ bitRate }: { bitRate?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-red-600 text-white animate-pulse select-none">
      <Circle className="h-1.5 w-1.5 fill-white" />
      REC
      {bitRate !== undefined && bitRate > 0 && (
        <span className="ml-0.5 font-normal normal-case tracking-normal opacity-90">
          {bitRate >= 1024 ? `${(bitRate / 1024).toFixed(1)} Mbps` : `${bitRate} kbps`}
        </span>
      )}
    </span>
  )
}

// ── HDD ───────────────────────────────────────────────────────────────────────

function HddBar({ hdd }: { hdd: NvrHdd }) {
  const usedMB = hdd.capacityMB - hdd.freeMB
  const pct    = hdd.capacityMB > 0 ? Math.round((usedMB / hdd.capacityMB) * 100) : 0
  const ok     = hdd.status === 'ok' || hdd.status === 'normal'
  const barCls = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-400' : 'bg-green-500'
  const gb     = (mb: number) => (mb / 1024).toFixed(0)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 font-medium">
          <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
          HDD {hdd.id}
          <span className={cn('ml-1 rounded px-1 text-[10px] font-semibold uppercase',
            ok ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400')}>
            {hdd.status}
          </span>
        </span>
        <span className="text-muted-foreground">
          {gb(usedMB)} GB / {gb(hdd.capacityMB)} GB ({pct}%)
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn('h-full rounded-full transition-all', barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

// ── Tabla de canales ──────────────────────────────────────────────────────────

function ChannelGrid({ channels }: { channels: NvrChannel[] }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {channels.map(ch => (
        <div
          key={ch.id}
          className={cn(
            'flex items-center justify-between rounded-md border px-3 py-2.5',
            ch.status === 'recording' ? 'border-green-500/25 bg-green-500/5'
            : ch.status === 'motion'  ? 'border-blue-400/25 bg-blue-400/5'
            : ch.status === 'online'  ? 'border-yellow-400/25 bg-yellow-400/5'
            : 'border-border bg-muted/20',
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <StatusDot status={ch.status} />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">
                {ch.name ?? `Canal ${ch.id}`}
                {ch.name && (
                  <span className="ml-1 text-xs text-muted-foreground font-normal">#{ch.id}</span>
                )}
              </p>
              {ch.error ? (
                <p className="text-xs text-red-400 truncate">{ch.error}</p>
              ) : (
                <p className="text-xs text-muted-foreground capitalize">
                  {ch.videoStatus}{ch.recordMode !== 'unknown' ? ` · ${ch.recordMode}` : ''}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 ml-2 shrink-0">
            {ch.recording ? <RecBadge bitRate={ch.bitRate} /> : <StatusBadge status={ch.status} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Card de un NVR ────────────────────────────────────────────────────────────

function NvrCard({ nvr, loading, error, onRefresh }: {
  nvr: NvrStatus | null
  loading: boolean
  error?: string | null
  onRefresh: () => void
}) {
  if (!nvr && loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground animate-pulse">Consultando NVR…</p>
        </CardContent>
      </Card>
    )
  }

  if ((error && !nvr) || (nvr && !nvr.configured && nvr.error?.includes('no encontrado'))) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6 space-y-1">
          <p className="text-sm text-red-400">⚠️ Proxy no disponible.</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!nvr) return null

  const totalRecording = nvr.channels.filter(c => c.recording).length
  const totalOnline    = nvr.channels.filter(c => c.online).length
  const totalChannels  = nvr.channels.length

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Video className="h-4 w-4" />
          {nvr.nvrName || `NVR ${nvr.nvrId}`}
          {nvr.brand && (
            <span className="text-xs font-normal text-muted-foreground capitalize">
              ({nvr.brand})
            </span>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {totalRecording}/{totalChannels} grabando · {totalOnline} online
          </span>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* HDD */}
        {nvr.hdds.length > 0 && (
          <div className="space-y-3 rounded-md border border-border bg-muted/20 p-3">
            {nvr.hdds.map(hdd => <HddBar key={hdd.id} hdd={hdd} />)}
          </div>
        )}
        {nvr.hddError && (
          <p className="text-xs text-yellow-400">⚠️ HDD: {nvr.hddError}</p>
        )}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><StatusDot status="recording" /> Grabando</span>
          <span className="flex items-center gap-1"><StatusDot status="motion" /> Listo/Movimiento</span>
          <span className="flex items-center gap-1"><StatusDot status="online" /> Online / Sin grabación</span>
          <span className="flex items-center gap-1"><StatusDot status="offline" /> Offline</span>
        </div>

        {/* Canales */}
        {nvr.channels.length > 0
          ? <ChannelGrid channels={nvr.channels} />
          : <p className="text-sm text-muted-foreground">Sin canales configurados.</p>
        }
        {nvr.channelError && (
          <p className="text-xs text-yellow-400">⚠️ Canales: {nvr.channelError}</p>
        )}
      </CardContent>
    </Card>
  )
}

// ── Sección multi-NVR con tabs ────────────────────────────────────────────────

function NvrsSection() {
  const { nvrList, statuses, loading, error, refresh } = useAllNvrs(true)
  const [activeTab, setActiveTab] = useState(0)

  // Si hay un solo NVR, no mostramos tabs
  const showTabs = nvrList.length > 1

  if (!loading && nvrList.length === 0) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
            <Video className="h-4 w-4" /> Estado NVR
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Proxy NVR no configurado o sin conexión. Completá{' '}
            <code className="rounded bg-muted px-1">NVR_1_BASE_URL</code> en tu{' '}
            <code className="rounded bg-muted px-1">.env</code> y ejecutá{' '}
            <code className="rounded bg-muted px-1">cd server && npm start</code>.
          </p>
          {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {/* Barra de resumen global */}
      {nvrList.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Server className="h-4 w-4" />
            <span>{nvrList.length} NVR{nvrList.length > 1 ? 's' : ''} configurado{nvrList.length > 1 ? 's' : ''}</span>
            {statuses.length > 0 && (
              <span className="text-xs">
                · {statuses.reduce((sum, n) => sum + n.channels.filter(c => c.recording).length, 0)} grabando en total
              </span>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            <span className="ml-1.5 text-xs">Actualizar todo</span>
          </Button>
        </div>
      )}

      {/* Tabs (solo si hay más de 1 NVR) */}
      {showTabs && (
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
          {nvrList.map((nvr, i) => {
            const st = statuses.find(s => s.nvrId === nvr.id)
            const recCount = st ? st.channels.filter(c => c.recording).length : 0
            const isActive = activeTab === i
            return (
              <button
                key={nvr.id}
                onClick={() => setActiveTab(i)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Video className="h-3.5 w-3.5 shrink-0" />
                {nvr.name}
                {st && (
                  <span className={cn(
                    'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                    recCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-muted text-muted-foreground'
                  )}>
                    {recCount}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Contenido: NVR activo (o todos si es 1 solo) */}
      {showTabs ? (
        <NvrCard
          nvr={statuses.find(s => s.nvrId === nvrList[activeTab]?.id) ?? null}
          loading={loading}
          error={error}
          onRefresh={refresh}
        />
      ) : (
        statuses.map(nvr => (
          <NvrCard
            key={nvr.nvrId}
            nvr={nvr}
            loading={loading}
            error={error}
            onRefresh={refresh}
          />
        ))
      )}
    </div>
  )
}

// ── Ping por IP ───────────────────────────────────────────────────────────────

function PingSection() {
  const ips  = getCameraIps()
  const port = getCheckPort()
  const [items, setItems] = useState<{ ip: string; status: PingStatus }[]>([])
  const [loading, setLoading] = useState(false)

  const runCheck = useCallback(async () => {
    if (!ips.length) return
    setLoading(true)
    setItems(ips.map(ip => ({ ip, status: 'checking' })))
    const results = await Promise.all(
      ips.map(async ip => ({ ip, status: (await pingIp(ip, port) ? 'online' : 'offline') as PingStatus }))
    )
    setItems(results)
    setLoading(false)
  }, [ips, port])

  useEffect(() => {
    queueMicrotask(() => {
      void runCheck()
    })
  }, [runCheck])

  if (!ips.length) return null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Camera className="h-4 w-4" />
          Ping cámaras
          <span className="text-xs font-normal text-muted-foreground">(puerto {port})</span>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={runCheck} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1.5">
          {items.map(({ ip, status }) => (
            <li key={ip} className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2">
              <span className="flex items-center gap-2">
                <StatusDot status={status} />
                <span className="font-mono text-sm">{ip}</span>
              </span>
              <StatusBadge status={status} />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────

export function CameraMonitor() {
  return (
    <div className="space-y-4">
      <NvrsSection />
      <PingSection />
    </div>
  )
}
