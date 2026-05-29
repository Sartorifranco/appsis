import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchOmadaSummary, fetchDevicesFull,
  type OmadaDevice, type OmadaDeviceFull,
  type OmadaSiteInfo, type OmadaSummary,
} from '@/services/omadaService'

const POLL_MS = 20_000          // refresco cada 20 s
const MAX_TRAFFIC_POINTS = 25

export interface TrafficPoint {
  time:     string   // HH:MM
  download: number
  upload:   number
}

export interface OmadaState {
  devices:          OmadaDevice[]
  devicesFull:      OmadaDeviceFull[]     // con CPU, mem, radio, uplink
  topAPs:           OmadaDevice[]
  totalClients:     number
  wiredClients:     number
  wirelessClients:  number
  guestClients:     number
  online:           number
  offline:          number
  pending:          number
  healthScore:      number
  trafficHistory:   TrafficPoint[]
  currentDownload:  number
  currentUpload:    number
  siteInfo:         OmadaSiteInfo | null
  proxyOk:          boolean
  omadaUrl:         string
  loading:          boolean
  error:            string | null
  lastUpdated:      Date | null
}

const EMPTY: OmadaState = {
  devices: [], devicesFull: [], topAPs: [],
  totalClients: 0, wiredClients: 0, wirelessClients: 0, guestClients: 0,
  online: 0, offline: 0, pending: 0, healthScore: 0,
  trafficHistory: [], currentDownload: 0, currentUpload: 0,
  siteInfo: null, proxyOk: false, omadaUrl: '',
  loading: true, error: null, lastUpdated: null,
}

function summarize(s: OmadaSummary, prev: OmadaState): Partial<OmadaState> {
  const online  = s.devices.filter(d => d.status === 'online').length
  const offline = s.devices.filter(d => d.status === 'offline').length
  const pending = s.devices.filter(d =>
    ['pending', 'disconnecting', 'isolated', 'upgrading'].includes(d.status),
  ).length

  const healthScore = s.devices.length
    ? Math.round((online / s.devices.length) * 100)
    : 0

  const topAPs = [...s.devices]
    .filter(d => d.type === 'ap' || d.type === 'eapSwitch')
    .sort((a, b) => (b.clientNum ?? 0) - (a.clientNum ?? 0))
    .slice(0, 8)

  // Tráfico del sitio (preferir siteInfo si disponible)
  const wiredClients    = s.siteInfo?.lanUserNum    ?? 0
  const wirelessClients = s.siteInfo?.wlanUserNum   ?? 0
  const guestClients    = s.siteInfo?.wlanGuestNum  ?? 0
  const totalClients    = wiredClients + wirelessClients > 0
    ? wiredClients + wirelessClients
    : s.totalClients

  const now  = new Date()
  const time = now.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

  const newPoint: TrafficPoint = { time, download: s.traffic.download, upload: s.traffic.upload }
  const trafficHistory = [...prev.trafficHistory, newPoint].slice(-MAX_TRAFFIC_POINTS)

  return {
    devices: s.devices,
    topAPs,
    totalClients,
    wiredClients,
    wirelessClients,
    guestClients,
    online, offline, pending,
    healthScore,
    trafficHistory,
    currentDownload: s.traffic.download,
    currentUpload:   s.traffic.upload,
    siteInfo:        s.siteInfo,
    proxyOk:         s.proxyOk,
    omadaUrl:        s.omadaUrl,
    lastUpdated:     now,
  }
}

export function useOmada() {
  const [state, setState] = useState<OmadaState>(EMPTY)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const [summary, full] = await Promise.all([
        fetchOmadaSummary(),
        fetchDevicesFull(),
      ])
      setState(prev => ({
        ...prev,
        ...summarize(summary, prev),
        devicesFull: full,
        loading: false,
        error:   null,
      }))
    } catch (e) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: e instanceof Error ? e.message : 'Error al conectar con Omada',
      }))
    }
  }, [])

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [refresh])

  return { ...state, refresh }
}
