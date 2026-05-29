import { useNavigate } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie,
} from 'recharts'
import { Ticket, ExternalLink, User, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useTickets } from '@/hooks/useTickets'

// ── Paleta de colores por estado ──────────────────────────────────────────────

const ESTADO_COLORS: Record<string, string> = {
  Abierto:      '#60a5fa',  // blue-400
  'En progreso': '#facc15', // yellow-400
  Resuelto:     '#4ade80',  // green-400
  Cerrado:      '#6b7280',  // gray-500
}

// ── Tooltip personalizado ─────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} ticket{payload[0].value !== 1 ? 's' : ''}</p>
    </div>
  )
}

// ── Widget principal ──────────────────────────────────────────────────────────

export function TicketsWidget() {
  const { stats, loading, error } = useTickets()
  const navigate = useNavigate()

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground animate-pulse">Cargando tickets…</p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-500/20">
        <CardContent className="pt-6">
          <p className="text-sm text-red-400">⚠️ {error}</p>
        </CardContent>
      </Card>
    )
  }

  const totalTickets = stats.porEstado.reduce((s, e) => s + e.count, 0)

  return (
    <div className="space-y-4">

      {/* ── Barra: distribución por estado ─── */}
      <Card>
        <CardHeader className="pb-1">
          <CardTitle className="flex items-center justify-between text-sm font-medium">
            <span className="flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              Tickets — estado actual
              <span className="text-xs text-muted-foreground font-normal">
                ({totalTickets} total)
              </span>
            </span>
            <button
              onClick={() => navigate('/tickets')}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ver todos <ExternalLink className="h-3 w-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Métricas rápidas */}
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {stats.porEstado.map(s => (
              <div key={s.estado}
                className="rounded-md border border-border bg-muted/20 p-3 text-center">
                <p className="text-2xl font-bold">{s.count}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Gráfico de barras */}
          <ResponsiveContainer width="100%" height={160}>
            <BarChart
              data={stats.porEstado.map(s => ({ name: s.label, value: s.count }))}
              margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
              barSize={36}
            >
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {stats.porEstado.map(s => (
                  <Cell key={s.estado} fill={ESTADO_COLORS[s.label] ?? '#6b7280'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Alerta críticos */}
          {stats.criticos > 0 && (
            <div className="mt-3 flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
              <p className="text-xs text-red-300">
                <strong>{stats.criticos} ticket{stats.criticos !== 1 ? 's' : ''} crítico{stats.criticos !== 1 ? 's' : ''}</strong>
                {' '}sin resolver — revisión urgente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Pie: dev con más tickets asignados ─── */}
      {stats.topDevs.length > 0 && (
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              Tickets activos por técnico
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              {/* Pie chart */}
              <div className="shrink-0">
                <ResponsiveContainer width={180} height={160}>
                  <PieChart>
                    <Pie
                      data={stats.topDevs}
                      dataKey="count"
                      nameKey="nombre"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={70}
                      paddingAngle={3}
                    >
                      {stats.topDevs.map((_, i) => (
                        <Cell
                          key={i}
                          fill={['#60a5fa','#4ade80','#facc15','#f87171','#a78bfa'][i % 5]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v) => [`${v} ticket${Number(v) !== 1 ? 's' : ''}`]}
                      contentStyle={{ background: '#1e1e2e', border: '1px solid #333', borderRadius: 6, fontSize: 12 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Ranking lateral */}
              <div className="flex-1 space-y-2">
                {stats.topDevs.map((dev, i) => {
                  const max = stats.topDevs[0].count
                  const pct = max > 0 ? Math.round((dev.count / max) * 100) : 0
                  const colors = ['bg-blue-400','bg-green-400','bg-yellow-400','bg-red-400','bg-purple-400']
                  return (
                    <div key={dev.nombre} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn('font-medium', i === 0 && 'text-blue-400')}>
                          {i === 0 && '🏆 '}{dev.nombre}
                        </span>
                        <span className="text-muted-foreground">
                          {dev.count} ticket{dev.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full transition-all', colors[i % 5])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
