/**
 * SwitchView.tsx
 * Selector de switch + grilla de puertos estilo panel físico
 */
import { useEffect, useState } from 'react'
import {
  ArrowDownToLine, ArrowUpFromLine, Zap, AlertTriangle,
  RefreshCw, Server,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { fetchSwitchPorts, portSpeedLabel } from '@/services/omadaService'
import type { OmadaDeviceFull, OmadaPort } from '@/services/omadaService'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

// ── Puerto individual ──────────────────────────────────────────────────────

interface PortCellProps {
  port:     OmadaPort
  selected: boolean
  onClick:  () => void
}

function PortCell({ port, selected, onClick }: PortCellProps) {
  const { portStatus: ps } = port
  const isUp    = !port.disable && ps.linkStatus === 1
  const isDown  = port.disable || ps.linkStatus === 0
  const isSFP   = port.type === 2
  const isHigh  = ps.linkSpeed >= 4   // 2.5G+

  let color = 'bg-muted/30 border-muted/40 text-muted-foreground/40'
  if (isDown)  color = 'bg-muted/20 border-muted/30 text-muted-foreground/30'
  if (port.disable) color = 'bg-red-900/20 border-red-800/30 text-red-700/50'
  if (isUp && !isHigh)  color = 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
  if (isUp && isHigh)   color = 'bg-blue-500/15 border-blue-500/40 text-blue-400'
  if (ps.poe && isUp)   color = 'bg-amber-500/15 border-amber-500/40 text-amber-400'

  return (
    <button
      onClick={onClick}
      title={`${port.name} · ${isUp ? portSpeedLabel(ps.linkSpeed) : 'Sin conexión'}${ps.poe ? ' · PoE' : ''}`}
      className={cn(
        'relative flex flex-col items-center justify-center rounded-md border transition-all duration-150',
        'aspect-square p-1 min-w-[40px] text-[9px] font-bold',
        color,
        isSFP && 'rounded-full',
        selected && 'ring-2 ring-primary shadow-md scale-105',
        isUp && 'shadow-sm',
      )}
    >
      {/* Número de puerto */}
      <span className="tabular-nums leading-none text-[10px]">{port.port}</span>

      {/* Indicador de velocidad (solo si está up) */}
      {isUp && (
        <span className="text-[7px] leading-none opacity-80 mt-0.5">
          {portSpeedLabel(ps.linkSpeed)}
        </span>
      )}

      {/* Indicadores */}
      {ps.poe && isUp && (
        <Zap className="absolute -top-1 -right-1 h-2.5 w-2.5 text-amber-400" />
      )}
      {isSFP && (
        <span className="absolute -bottom-0.5 text-[6px] font-normal opacity-60">SFP</span>
      )}
    </button>
  )
}

// ── Panel de detalle de puerto ─────────────────────────────────────────────

function PortDetail({ port }: { port: OmadaPort }) {
  const { portStatus: ps } = port
  const isUp = !port.disable && ps.linkStatus === 1

  const rows = [
    { label: 'Puerto',       value: `${port.name} (${port.port})` },
    { label: 'Estado',       value: port.disable ? 'Deshabilitado' : isUp ? 'Activo' : 'Sin conexión' },
    { label: 'Velocidad',    value: isUp ? portSpeedLabel(ps.linkSpeed) : '—' },
    { label: 'Dúplex',       value: ps.duplex === 1 ? 'Half' : ps.duplex === 2 ? 'Full' : 'Auto' },
    { label: 'PoE',          value: port.supportPoe ? (ps.poe ? 'Activo' : 'Soportado / Inactivo') : 'No soportado' },
    { label: 'Tipo',         value: port.type === 2 ? 'SFP / Fibra' : 'Cobre (RJ45)' },
    { label: 'TX total',     value: formatBytes(ps.tx) },
    { label: 'RX total',     value: formatBytes(ps.rx) },
    { label: 'STP bloqueado',value: ps.stpDiscarding ? 'Sí' : 'No' },
  ]

  return (
    <div className="rounded-xl border bg-card/80 p-4 space-y-3">
      <p className="text-sm font-bold">{port.name}</p>

      {/* TX / RX visual */}
      {isUp && (
        <div className="flex gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <ArrowDownToLine className="h-3 w-3 text-sky-400" />
            <span className="font-mono text-sky-400">{formatBytes(ps.rx)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <ArrowUpFromLine className="h-3 w-3 text-emerald-400" />
            <span className="font-mono text-emerald-400">{formatBytes(ps.tx)}</span>
          </div>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border/30 pt-2">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between gap-2 text-xs">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="font-medium text-right">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

interface SwitchViewProps {
  switches: OmadaDeviceFull[]
  loading:  boolean
}

export function SwitchView({ switches, loading }: SwitchViewProps) {
  const [selectedSwitch, setSelectedSwitch] = useState<string>(switches[0]?.mac ?? '')
  const [ports,          setPorts]          = useState<OmadaPort[]>([])
  const [portsLoading,   setPortsLoading]   = useState(false)
  const [portsError,     setPortsError]     = useState<string | null>(null)
  const [selectedPort,   setSelectedPort]   = useState<number | null>(null)

  // Auto-seleccionar primer switch disponible
  useEffect(() => {
    if (!selectedSwitch && switches.length > 0) {
      queueMicrotask(() => setSelectedSwitch(switches[0].mac))
    }
  }, [switches, selectedSwitch])

  // Cargar puertos cuando cambia el switch seleccionado
  useEffect(() => {
    if (!selectedSwitch) return
    let cancelled = false
    void (async () => {
      setPortsLoading(true)
      setPortsError(null)
      setSelectedPort(null)
      try {
        const data = await fetchSwitchPorts(selectedSwitch)
        if (!cancelled) {
          setPorts(data)
          setPortsLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setPortsError(e instanceof Error ? e.message : 'Error al cargar puertos')
          setPortsLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selectedSwitch])

  const currentSwitch = switches.find(s => s.mac === selectedSwitch)
  const selectedPortData = ports.find(p => p.port === selectedPort)

  const portsUp   = ports.filter(p => !p.disable && p.portStatus.linkStatus === 1).length
  const portsDown = ports.length - portsUp

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse" />
        ))}
      </div>
    )
  }

  if (switches.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No hay switches administrados en este sitio.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Selector de switch */}
      <div className="flex flex-wrap items-center gap-2">
        {switches.map(sw => {
          const isOn = sw.status === 'online'
          return (
            <button
              key={sw.mac}
              onClick={() => setSelectedSwitch(sw.mac)}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm transition-all',
                selectedSwitch === sw.mac
                  ? 'bg-primary/10 border-primary/50 text-foreground shadow-sm'
                  : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-border/80',
              )}
            >
              <span className={cn('h-2 w-2 rounded-full shrink-0',
                isOn ? 'bg-emerald-400' : 'bg-red-400',
                isOn && 'animate-pulse',
              )} />
              <Server className="h-3.5 w-3.5 shrink-0" />
              <span className="font-medium truncate max-w-[160px]">{sw.name}</span>
              <span className="text-xs text-muted-foreground/60">{sw.model}</span>
            </button>
          )
        })}
      </div>

      {/* Info del switch seleccionado */}
      {currentSwitch && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'IP',          value: currentSwitch.ip || '—',      cls: 'font-mono' },
            { label: 'Firmware',    value: currentSwitch.firmwareVersion || '—', cls: '' },
            { label: 'Puertos act', value: `${portsUp} / ${ports.length}`, cls: 'text-emerald-400 font-bold' },
            { label: 'CPU / Mem',   value: `${currentSwitch.cpuUtil}% / ${currentSwitch.memUtil}%`, cls: '' },
          ].map(r => (
            <div key={r.label} className="rounded-xl border bg-card/60 px-4 py-3">
              <p className="text-[11px] text-muted-foreground mb-1">{r.label}</p>
              <p className={cn('text-sm font-semibold truncate', r.cls)}>{r.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Grilla de puertos + detalle */}
      <div className="flex gap-5">
        <Card className="flex-1">
          <CardHeader className="pb-3 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                Panel de Puertos
                <span className="text-[11px] font-normal text-muted-foreground">
                  — {portsUp} activos, {portsDown} sin conexión
                </span>
              </CardTitle>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-emerald-500/50 border border-emerald-500" /> 1G</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-blue-500/50 border border-blue-500" /> 2.5G+</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-amber-500/50 border border-amber-500" /> PoE</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted border border-muted-foreground/20" /> Off</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {portsLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span className="text-sm">Cargando puertos…</span>
              </div>
            ) : portsError ? (
              <div className="flex items-center gap-2 text-red-400 text-sm py-6">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {portsError}
              </div>
            ) : (
              <>
                {/* Panel de switch estilo físico */}
                <div className="grid gap-1.5" style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(44px, 1fr))`,
                }}>
                  {ports.map(port => (
                    <PortCell
                      key={port.port}
                      port={port}
                      selected={selectedPort === port.port}
                      onClick={() => setSelectedPort(sel => sel === port.port ? null : port.port)}
                    />
                  ))}
                </div>

                {/* Leyenda de estadísticas totales */}
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground border-t border-border/30 pt-3">
                  {[
                    { label: 'TX total',  value: formatBytes(ports.reduce((s, p) => s + p.portStatus.tx, 0)), color: 'text-emerald-400' },
                    { label: 'RX total',  value: formatBytes(ports.reduce((s, p) => s + p.portStatus.rx, 0)), color: 'text-sky-400'     },
                    { label: 'PoE ports', value: ports.filter(p => p.portStatus.poe).length.toString(),       color: 'text-amber-400'   },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-1.5">
                      <span>{s.label}:</span>
                      <span className={cn('font-semibold', s.color)}>{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Panel de detalle de puerto */}
        {selectedPortData && (
          <div className="w-56 shrink-0">
            <PortDetail port={selectedPortData} />
          </div>
        )}
      </div>
    </div>
  )
}
