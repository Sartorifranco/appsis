/**
 * ticketService.ts
 * Conecta al sistema de tickets de Bacar S.A. (Express + MySQL)
 * a través del proxy local (server/nvr-proxy.cjs).
 *
 * El proxy maneja la autenticación JWT: el browser nunca ve credenciales.
 *
 * API real:  http://192.168.0.9:5040  (configurable en .env → TICKETS_API_URL)
 * Proxy:     http://localhost:3001/api/tickets-proxy/*
 */

import type { Ticket, TicketEstado, TicketPrioridad, TicketCategoria } from '@/types'

const BASE = '/api/tickets-proxy'

// ── Tipos del sistema de tickets real ────────────────────────────────────────

/** Ticket tal como lo devuelve la API de bacarsa */
interface RawTicket {
  id: number
  title: string
  description: string
  status: 'open' | 'in-progress' | 'resolved' | 'closed'
  priority: 'low' | 'medium' | 'high' | 'critical'
  category_name: string
  department_name: string
  client_name: string
  agent_name: string
  assigned_to_user_id: number | null
  created_at: string
  updated_at: string
  resolved_at?: string
}

export interface DashboardMetrics {
  totalTickets:    number
  activeTickets:   number
  totalUsers:      number
  agentWorkload:   { agentId: number; agentName: string; assignedTickets: number }[]
  departmentCounts: Record<string, number>
  recentActivity:  { id: number; username: string; action_type: string; description: string; created_at: string }[]
}

// ── Mapeos API → tipos internos ───────────────────────────────────────────────

const STATUS_MAP: Record<RawTicket['status'], TicketEstado> = {
  'open':        'abierto',
  'in-progress': 'en_progreso',
  'resolved':    'resuelto',
  'closed':      'cerrado',
}

export const STATUS_REVERSE: Record<TicketEstado, RawTicket['status']> = {
  'abierto':     'open',
  'en_progreso': 'in-progress',
  'resuelto':    'resolved',
  'cerrado':     'closed',
}

const PRIORITY_MAP: Record<string, TicketPrioridad> = {
  low:      'baja',
  medium:   'media',
  high:     'alta',
  critical: 'critica',
}

function mapTicket(r: RawTicket): Ticket {
  // category_name del sistema → TicketCategoria aproximada
  const catName = (r.category_name ?? '').toLowerCase()
  const categoria: TicketCategoria =
    catName.includes('red')      ? 'red'
    : catName.includes('acceso') ? 'accesos'
    : catName.includes('cámara') || catName.includes('camara') ? 'camaras'
    : catName.includes('hard')   ? 'hardware'
    : catName.includes('soft')   ? 'software'
    : 'otro'

  return {
    id:            String(r.id),
    titulo:        r.title,
    descripcion:   r.description,
    estado:        STATUS_MAP[r.status]   ?? 'abierto',
    prioridad:     PRIORITY_MAP[r.priority] ?? 'media',
    categoria,
    asignadoA:     r.agent_name && r.agent_name !== 'No asignado' ? r.agent_name : undefined,
    reportadoPor:  r.client_name ?? undefined,
    creadoEn:      r.created_at,
    actualizadoEn: r.updated_at,
    resueltoEn:    r.resolved_at,
    // Campos extra del sistema real (disponibles para la UI si los necesita)
    _departamento: r.department_name,
    _categoria_raw: r.category_name,
  } as Ticket & { _departamento?: string; _categoria_raw?: string }
}

// ── Fetch helper ──────────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    signal: AbortSignal.timeout(12_000),
    headers: { 'Content-Type': 'application/json', ...(opts?.headers ?? {}) },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = (body as { error?: string; message?: string }).error
      ?? (body as { message?: string }).message
      ?? `Error ${res.status}`
    throw new Error(msg)
  }
  return body as T
}

// ── API pública ───────────────────────────────────────────────────────────────

/** Métricas del dashboard admin — para los gráficos */
export async function fetchDashboardMetrics(): Promise<DashboardMetrics> {
  const data = await apiFetch<{ success: boolean; data: DashboardMetrics }>('/dashboard')
  return data.data
}

/** Lista de tickets (todos los que el usuario admin puede ver) */
export async function fetchTickets(filters?: {
  status?: RawTicket['status']
  priority?: string
  agentId?: number
}): Promise<Ticket[]> {
  const qs = new URLSearchParams()
  if (filters?.status)   qs.set('status',   filters.status)
  if (filters?.priority) qs.set('priority', filters.priority)
  if (filters?.agentId)  qs.set('agentId',  String(filters.agentId))

  const data = await apiFetch<{ success: boolean; data: RawTicket[] }>(
    `/tickets${qs.toString() ? '?' + qs : ''}`)
  return (data.data ?? []).map(mapTicket)
}

/** Actualiza el estado de un ticket */
export async function updateTicketStatus(id: string, estado: TicketEstado): Promise<void> {
  await apiFetch(`/tickets/${id}/status`, {
    method: 'PUT',
    body:   JSON.stringify({ status: STATUS_REVERSE[estado] }),
  })
}

/** Reasigna un ticket a otro agente */
export async function reassignTicket(id: string, agentId: number): Promise<void> {
  await apiFetch(`/tickets/${id}/reassign`, {
    method: 'PUT',
    body:   JSON.stringify({ new_agent_id: agentId }),
  })
}

/** Verifica si el proxy puede conectarse al sistema de tickets */
export async function checkTicketsProxy(): Promise<boolean> {
  try {
    const data = await apiFetch<{ ok: boolean }>('/health')
    return data.ok
  } catch { return false }
}

// Exportar docToTicket como no-op para compatibilidad con useTickets
export { mapTicket as docToTicket }
export const TICKET_COLLECTION = 'itops_tickets' // legacy, no usado
