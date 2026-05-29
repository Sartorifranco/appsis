import { AlertTriangle, XCircle, Calendar, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useGastosSaaS } from '@/hooks/useGastosSaaS'

function daysUntil(dateStr: string): number {
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export function RenovacionesWidget({ alertDays = 5 }: { alertDays?: number }) {
  const { gastos, loading } = useGastosSaaS()
  const navigate = useNavigate()

  const alerts = gastos
    .filter(g => g.activo)
    .map(g => ({ ...g, days: daysUntil(g.proximaRenovacion) }))
    .filter(g => g.days <= alertDays)
    .sort((a, b) => a.days - b.days)

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground animate-pulse">Verificando renovaciones…</p>
        </CardContent>
      </Card>
    )
  }

  if (alerts.length === 0) {
    return (
      <Card className="border-green-500/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Calendar className="h-4 w-4 text-green-400" />
            Renovaciones próximas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-green-400">
            ✓ Sin vencimientos en los próximos {alertDays} días.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-orange-500/30 bg-orange-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2 text-orange-400">
            <AlertTriangle className="h-4 w-4" />
            ¡Renovaciones urgentes!
            <span className="ml-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-bold text-white">
              {alerts.length}
            </span>
          </span>
          <button
            onClick={() => navigate('/finanzas')}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Ver todos <ExternalLink className="h-3 w-3" />
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {alerts.map(g => (
          <div
            key={g.id}
            className={cn(
              'flex items-center justify-between rounded-md border px-3 py-2',
              g.days < 0
                ? 'border-red-500/30 bg-red-500/10'
                : 'border-orange-500/20 bg-orange-500/5',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {g.days < 0
                ? <XCircle       className="h-4 w-4 shrink-0 text-red-400" />
                : <AlertTriangle className="h-4 w-4 shrink-0 text-orange-400" />
              }
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{g.servicio}</p>
                <p className="text-xs text-muted-foreground capitalize">{g.categoria}</p>
              </div>
            </div>
            <div className="ml-3 shrink-0 text-right">
              <p className={cn('text-xs font-semibold',
                g.days < 0 ? 'text-red-400' : 'text-orange-400')}>
                {g.days < 0
                  ? `Venció hace ${Math.abs(g.days)}d`
                  : g.days === 0
                    ? '¡Hoy!'
                    : `En ${g.days}d`
                }
              </p>
              <p className="text-xs text-muted-foreground">{g.proximaRenovacion}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
