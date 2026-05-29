import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchTickets,
  fetchDashboardMetrics,
  updateTicketStatus,
  type DashboardMetrics,
} from '@/services/ticketService'
import type { Ticket, TicketEstado } from '@/types'

const POLL_MS = 30_000  // refresco cada 30 s

// ── Estadísticas derivadas ────────────────────────────────────────────────────

export interface TicketStats {
  porEstado:  { estado: TicketEstado; count: number; label: string }[]
  topDevs:    { nombre: string; count: number }[]
  activos:    number
  cerrados:   number
  hoy:        number
  criticos:   number
  /** Métricas del dashboard admin (directo de la API) */
  dashboard:  DashboardMetrics | null
}

const ESTADO_LABELS: Record<TicketEstado, string> = {
  abierto:     'Abierto',
  en_progreso: 'En progreso',
  resuelto:    'Resuelto',
  cerrado:     'Cerrado',
}

function buildStats(tickets: Ticket[], dashboard: DashboardMetrics | null): TicketStats {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const conteos: Record<TicketEstado, number> = {
    abierto: 0, en_progreso: 0, resuelto: 0, cerrado: 0,
  }
  tickets.forEach(t => { conteos[t.estado] = (conteos[t.estado] ?? 0) + 1 })

  // TopDevs: del dashboard real si está disponible, sino lo calculamos localmente
  const topDevs: { nombre: string; count: number }[] =
    dashboard?.agentWorkload?.length
      ? dashboard.agentWorkload
          .slice(0, 5)
          .map(a => ({ nombre: a.agentName, count: Number(a.assignedTickets) }))
      : Object.entries(
          tickets
            .filter(t => t.asignadoA && (t.estado === 'abierto' || t.estado === 'en_progreso'))
            .reduce<Record<string, number>>((acc, t) => {
              acc[t.asignadoA!] = (acc[t.asignadoA!] ?? 0) + 1
              return acc
            }, {}),
        )
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nombre, count]) => ({ nombre, count }))

  const creadoHoy = tickets.filter(t => new Date(t.creadoEn) >= hoy).length

  return {
    porEstado: (['abierto', 'en_progreso', 'resuelto', 'cerrado'] as TicketEstado[]).map(e => ({
      estado: e, count: conteos[e], label: ESTADO_LABELS[e],
    })),
    topDevs,
    activos:  conteos.abierto + conteos.en_progreso,
    cerrados: conteos.resuelto + conteos.cerrado,
    hoy:      creadoHoy,
    criticos: tickets.filter(t =>
      t.prioridad === 'critica' && (t.estado === 'abierto' || t.estado === 'en_progreso')
    ).length,
    dashboard,
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export function useTickets() {
  const [tickets,   setTickets]   = useState<Ticket[]>([])
  const [dashboard, setDashboard] = useState<DashboardMetrics | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      // Cargamos tickets y métricas del dashboard en paralelo
      const [tkts, dash] = await Promise.all([
        fetchTickets(),
        fetchDashboardMetrics().catch(() => null),  // no bloquear si falla
      ])
      setTickets(tkts)
      setDashboard(dash)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al conectar con el sistema de tickets'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    timer.current = setInterval(refresh, POLL_MS)
    return () => { if (timer.current) clearInterval(timer.current) }
  }, [refresh])

  const changeEstado = useCallback(async (id: string, estado: TicketEstado) => {
    // Optimistic update
    setTickets(prev => prev.map(t => t.id === id ? { ...t, estado } : t))
    try {
      await updateTicketStatus(id, estado)
    } catch (e) {
      // Revertir si falla
      await refresh()
      throw e
    }
  }, [refresh])

  const stats = buildStats(tickets, dashboard)

  return { tickets, stats, loading, error, refresh, changeEstado }
}
