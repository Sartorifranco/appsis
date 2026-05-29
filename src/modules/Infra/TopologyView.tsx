/**
 * TopologyView.tsx
 * Árbol visual: Gateway → Switches → APs
 * Usa el campo `uplinkMac` cuando existe; si no, agrupa por tipo.
 */
import { useState } from 'react'
import { Wifi, Server, Shield, Network, ChevronRight, Users, Cpu, MemoryStick } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OmadaDeviceFull } from '@/services/omadaService'

// ── Helpers ────────────────────────────────────────────────────────────────

const TYPE_CFG = {
  gateway:   { label: 'Gateway',      color: 'text-violet-400', bg: 'bg-violet-400/15', border: 'border-violet-500/30' },
  switch:    { label: 'Switch',       color: 'text-cyan-400',   bg: 'bg-cyan-400/15',   border: 'border-cyan-500/30'   },
  eapSwitch: { label: 'EAP Switch',   color: 'text-teal-400',   bg: 'bg-teal-400/15',   border: 'border-teal-500/30'   },
  ap:        { label: 'Access Point', color: 'text-sky-400',    bg: 'bg-sky-400/15',    border: 'border-sky-500/30'    },
  unknown:   { label: 'Dispositivo',  color: 'text-slate-400',  bg: 'bg-slate-400/15',  border: 'border-slate-500/30'  },
} as const

const STATUS_DOT: Record<string, string> = {
  online:        'bg-emerald-400',
  pending:       'bg-amber-400',
  disconnecting: 'bg-amber-500',
  isolated:      'bg-orange-400',
  upgrading:     'bg-sky-400',
  offline:       'bg-red-400',
}

function DeviceIcon({ type, className }: { type: string; className?: string }) {
  const cls = cn('shrink-0', className)
  if (type === 'ap' || type === 'eapSwitch') return <Wifi    className={cls} />
  if (type === 'switch')                      return <Server  className={cls} />
  if (type === 'gateway')                     return <Shield  className={cls} />
  return <Network className={cls} />
}

// ── Nodo del árbol ─────────────────────────────────────────────────────────

interface TopoNodeProps {
  device:   OmadaDeviceFull
  children?: OmadaDeviceFull[]
  onSelect: (d: OmadaDeviceFull) => void
  selected: string | null
  depth?:   number
}

function TopoNode({ device, children = [], onSelect, selected, depth = 0 }: TopoNodeProps) {
  const [open, setOpen] = useState(true)
  const tc       = TYPE_CFG[device.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.unknown
  const isOn     = device.status === 'online'
  const isSel    = selected === device.mac
  const hasKids  = children.length > 0

  return (
    <div className={cn('relative', depth > 0 && 'ml-8 mt-2')}>
      {/* Línea conectora vertical */}
      {depth > 0 && (
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-border/40" />
      )}
      {/* Línea horizontal */}
      {depth > 0 && (
        <div className="absolute -left-4 top-5 w-4 h-px bg-border/40" />
      )}

      {/* Card del nodo */}
      <div
        onClick={() => onSelect(device)}
        className={cn(
          'relative flex items-center gap-3 rounded-xl border px-4 py-3 cursor-pointer',
          'transition-all duration-150 hover:shadow-md',
          tc.bg, tc.border,
          isSel && 'ring-2 ring-primary/60 shadow-lg',
          !isOn  && 'opacity-60',
        )}
      >
        {/* Botón colapsar */}
        {hasKids && (
          <button
            onClick={e => { e.stopPropagation(); setOpen(o => !o) }}
            className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-full bg-muted border border-border z-10"
          >
            <ChevronRight className={cn('h-2.5 w-2.5 transition-transform', open && 'rotate-90')} />
          </button>
        )}

        {/* Ícono */}
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tc.bg, tc.color)}>
          <DeviceIcon type={device.type} className="h-4.5 w-4.5" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn(
              'h-2 w-2 rounded-full shrink-0',
              STATUS_DOT[device.status] ?? 'bg-gray-400',
              isOn && 'animate-pulse',
            )} />
            <p className="font-semibold text-sm truncate">{device.name}</p>
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            {device.model || tc.label} &nbsp;·&nbsp; {device.ip || '—'}
          </p>
        </div>

        {/* Stats rápidas */}
        <div className="hidden sm:flex flex-col items-end gap-0.5 text-[11px] shrink-0">
          {device.clientNum > 0 && (
            <span className="flex items-center gap-1 text-sky-400 font-semibold">
              <Users className="h-3 w-3" />{device.clientNum}
            </span>
          )}
          <span className="flex items-center gap-1 text-muted-foreground">
            <Cpu className="h-3 w-3" />{device.cpuUtil}%
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <MemoryStick className="h-3 w-3" />{device.memUtil}%
          </span>
        </div>
      </div>

      {/* Hijos */}
      {hasKids && open && (
        <div className="relative mt-1">
          {/* Línea vertical de los hijos */}
          <div className="absolute left-4 top-0 bottom-4 w-px bg-border/40" />
          {children.map(child => (
            <TopoNode
              key={child.mac}
              device={child}
              children={[]}
              onSelect={onSelect}
              selected={selected}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Panel de detalle lateral ───────────────────────────────────────────────

function DetailPanel({ device }: { device: OmadaDeviceFull }) {
  const tc  = TYPE_CFG[device.type as keyof typeof TYPE_CFG] ?? TYPE_CFG.unknown
  const isOn = device.status === 'online'

  const formatBytes = (b: number) => {
    if (!b) return '0 B'
    const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(b) / Math.log(k))
    return `${(b / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
  }

  const rows: { label: string; value: string | number }[] = [
    { label: 'MAC',       value: device.mac },
    { label: 'IP',        value: device.ip || '—' },
    { label: 'Modelo',    value: device.model || '—' },
    { label: 'Firmware',  value: device.firmwareVersion || '—' },
    { label: 'Estado',    value: device.status },
    { label: 'Clientes',  value: device.clientNum },
    { label: 'CPU',       value: `${device.cpuUtil}%` },
    { label: 'Memoria',   value: `${device.memUtil}%` },
  ]

  if (device.type === 'ap' || device.type === 'eapSwitch') {
    if (device.clientNum2g) rows.push({ label: '2.4GHz clientes', value: device.clientNum2g })
    if (device.clientNum5g) rows.push({ label: '5GHz clientes',   value: device.clientNum5g })
    if (device.guestNum)    rows.push({ label: 'Invitados',        value: device.guestNum })
  }

  if (device.download) rows.push({ label: 'Descarga total',  value: formatBytes(device.download) })
  if (device.upload)   rows.push({ label: 'Subida total',    value: formatBytes(device.upload) })
  if (device.uplinkMac) rows.push({ label: 'Uplink MAC',     value: device.uplinkMac })
  if (device.needUpgrade) rows.push({ label: 'Actualización',  value: 'Disponible' })

  return (
    <div className={cn(
      'rounded-xl border p-5 space-y-4 sticky top-4',
      tc.bg, tc.border,
    )}>
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tc.bg, tc.color)}>
          <DeviceIcon type={device.type} className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-sm">{device.name}</p>
          <p className={cn('text-xs font-medium', tc.color)}>{tc.label}</p>
        </div>
        <div className={cn('ml-auto h-2.5 w-2.5 rounded-full', STATUS_DOT[device.status] ?? 'bg-gray-400',
          isOn && 'animate-pulse')} />
      </div>

      {/* CPU / Mem bars */}
      {[
        { label: 'CPU',     value: device.cpuUtil,  color: 'bg-amber-400' },
        { label: 'Memoria', value: device.memUtil,  color: 'bg-sky-400'   },
      ].map(bar => (
        <div key={bar.label}>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground">{bar.label}</span>
            <span className="font-semibold">{bar.value}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className={cn('h-full rounded-full transition-all duration-500', bar.color)}
              style={{ width: `${bar.value}%` }} />
          </div>
        </div>
      ))}

      {/* Info rows */}
      <div className="space-y-1.5 pt-1 border-t border-border/30">
        {rows.map(r => (
          <div key={r.label} className="flex items-start justify-between gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">{r.label}</span>
            <span className="font-medium text-right break-all">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Componente principal ───────────────────────────────────────────────────

interface TopologyViewProps {
  devices: OmadaDeviceFull[]
  loading: boolean
}

export function TopologyView({ devices, loading }: TopologyViewProps) {
  const [selected, setSelected] = useState<string | null>(null)
  const selectedDevice = devices.find(d => d.mac === selected) ?? null

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={cn('h-16 rounded-xl bg-muted/20 animate-pulse', i > 0 && 'ml-8')} />
        ))}
      </div>
    )
  }

  if (devices.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        No hay dispositivos disponibles.
      </div>
    )
  }

  // Construir árbol: gateway → switches → APs
  // Primero intentar con `uplinkMac`; si no existe, agrupar por tipo
  const byMac  = new Map(devices.map(d => [d.mac, d]))
  const roots: OmadaDeviceFull[]          = []
  const children: Map<string, OmadaDeviceFull[]> = new Map()

  // Determinar raíces (gateway primero, luego sin uplink conocido)
  const gateways = devices.filter(d => d.type === 'gateway')
  const switches = devices.filter(d => d.type === 'switch' || d.type === 'eapSwitch')
  const aps      = devices.filter(d => d.type === 'ap')
  const other    = devices.filter(d => !['gateway', 'switch', 'eapSwitch', 'ap'].includes(d.type))

  // Intentar construcción con uplinkMac
  const hasUplinkData = devices.some(d => d.uplinkMac && byMac.has(d.uplinkMac))

  if (hasUplinkData) {
    devices.forEach(d => {
      const parentMac = d.uplinkMac
      if (parentMac && byMac.has(parentMac)) {
        const arr = children.get(parentMac) ?? []
        arr.push(d)
        children.set(parentMac, arr)
      } else {
        roots.push(d)
      }
    })
  } else {
    // Agrupar por tipo: gateway → switches → APs
    gateways.forEach(gw => roots.push(gw))
    if (gateways.length > 0) {
      // Asignar switches como hijos del primer gateway
      children.set(gateways[0].mac, switches)
      // Asignar APs como hijos del primer switch (si existe)
      if (switches.length > 0) {
        children.set(switches[0].mac, aps.slice(0, Math.ceil(aps.length / 2)))
        if (switches.length > 1) children.set(switches[1].mac, aps.slice(Math.ceil(aps.length / 2)))
        else if (aps.length > 0) {
          const existing = children.get(switches[0].mac) ?? []
          children.set(switches[0].mac, [...existing, ...aps.slice(Math.ceil(aps.length / 2))])
        }
      } else {
        // No hay switches — APs directo bajo gateway
        children.set(gateways[0].mac, aps)
      }
    } else {
      // Sin gateway — mostrar switches como raíces con APs bajo ellos
      switches.forEach(sw => roots.push(sw))
      if (switches.length > 0) {
        const chunk = Math.ceil(aps.length / switches.length)
        switches.forEach((sw, i) => {
          children.set(sw.mac, aps.slice(i * chunk, (i + 1) * chunk))
        })
      }
      aps.filter(() => !switches.length).forEach(ap => roots.push(ap))
    }
    other.forEach(d => roots.push(d))
  }

  return (
    <div className="flex gap-6">
      {/* Árbol */}
      <div className="flex-1 min-w-0 space-y-2 overflow-x-auto">
        {roots.map(root => (
          <TopoNode
            key={root.mac}
            device={root}
            children={children.get(root.mac) ?? []}
            onSelect={d => setSelected(sel => sel === d.mac ? null : d.mac)}
            selected={selected}
            depth={0}
          />
        ))}
        {!hasUplinkData && (
          <p className="text-[11px] text-muted-foreground/60 pt-3 italic">
            Nota: las conexiones físicas no están disponibles en la API; la jerarquía es lógica (por tipo de dispositivo).
          </p>
        )}
      </div>

      {/* Panel de detalle */}
      {selectedDevice && (
        <div className="w-72 shrink-0">
          <DetailPanel device={selectedDevice} />
        </div>
      )}
    </div>
  )
}
