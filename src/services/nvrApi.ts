import type { NvrChannel, NvrHdd, NvrInfo, NvrStatus } from '@/types'

const BASE = '/api/nvr'

function channelStatus(ch: {
  online: boolean
  recording: boolean
  motionReady?: boolean
}): NvrChannel['status'] {
  if (!ch.online)     return 'offline'
  if (ch.recording)   return 'recording'
  if (ch.motionReady) return 'motion'
  return 'online'
}

function mapChannel(raw: Record<string, unknown>): NvrChannel {
  const online      = Boolean(raw['online'])
  const bitRate     = raw['bitRate'] !== undefined ? Number(raw['bitRate']) : undefined
  const recording   = Boolean(raw['recording']) || (bitRate !== undefined && bitRate > 0)
  const motionReady = Boolean(raw['motionReady'])
  return {
    id:          Number(raw['id']),
    name:        raw['name'] ? String(raw['name']) : undefined,
    videoStatus: String(raw['videoStatus'] ?? 'unknown'),
    recordMode:  String(raw['recordMode']  ?? 'unknown'),
    recording,
    motionReady,
    online,
    bitRate,
    status:      channelStatus({ online, recording, motionReady }),
    error:       raw['error'] ? String(raw['error']) : undefined,
  }
}

function mapHdd(raw: Record<string, unknown>): NvrHdd {
  return {
    id:         String(raw['id'] ?? '1'),
    status:     String(raw['status'] ?? 'unknown'),
    capacityMB: Number(raw['capacityMB'] ?? 0),
    freeMB:     Number(raw['freeMB']     ?? 0),
  }
}

function mapNvrStatus(data: Record<string, unknown>): NvrStatus {
  if (!data['configured']) {
    return {
      nvrId:    data['nvrId']   ? Number(data['nvrId'])   : undefined,
      nvrName:  data['nvrName'] ? String(data['nvrName']) : undefined,
      configured: false,
      hdds: [], channels: [],
      error: String(data['error'] ?? 'NVR no configurado'),
    }
  }
  const rawHdds     = Array.isArray(data['hdds'])     ? (data['hdds']     as Record<string, unknown>[]) : []
  const rawChannels = Array.isArray(data['channels']) ? (data['channels'] as Record<string, unknown>[]) : []
  return {
    nvrId:        data['nvrId']   ? Number(data['nvrId'])   : undefined,
    nvrName:      data['nvrName'] ? String(data['nvrName']) : undefined,
    configured:   true,
    brand:        data['brand'] ? String(data['brand']) : undefined,
    hdds:         rawHdds.map(mapHdd),
    channels:     rawChannels.map(mapChannel),
    hddError:     data['hddError']     ? String(data['hddError'])     : null,
    channelError: data['channelError'] ? String(data['channelError']) : null,
    error:        data['error']        ? String(data['error'])        : undefined,
  }
}

/** Obtiene el estado (HDD + canales) de un NVR específico */
export async function fetchNvrStatus(nvrId: number = 1): Promise<NvrStatus> {
  const res = await fetch(`${BASE}/${nvrId}/status`, { signal: AbortSignal.timeout(12000) })
  if (!res.ok) throw new Error(`Proxy NVR ${nvrId} respondió ${res.status}`)
  return mapNvrStatus((await res.json()) as Record<string, unknown>)
}

/** Obtiene solo el estado de grabación de los canales (polling liviano) */
export async function fetchRecordingStatus(nvrId: number = 1): Promise<NvrChannel[]> {
  const res = await fetch(`${BASE}/${nvrId}/recording`, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`Proxy NVR ${nvrId} respondió ${res.status}`)
  const data = (await res.json()) as Record<string, unknown>
  const raw  = Array.isArray(data['channels']) ? (data['channels'] as Record<string, unknown>[]) : []
  return raw.map(mapChannel)
}

/** Lista todos los NVRs configurados en el proxy */
export async function fetchNvrList(): Promise<NvrInfo[]> {
  const res = await fetch('/api/nvrs', { signal: AbortSignal.timeout(5000) })
  if (!res.ok) throw new Error(`Proxy respondió ${res.status}`)
  const data = (await res.json()) as { nvrs: NvrInfo[] }
  return data.nvrs ?? []
}

/** Estado de todos los NVRs en paralelo (un solo request) */
export async function fetchAllNvrsStatus(): Promise<NvrStatus[]> {
  const res = await fetch('/api/nvr/all/status', { signal: AbortSignal.timeout(20000) })
  if (!res.ok) throw new Error(`Proxy respondió ${res.status}`)
  const data = (await res.json()) as { nvrs: Record<string, unknown>[] }
  return (data.nvrs ?? []).map(mapNvrStatus)
}

export async function checkNvrProxy(): Promise<boolean> {
  try {
    const res = await fetch('/api/nvrs', { signal: AbortSignal.timeout(4000) })
    return res.ok
  } catch { return false }
}
