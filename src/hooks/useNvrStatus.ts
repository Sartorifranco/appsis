import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchNvrStatus,
  fetchRecordingStatus,
  fetchNvrList,
  fetchAllNvrsStatus,
} from '@/services/nvrApi'
import type { NvrChannel, NvrInfo, NvrStatus } from '@/types'

const FULL_POLL_MS = 30_000   // refresco completo (HDD + canales)
const REC_POLL_MS  =  5_000   // refresco solo grabación

// ── Hook para un NVR específico ───────────────────────────────────────────────

export function useNvrStatus(nvrId: number = 1, autoPoll = false) {
  const [status, setStatus]   = useState<NvrStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const fullTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recTimer  = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setStatus(await fetchNvrStatus(nvrId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar el NVR')
    } finally {
      setLoading(false)
    }
  }, [nvrId])

  const refreshRecording = useCallback(async () => {
    try {
      const channels = await fetchRecordingStatus(nvrId)
      setStatus(prev =>
        prev ? {
          ...prev,
          channels: prev.channels.map(ch => {
            const live = channels.find(c => c.id === ch.id)
            return live ? { ...ch, ...live } : ch
          }),
        } : prev
      )
    } catch { /* silencioso */ }
  }, [nvrId])

  useEffect(() => {
    refresh()
    if (autoPoll) {
      fullTimer.current = setInterval(refresh, FULL_POLL_MS)
      recTimer.current  = setInterval(refreshRecording, REC_POLL_MS)
    }
    return () => {
      if (fullTimer.current) clearInterval(fullTimer.current)
      if (recTimer.current)  clearInterval(recTimer.current)
    }
  }, [refresh, refreshRecording, autoPoll])

  return { status, loading, error, refresh }
}

// ── Hook para TODOS los NVRs (lista + estado completo) ───────────────────────

export function useAllNvrs(autoPoll = false) {
  const [nvrList, setNvrList]     = useState<NvrInfo[]>([])
  const [statuses, setStatuses]   = useState<NvrStatus[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const fullTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const recTimer  = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Primero obtenemos la lista de NVRs, luego el estado completo de todos
      const [list, allStatuses] = await Promise.all([
        fetchNvrList(),
        fetchAllNvrsStatus(),
      ])
      setNvrList(list)
      setStatuses(allStatuses)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar los NVRs')
    } finally {
      setLoading(false)
    }
  }, [])

  /** Polling liviano: actualiza solo grabación de todos los NVRs */
  const refreshRecording = useCallback(async () => {
    if (nvrList.length === 0) return
    try {
      const recordings = await Promise.allSettled(
        nvrList.map(n => fetchRecordingStatus(n.id))
      )
      setStatuses(prev => prev.map((nvr, i) => {
        const r = recordings[i]
        if (r.status !== 'fulfilled') return nvr
        const channels = r.value
        return {
          ...nvr,
          channels: nvr.channels.map(ch => {
            const live = channels.find(c => c.id === ch.id)
            return live ? { ...ch, ...live } : ch
          }),
        }
      }))
    } catch { /* silencioso */ }
  }, [nvrList])

  useEffect(() => {
    refresh()
    if (autoPoll) {
      fullTimer.current = setInterval(refresh, FULL_POLL_MS)
      recTimer.current  = setInterval(refreshRecording, REC_POLL_MS)
    }
    return () => {
      if (fullTimer.current) clearInterval(fullTimer.current)
      if (recTimer.current)  clearInterval(recTimer.current)
    }
  }, [refresh, refreshRecording, autoPoll])

  return { nvrList, statuses, loading, error, refresh }
}

/** Hook liviano: solo estado de grabación de un NVR */
export function useNvrRecording(nvrId: number = 1, pollMs = REC_POLL_MS) {
  const [channels, setChannels] = useState<NvrChannel[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      setChannels(await fetchRecordingStatus(nvrId))
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al consultar grabación')
    } finally {
      setLoading(false)
    }
  }, [nvrId])

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, pollMs)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [refresh, pollMs])

  return { channels, loading, error, refresh }
}
