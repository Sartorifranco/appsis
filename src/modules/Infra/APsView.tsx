/**
 * APsView.tsx
 * Grid de Access Points con detalle de radios 2.4GHz / 5GHz,
 * CPU, memoria, clientes por banda y uptime.
 */
import { useState } from 'react'
import { Wifi, Users, Clock, Signal, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { OmadaDeviceFull, OmadaRadioInfo } from '@/services/omadaService'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatUptime(seconds?: number): string {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

function utilColor(pct: number): string {
  if (pct >= 80) return 'bg-red-400'
  if (pct >= 60) return 'bg-amber-400'
  return 'bg-emerald-400'
}

// ── Mini barra de utilización ──────────────────────────────────────────────

function UtilBar({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color ?? utilColor(value))}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

// ── Radio panel ────────────────────────────────────────────────────────────

function RadioPanel({
  band, radio, clients,
}: {
  band:    '2.4GHz' | '5GHz'
  radio:   OmadaRadioInfo | null
  clients: number
}) {
  const isFive = band === '5GHz'
  const color  = isFive ? 'text-violet-400' : 'text-sky-400'
  const bg     = isFive ? 'bg-violet-400/10 border-violet-500/20' : 'bg-sky-400/10 border-sky-500/20'

  if (!radio) {
    return (
      <div className={cn('rounded-lg border px-3 py-2 opacity-40 text-center text-[11px] text-muted-foreground', bg)}>
        {band} — no disponible
      </div>
    )
  }

  return (
    <div className={cn('rounded-lg border px-3 py-2.5 space-y-2', bg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Signal className={cn('h-3 w-3', color)} />
          <span className={cn('text-[11px] font-bold', color)}>{band}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px]">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-bold">{clients}</span>
        </div>
      </div>

      {/* Canal y ancho */}
      <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
        <div>
          <span className="text-muted-foreground">Canal </span>
          <span className="font-semibold">{radio.actualChannel.split('/')[0]?.trim() || '—'}</span>
        </div>
        <div>
          <span className="text-muted-foreground">BW </span>
          <span className="font-semibold">{radio.bandWidth}</span>
        </div>
        <div>
          <span className="text-muted-foreground">TX </span>
          <span className="font-semibold">{radio.txPower} dBm</span>
        </div>
        <div>
          <span className="text-muted-foreground">Rate </span>
          <span className="font-semibold">{radio.maxTxRate} Mbps</span>
        </div>
      </div>

      {/* Utilización */}
      <div className="space-y-1 pt-0.5">
        <UtilBar label="TX util"    value={radio.txUtil}    color={utilColor(radio.txUtil)} />
        <UtilBar label="RX util"    value={radio.rxUtil}    color={utilColor(radio.rxUtil)} />
        <UtilBar label="Interferencia" value={radio.interUtil} color={radio.interUtil > 30 ? 'bg-red-400' : 'bg-slate-400'} />
      </div>
    </div>
  )
}

// ── Card de un AP ──────────────────────────────────────────────────────────

function APCard({ device }: { device: OmadaDeviceFull }) {
  const [expanded, setExpanded] = useState(false)
  const isOn  = device.status === 'online'
  const total = device.clientNum

  return (
    <Card className={cn(
      'border-l-[3px] transition-all duration-200',
      isOn ? 'border-l-emerald-500' : 'border-l-red-500',
      !isOn && 'opacity-60',
    )}>
      <CardContent className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
            isOn ? 'bg-sky-400/15 text-sky-400' : 'bg-muted text-muted-foreground',
          )}>
            <Wifi className="h-4.5 w-4.5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{device.name}</p>
            <p className="text-[11px] text-muted-foreground truncate">{device.model}</p>
          </div>
          <div className="flex flex-col items-end gap-1 text-[11px] shrink-0">
            <span className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-medium',
              isOn
                ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                : 'bg-red-400/10 border-red-400/30 text-red-400',
            )}>
              <span className={cn('h-1.5 w-1.5 rounded-full', isOn ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
              {isOn ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Clientes totales + IP */}
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <Users className="h-3.5 w-3.5" />{total} clientes
            {device.guestNum > 0 && (
              <span className="text-muted-foreground font-normal">(+{device.guestNum} invitados)</span>
            )}
          </span>
          <span className="font-mono text-muted-foreground">{device.ip || '—'}</span>
        </div>

        {/* CPU / Mem */}
        <div className="grid grid-cols-2 gap-2">
          <UtilBar label="CPU" value={device.cpuUtil} />
          <UtilBar label="Memoria" value={device.memUtil} />
        </div>

        {/* Uptime */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="h-3 w-3" />
          Uptime: <span className="font-medium text-foreground/80">{formatUptime(device.uptime)}</span>
          {device.needUpgrade && (
            <span className="ml-auto text-amber-400 font-medium">⚑ Actualización disponible</span>
          )}
        </div>

        {/* Botón expandir radios */}
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors border-t border-border/30 pt-2 mt-1"
        >
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {expanded ? 'Ocultar radios' : 'Ver detalle radios'}
        </button>

        {/* Radios expandidas */}
        {expanded && (
          <div className="space-y-2 pt-1">
            <RadioPanel band="2.4GHz" radio={device.radio2g} clients={device.clientNum2g} />
            <RadioPanel band="5GHz"   radio={device.radio5g} clients={device.clientNum5g} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

type SortBy = 'clients' | 'name' | 'cpu'

interface APsViewProps {
  aps:     OmadaDeviceFull[]
  loading: boolean
}

export function APsView({ aps, loading }: APsViewProps) {
  const [sort,       setSort]       = useState<SortBy>('clients')
  const [expandAll,  setExpandAll]  = useState(false)

  const sorted = [...aps].sort((a, b) => {
    if (sort === 'clients') return b.clientNum - a.clientNum
    if (sort === 'cpu')     return b.cpuUtil   - a.cpuUtil
    return a.name.localeCompare(b.name)
  })

  const totalClients = aps.reduce((s, d) => s + d.clientNum, 0)
  const totalGuests  = aps.reduce((s, d) => s + d.guestNum, 0)
  const online       = aps.filter(d => d.status === 'online').length

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-48 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (aps.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No hay Access Points administrados en este sitio.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'APs Online',    value: `${online} / ${aps.length}`,  color: 'text-emerald-400' },
          { label: 'Clientes WiFi', value: totalClients,                  color: 'text-sky-400'     },
          { label: 'Invitados',     value: totalGuests,                   color: 'text-amber-400'   },
          { label: 'Con 2.4GHz',    value: aps.filter(a => a.radio2g).length, color: '' },
        ].map(s => (
          <div key={s.label} className="rounded-xl border bg-card/60 px-4 py-3">
            <p className="text-[11px] text-muted-foreground mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Controles */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
          {([
            { id: 'clients', label: 'Por clientes' },
            { id: 'cpu',     label: 'Por CPU' },
            { id: 'name',    label: 'Por nombre' },
          ] as const).map(opt => (
            <button key={opt.id} onClick={() => setSort(opt.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                sort === opt.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}>
              {opt.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setExpandAll(e => !e)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          <Wifi className="h-3.5 w-3.5" />
          {expandAll ? 'Colapsar radios' : 'Expandir radios'}
        </button>
      </div>

      {/* Grid de APs */}
      {/* Nota: expandAll controla el estado inicial de cada card a través de una key */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" key={expandAll ? 'expanded' : 'collapsed'}>
        {sorted.map(ap => (
          <APCard key={ap.mac} device={ap} />
        ))}
      </div>
    </div>
  )
}
