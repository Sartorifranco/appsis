/**
 * Módulo de Tickets — conectado al sistema de tickets de Bacar S.A.
 * (Express + MySQL vía proxy local en localhost:3001)
 *
 * Operaciones soportadas desde IT Ops Hub:
 *   ✅ Ver todos los tickets (lectura, con filtros)
 *   ✅ Cambiar estado inline (open → resolved, etc.)
 *   🔗 Crear/editar/eliminar: redirige al sistema original
 */

import { useState } from 'react'
import {
  RefreshCw, Tag, AlertTriangle,
  User, ChevronDown, ExternalLink, Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTickets } from '@/hooks/useTickets'
import type { Ticket, TicketEstado, TicketPrioridad, TicketCategoria } from '@/types'

// ── Constantes ────────────────────────────────────────────────────────────────

const ESTADOS: { value: TicketEstado; label: string }[] = [
  { value: 'abierto',     label: 'Abierto'      },
  { value: 'en_progreso', label: 'En progreso'  },
  { value: 'resuelto',    label: 'Resuelto'     },
  { value: 'cerrado',     label: 'Cerrado'      },
]

const PRIORIDADES: { value: TicketPrioridad; label: string }[] = [
  { value: 'baja',    label: 'Baja'    },
  { value: 'media',   label: 'Media'   },
  { value: 'alta',    label: 'Alta'    },
  { value: 'critica', label: 'Crítica' },
]

const CATEGORIAS: { value: TicketCategoria; label: string }[] = [
  { value: 'hardware', label: 'Hardware'  },
  { value: 'software', label: 'Software'  },
  { value: 'red',      label: 'Red'       },
  { value: 'accesos',  label: 'Accesos'   },
  { value: 'camaras',  label: 'Cámaras'   },
  { value: 'otro',     label: 'Otro'      },
]

// ── Badges ────────────────────────────────────────────────────────────────────

function PrioridadBadge({ prioridad }: { prioridad: TicketPrioridad }) {
  const cfg: Record<TicketPrioridad, string> = {
    baja:    'bg-slate-500/15 text-slate-400',
    media:   'bg-blue-500/15 text-blue-400',
    alta:    'bg-orange-500/15 text-orange-400',
    critica: 'bg-red-500/15 text-red-400 font-semibold',
  }
  const labels: Record<TicketPrioridad, string> = {
    baja: 'Baja', media: 'Media', alta: 'Alta', critica: '⚡ Crítica',
  }
  return (
    <span className={cn('rounded px-1.5 py-0.5 text-xs', cfg[prioridad])}>
      {labels[prioridad]}
    </span>
  )
}

// ── Fila de ticket expandible ─────────────────────────────────────────────────

function TicketRow({
  ticket, onChangeEstado,
}: {
  ticket: Ticket
  onChangeEstado: (t: Ticket, e: TicketEstado) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cerrado = ticket.estado === 'cerrado' || ticket.estado === 'resuelto'
  // Campo extra del departamento (mapeado en ticketService)
  const dept = (ticket as Ticket & { _departamento?: string })._departamento

  return (
    <>
      <tr
        className={cn('transition-colors hover:bg-muted/30 cursor-pointer', cerrado && 'opacity-60')}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Título + categoría */}
        <td className="py-3 pr-3">
          <div className="flex items-start gap-2">
            <ChevronDown className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
            <div>
              <span className="text-xs font-mono text-muted-foreground mr-1.5">#{ticket.id}</span>
              <span className="text-sm font-medium leading-snug">{ticket.titulo}</span>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  {dept ?? CATEGORIAS.find(c => c.value === ticket.categoria)?.label ?? ticket.categoria}
                </span>
                {ticket.asignadoA && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <User className="h-3 w-3" />{ticket.asignadoA}
                  </span>
                )}
              </div>
            </div>
          </div>
        </td>

        {/* Prioridad */}
        <td className="py-3 pr-3">
          <PrioridadBadge prioridad={ticket.prioridad} />
        </td>

        {/* Estado — selector inline */}
        <td className="py-3 pr-3">
          <select
            value={ticket.estado}
            onClick={e => e.stopPropagation()}
            onChange={e => onChangeEstado(ticket, e.target.value as TicketEstado)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-xs font-medium bg-transparent cursor-pointer focus:outline-none',
              ticket.estado === 'abierto'     && 'text-blue-400   border-blue-400/30',
              ticket.estado === 'en_progreso' && 'text-yellow-400 border-yellow-400/30',
              ticket.estado === 'resuelto'    && 'text-green-400  border-green-400/30',
              ticket.estado === 'cerrado'     && 'text-muted-foreground border-border',
            )}
          >
            {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </td>

        {/* Fecha */}
        <td className="py-3 pr-3 text-xs text-muted-foreground whitespace-nowrap">
          {new Date(ticket.creadoEn).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
        </td>
      </tr>

      {/* Fila expandida */}
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={4} className="pb-3 pl-8 pr-3 pt-0">
            <div className="space-y-1 text-xs text-muted-foreground">
              {ticket.descripcion
                ? <p className="text-sm">{ticket.descripcion}</p>
                : <p className="italic">Sin descripción adicional.</p>
              }
              <div className="flex flex-wrap gap-4 pt-1">
                {ticket.reportadoPor && <span>Reportado por: <strong className="text-foreground">{ticket.reportadoPor}</strong></span>}
                {ticket.resueltoEn   && <span>Resuelto: <strong className="text-foreground">{new Date(ticket.resueltoEn).toLocaleDateString('es-AR')}</strong></span>}
                <span>Actualizado: <strong className="text-foreground">{new Date(ticket.actualizadoEn).toLocaleDateString('es-AR')}</strong></span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

export function TicketsPage() {
  const { tickets, stats, loading, error, refresh, changeEstado } = useTickets()
  const [search, setSearch]           = useState('')
  const [filterEstado, setFilterEstado] = useState<TicketEstado | 'todos'>('todos')
  const [filterPrio,   setFilterPrio]   = useState<TicketPrioridad | 'todas'>('todas')

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      t.titulo.toLowerCase().includes(q) ||
      (t.asignadoA ?? '').toLowerCase().includes(q) ||
      (t.reportadoPor ?? '').toLowerCase().includes(q) ||
      (t.descripcion ?? '').toLowerCase().includes(q) ||
      String(t.id).includes(q)
    const matchEstado = filterEstado === 'todos' || t.estado === filterEstado
    const matchPrio   = filterPrio   === 'todas' || t.prioridad === filterPrio
    return matchSearch && matchEstado && matchPrio
  })

  async function handleChangeEstado(t: Ticket, estado: TicketEstado) {
    try { await changeEstado(t.id, estado) }
    catch (e) { alert('Error al cambiar el estado: ' + (e instanceof Error ? e.message : String(e))) }
  }

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Sistema de Tickets</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {stats.activos} activo{stats.activos !== 1 ? 's' : ''} · {stats.criticos > 0 && `${stats.criticos} crítico${stats.criticos !== 1 ? 's' : ''} · `}{stats.hoy} creado{stats.hoy !== 1 ? 's' : ''} hoy
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} title="Actualizar">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <a
            href="http://bacarsa.dyndns.org:8001"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button size="sm" className="gap-1.5">
              <ExternalLink className="h-4 w-4" />
              Abrir sistema
            </Button>
          </a>
        </div>
      </div>

      {/* Banner informativo */}
      <div className="flex items-start gap-2.5 rounded-md border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-sm text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Datos en tiempo real del sistema de tickets de Bacar S.A. (MySQL).
          Desde aquí podés <strong>cambiar el estado</strong> de cualquier ticket.
          Para crear, editar o eliminar tickets usá el sistema original.
        </span>
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.porEstado.map(s => (
          <Card key={s.estado} className="py-0">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-bold">{s.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Tickets
              {stats.criticos > 0 && (
                <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                  {stats.criticos} crítico{stats.criticos !== 1 ? 's' : ''}
                </span>
              )}
              <span className="text-xs font-normal text-muted-foreground">
                ({filtered.length}{filtered.length !== tickets.length ? ` de ${tickets.length}` : ''})
              </span>
            </CardTitle>
            <div className="flex flex-wrap gap-2">
              <input
                className="w-44 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Buscar por #ID, título…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={filterEstado}
                onChange={e => setFilterEstado(e.target.value as TicketEstado | 'todos')}
              >
                <option value="todos">Todos los estados</option>
                {ESTADOS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={filterPrio}
                onChange={e => setFilterPrio(e.target.value as TicketPrioridad | 'todas')}
              >
                <option value="todas">Todas las prioridades</option>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Conectando con el sistema de tickets…
            </p>
          )}
          {error && (
            <div className="rounded-md border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400 space-y-1">
              <p className="font-medium">No se pudo conectar con el sistema de tickets</p>
              <p className="text-xs opacity-80">{error}</p>
              <p className="text-xs opacity-60 pt-1">
                Verificá que el proxy local esté corriendo (<code>cd server &amp;&amp; npm start</code>)
                y que <code>TICKETS_API_URL</code>, <code>TICKETS_ADMIN_EMAIL</code> y <code>TICKETS_ADMIN_PASS</code> estén configurados en <code>.env</code>.
              </p>
            </div>
          )}
          {!loading && !error && (
            filtered.length === 0
              ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tickets.length === 0
                    ? 'No se encontraron tickets.'
                    : 'Sin tickets que coincidan con los filtros.'}
                </p>
              )
              : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th className="pb-2 text-left font-medium">Título / Departamento</th>
                      <th className="pb-2 text-left font-medium">Prioridad</th>
                      <th className="pb-2 text-left font-medium">Estado</th>
                      <th className="pb-2 text-left font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map(t => (
                      <TicketRow
                        key={t.id}
                        ticket={t}
                        onChangeEstado={handleChangeEstado}
                      />
                    ))}
                  </tbody>
                </table>
              )
          )}
        </CardContent>
      </Card>
    </div>
  )
}
