import { useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartTooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  Wifi, Server, Shield, RefreshCw, ExternalLink, AlertTriangle,
  Users, Activity, ArrowDownToLine, ArrowUpFromLine, Network,
  CheckCircle2, XCircle, Clock, WifiOff, TrendingUp,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useOmada } from '@/hooks/useOmada'
import type { OmadaDevice, OmadaDeviceStatus, OmadaDeviceType } from '@/services/omadaService'
import { TopologyView } from './TopologyView'
import { SwitchView }   from './SwitchView'
import { APsView }      from './APsView'

// ── Helpers ────────────────────────────────────────────────────────────────

function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`
}

function formatUptime(seconds?: number): string {
  if (!seconds) return '—'
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

// ── Config ─────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<OmadaDeviceStatus, {
  label: string; dot: string; badge: string; border: string; glow: string
}> = {
  online:        { label: 'Online',        dot: 'bg-emerald-400', badge: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30', border: 'border-l-emerald-500', glow: 'shadow-emerald-500/10' },
  pending:       { label: 'Pendiente',     dot: 'bg-amber-400',   badge: 'text-amber-400  bg-amber-400/10  border-amber-400/30',    border: 'border-l-amber-500',   glow: 'shadow-amber-500/10'  },
  disconnecting: { label: 'Desconectando', dot: 'bg-amber-500',   badge: 'text-amber-500  bg-amber-500/10  border-amber-500/30',    border: 'border-l-amber-600',   glow: ''                     },
  isolated:      { label: 'Aislado',       dot: 'bg-orange-400',  badge: 'text-orange-400 bg-orange-400/10 border-orange-400/30',   border: 'border-l-orange-500',  glow: ''                     },
  upgrading:     { label: 'Actualizando',  dot: 'bg-sky-400',     badge: 'text-sky-400    bg-sky-400/10    border-sky-400/30',      border: 'border-l-sky-500',     glow: 'shadow-sky-500/10'    },
  offline:       { label: 'Offline',       dot: 'bg-red-400',     badge: 'text-red-400    bg-red-400/10    border-red-400/30',      border: 'border-l-red-500',     glow: 'shadow-red-500/10'    },
}

const TYPE_CFG: Record<OmadaDeviceType, { label: string; color: string; bg: string }> = {
  ap:        { label: 'Access Point', color: 'text-sky-400',    bg: 'bg-sky-400/10'    },
  switch:    { label: 'Switch',       color: 'text-cyan-400',   bg: 'bg-cyan-400/10'   },
  gateway:   { label: 'Gateway',      color: 'text-violet-400', bg: 'bg-violet-400/10' },
  eapSwitch: { label: 'EAP Switch',   color: 'text-teal-400',   bg: 'bg-teal-400/10'   },
  unknown:   { label: 'Dispositivo',  color: 'text-slate-400',  bg: 'bg-slate-400/10'  },
}

// ── Micro-componentes ──────────────────────────────────────────────────────

function StatusBadge({ status, size = 'sm' }: { status: OmadaDeviceStatus; size?: 'xs' | 'sm' }) {
  const c = STATUS_CFG[status]
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full border font-medium',
      size === 'xs' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-0.5 text-xs',
      c.badge,
    )}>
      <span className={cn('rounded-full', size === 'xs' ? 'h-1 w-1' : 'h-1.5 w-1.5', c.dot,
        status === 'online' && 'animate-pulse')} />
      {c.label}
    </span>
  )
}

function DeviceIcon({ type, className }: { type: OmadaDeviceType; className?: string }) {
  const cls = cn('shrink-0', className)
  if (type === 'ap' || type === 'eapSwitch') return <Wifi    className={cls} />
  if (type === 'switch')                      return <Server  className={cls} />
  if (type === 'gateway')                     return <Shield  className={cls} />
  return <Network className={cls} />
}

// ── Health Ring ─────────────────────────────────────────────────────────────

function HealthRing({ score, loading }: { score: number; loading: boolean }) {
  const r = 52, circ = 2 * Math.PI * r
  const prog  = (score / 100) * circ
  const color = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444'
  return (
    <div className="relative flex items-center justify-center w-36 h-36">
      <svg width="144" height="144" className="-rotate-90" viewBox="0 0 144 144">
        <circle cx="72" cy="72" r={r} stroke="rgba(255,255,255,0.05)" strokeWidth="10" fill="none" />
        <circle cx="72" cy="72" r={r} stroke={color} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={`${loading ? 0 : prog} ${circ}`}
          style={{ transition: 'stroke-dasharray 1s ease' }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold leading-none" style={{ color }}>
          {loading ? '…' : score}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5 font-medium tracking-wide uppercase">Salud</span>
      </div>
    </div>
  )
}

// ── Traffic chart ───────────────────────────────────────────────────────────

function TrafficChart({ data }: { data: { time: string; download: number; upload: number }[] }) {
  if (data.length < 2) return (
    <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
      <Activity className="h-8 w-8 opacity-20 animate-pulse" />
      <p className="text-xs">Acumulando datos de tráfico…</p>
    </div>
  )
  return (
    <ResponsiveContainer width="100%" height={192}>
      <AreaChart data={data} margin={{ top: 8, right: 4, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="dlGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="ulGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#34d399" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#34d399" stopOpacity={0}   />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
        <XAxis dataKey="time" tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={v => formatBytes(v, 0)} tick={{ fontSize: 9, fill: '#6b7280' }} axisLine={false} tickLine={false} width={56} />
        <RechartTooltip
          contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d3f', borderRadius: 8, fontSize: 12 }}
          formatter={(v, name) => [formatBytes(Number(v ?? 0)), name === 'download' ? '↓ Descarga' : '↑ Subida']}
          labelStyle={{ color: '#9ca3af', marginBottom: 4 }}
        />
        <Area type="monotone" dataKey="download" stroke="#60a5fa" strokeWidth={2.5} fill="url(#dlGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="upload"   stroke="#34d399" strokeWidth={2.5} fill="url(#ulGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Device card (Resumen tab) ──────────────────────────────────────────────

function DeviceCard({ device }: { device: OmadaDevice }) {
  const sc = STATUS_CFG[device.status], tc = TYPE_CFG[device.type]
  const isOn = device.status === 'online'
  const isAP = device.type === 'ap' || device.type === 'eapSwitch'
  return (
    <div className={cn(
      'relative rounded-xl border bg-card/60 border-l-[3px] p-4 space-y-3',
      'transition-all duration-200 hover:bg-card hover:shadow-lg',
      sc.border, sc.glow, !isOn && 'opacity-60',
    )}>
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', tc.bg, tc.color)}>
          <DeviceIcon type={device.type} className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm truncate">{device.name}</p>
          <p className={cn('text-[11px] font-medium mt-0.5', tc.color)}>{device.model || tc.label}</p>
        </div>
      </div>
      <div className="flex items-center justify-between mb-3">
        <StatusBadge status={device.status} size="xs" />
        <span className="font-mono text-[11px] text-muted-foreground">{device.ip || '—'}</span>
      </div>
      {isAP && (
        <div>
          <div className="flex justify-between text-[11px] mb-1">
            <span className="text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" />Clientes</span>
            <span className="font-semibold text-sky-400">{device.clientNum ?? 0}</span>
          </div>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-sky-400/70 transition-all duration-700"
              style={{ width: `${Math.min(((device.clientNum ?? 0) / 50) * 100, 100)}%` }} />
          </div>
        </div>
      )}
      {device.uptime != null && (
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />Uptime</span>
          <span>{formatUptime(device.uptime)}</span>
        </div>
      )}
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-card/60 p-4 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted/40" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3 w-3/4 rounded bg-muted/40" />
          <div className="h-2.5 w-1/2 rounded bg-muted/30" />
        </div>
      </div>
      <div className="h-2 w-full rounded bg-muted/30" />
      <div className="h-2 w-4/5 rounded bg-muted/20" />
    </div>
  )
}

function NotConfigured() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 py-24 text-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/30">
        <WifiOff className="h-8 w-8 text-muted-foreground/40" />
      </div>
      <div>
        <p className="font-semibold text-lg">Controlador Omada no configurado</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm leading-relaxed">
          Completá <code className="bg-muted px-1.5 py-0.5 rounded text-xs">OMADA_URL</code>,{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">OMADA_USER</code> y{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">OMADA_PASS</code> en{' '}
          <code className="bg-muted px-1.5 py-0.5 rounded text-xs">.env</code> y reiniciá el proxy.
        </p>
      </div>
    </div>
  )
}

// ── Tab "Resumen" ─────────────────────────────────────────────────────────

type FilterType = 'all' | 'ap' | 'switch' | 'gateway'

function ResumenTab({
  devices, topAPs,
  totalClients, wiredClients, wirelessClients, guestClients,
  online, offline, pending, healthScore,
  trafficHistory, currentDownload, currentUpload,
  loading,
}: ReturnType<typeof useOmada>) {
  const [filter, setFilter] = useState<FilterType>('all')

  const counts = {
    ap:      devices.filter(d => d.type === 'ap' || d.type === 'eapSwitch').length,
    switch:  devices.filter(d => d.type === 'switch').length,
    gateway: devices.filter(d => d.type === 'gateway').length,
  }

  const filtered = filter === 'all' ? devices
    : devices.filter(d =>
        filter === 'gateway' ? d.type === 'gateway'
        : filter === 'switch' ? (d.type === 'switch' || d.type === 'eapSwitch')
        : (d.type === 'ap' || d.type === 'eapSwitch'),
      )

  const sorted = [...filtered].sort((a, b) => {
    if (a.status === 'online' && b.status !== 'online') return -1
    if (b.status === 'online' && a.status !== 'online') return 1
    return (b.clientNum ?? 0) - (a.clientNum ?? 0) || a.name.localeCompare(b.name)
  })

  const donutData = [
    { name: 'Online',  value: online,  color: '#10b981' },
    { name: 'Offline', value: offline, color: '#ef4444' },
    { name: 'Issues',  value: pending, color: '#f59e0b' },
  ].filter(d => d.value > 0)

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Card className="border-emerald-500/20 bg-emerald-500/5 py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-emerald-400/80 uppercase tracking-wide">Online</p><CheckCircle2 className="h-4 w-4 text-emerald-400/60" /></div>
            <p className="text-3xl font-bold text-emerald-400">{loading ? '…' : online}</p>
            <p className="text-xs text-muted-foreground mt-1">dispositivos activos</p>
          </CardContent>
        </Card>
        <Card className={cn('py-0', !loading && (offline + pending) > 0 ? 'border-red-500/20 bg-red-500/5' : 'border-border')}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className={cn('text-xs font-medium uppercase tracking-wide', !loading && (offline + pending) > 0 ? 'text-red-400/80' : 'text-muted-foreground')}>Problemas</p>
              <XCircle className={cn('h-4 w-4', !loading && (offline + pending) > 0 ? 'text-red-400/60' : 'text-muted-foreground/40')} />
            </div>
            <p className={cn('text-3xl font-bold', !loading && (offline + pending) > 0 ? 'text-red-400' : 'text-muted-foreground')}>{loading ? '…' : offline + pending}</p>
            <p className="text-xs text-muted-foreground mt-1">offline / alertas</p>
          </CardContent>
        </Card>
        <Card className="border-sky-500/20 bg-sky-500/5 py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-sky-400/80 uppercase tracking-wide">Clientes</p><Users className="h-4 w-4 text-sky-400/60" /></div>
            <p className="text-3xl font-bold text-sky-400">{loading ? '…' : totalClients}</p>
            <p className="text-xs text-muted-foreground mt-1">usuarios conectados</p>
          </CardContent>
        </Card>
        <Card className="border-violet-500/20 bg-violet-500/5 py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-violet-400/80 uppercase tracking-wide">WiFi</p><Wifi className="h-4 w-4 text-violet-400/60" /></div>
            <p className="text-3xl font-bold text-violet-400">{loading ? '…' : wirelessClients || '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">{guestClients > 0 ? `+${guestClients} invitados` : 'clientes inalámbricos'}</p>
          </CardContent>
        </Card>
        <Card className="border-cyan-500/20 bg-cyan-500/5 py-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2"><p className="text-xs font-medium text-cyan-400/80 uppercase tracking-wide">LAN</p><Server className="h-4 w-4 text-cyan-400/60" /></div>
            <p className="text-3xl font-bold text-cyan-400">{loading ? '…' : wiredClients || '—'}</p>
            <p className="text-xs text-muted-foreground mt-1">clientes cableados</p>
          </CardContent>
        </Card>
      </div>

      {/* Tráfico + Salud */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-0 pt-5 px-5">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Activity className="h-4 w-4 text-primary" />Tráfico de Red
                <span className="ml-1 inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><ArrowDownToLine className="h-3.5 w-3.5 text-sky-400" /><span className="font-mono font-semibold text-sky-400">{formatBytes(currentDownload)}/s</span></div>
                <div className="flex items-center gap-1.5"><ArrowUpFromLine className="h-3.5 w-3.5 text-emerald-400" /><span className="font-mono font-semibold text-emerald-400">{formatBytes(currentUpload)}/s</span></div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-4 pt-3"><TrafficChart data={trafficHistory} /></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" />Salud de la Red</CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <HealthRing score={loading ? 0 : healthScore} loading={loading} />
              <div className="flex-1 space-y-2">
                {donutData.map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full shrink-0" style={{ background: d.color }} /><span className="text-muted-foreground">{d.name}</span></div>
                    <span className="font-semibold tabular-nums">{d.value}</span>
                  </div>
                ))}
                {!loading && <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40"><span className="text-muted-foreground">Total</span><span className="font-bold">{devices.length}</span></div>}
              </div>
            </div>
            {(wiredClients > 0 || wirelessClients > 0) && (
              <div className="space-y-2 pt-1">
                <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Clientes por tipo</p>
                {[
                  { label: 'WiFi', value: wirelessClients, total: totalClients, color: 'bg-violet-400' },
                  { label: 'LAN',  value: wiredClients,    total: totalClients, color: 'bg-cyan-400'   },
                ].map(row => (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">{row.label}</span><span className="font-semibold">{row.value}</span></div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all duration-700', row.color)} style={{ width: `${row.total > 0 ? (row.value / row.total) * 100 : 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Dispositivos</p>
              {[
                { label: 'Access Points', count: counts.ap,      color: 'text-sky-400',    icon: <Wifi   className="h-3 w-3" /> },
                { label: 'Switches',      count: counts.switch,  color: 'text-cyan-400',   icon: <Server className="h-3 w-3" /> },
                { label: 'Gateways',      count: counts.gateway, color: 'text-violet-400', icon: <Shield className="h-3 w-3" /> },
              ].map(row => (
                <div key={row.label} className="flex items-center gap-2 text-xs">
                  <span className={cn('rounded p-1 bg-muted/30', row.color)}>{row.icon}</span>
                  <span className="text-muted-foreground flex-1">{row.label}</span>
                  <span className="font-bold w-5 text-right">{loading ? '…' : row.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top APs */}
      {!loading && topAPs.length > 0 && (
        <Card>
          <CardHeader className="pb-3 pt-5 px-5">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wifi className="h-4 w-4 text-sky-400" />Top Access Points
              <span className="text-xs font-normal text-muted-foreground ml-1">por clientes conectados</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-3">
              {topAPs.map((ap, i) => {
                const sc = STATUS_CFG[ap.status]
                const maxCli = Math.max(...topAPs.map(a => a.clientNum ?? 0), 1)
                return (
                  <div key={ap.mac} className="flex items-center gap-3">
                    <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                      i === 0 ? 'bg-amber-400/20 text-amber-400' : i === 1 ? 'bg-slate-400/20 text-slate-300' : i === 2 ? 'bg-orange-700/20 text-orange-500' : 'bg-muted text-muted-foreground')}>
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1 gap-2">
                        <span className="text-xs font-medium truncate">{ap.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot, ap.status === 'online' && 'animate-pulse')} />
                          <span className="text-xs font-bold text-sky-400 tabular-nums w-8 text-right">{ap.clientNum ?? 0}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-sky-400/60 transition-all duration-700"
                          style={{ width: `${((ap.clientNum ?? 0) / maxCli) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 w-20 text-right truncate hidden sm:block">{ap.model}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filtros + grid */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">Dispositivos</span>
        <div className="flex gap-1 rounded-lg border border-border/60 bg-muted/20 p-1">
          {([
            { id: 'all',     label: 'Todos',    count: devices.length },
            { id: 'ap',      label: 'APs',       count: counts.ap },
            { id: 'switch',  label: 'Switches',  count: counts.switch },
            { id: 'gateway', label: 'Gateways',  count: counts.gateway },
          ] as const).map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={cn('rounded-md px-3 py-1.5 text-xs font-medium transition-colors gap-1.5 flex items-center',
                filter === f.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              {f.label}
              <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                filter === f.id ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground')}>
                {f.count}
              </span>
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="py-14 text-center text-sm text-muted-foreground">No hay dispositivos en esta categoría.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {sorted.map(d => <DeviceCard key={d.mac} device={d} />)}
        </div>
      )}
    </div>
  )
}

// ── Componente principal con tabs ─────────────────────────────────────────

type TabId = 'resumen' | 'topologia' | 'switches' | 'aps'

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'resumen',   label: 'Resumen',    icon: <Activity className="h-4 w-4" /> },
  { id: 'topologia', label: 'Topología',  icon: <Network  className="h-4 w-4" /> },
  { id: 'switches',  label: 'Switches',   icon: <Server   className="h-4 w-4" /> },
  { id: 'aps',       label: 'Access Points', icon: <Wifi  className="h-4 w-4" /> },
]

export function NetworkDashboard() {
  const omada = useOmada()
  const {
    devicesFull, omadaUrl, siteInfo, proxyOk,
    loading, error, lastUpdated, refresh,
  } = omada

  const [tab, setTab] = useState<TabId>('resumen')

  const omadaConfigured = !!omadaUrl || proxyOk || omada.devices.length > 0

  const switches = devicesFull.filter(d => d.type === 'switch' || d.type === 'eapSwitch')
  const aps      = devicesFull.filter(d => d.type === 'ap')

  return (
    <div className="space-y-0 p-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Network className="h-5 w-5 text-primary" />
            </div>
            Infraestructura de Red
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? 'Conectando con el controlador Omada…'
              : omadaConfigured
              ? <>Omada SDN &nbsp;·&nbsp; Sitio <span className="text-foreground/80 font-medium">{siteInfo?.name ?? 'Bacar'}</span>
                  {lastUpdated && <> &nbsp;·&nbsp; actualizado {lastUpdated.toLocaleTimeString('es-AR')}</>}
                </>
              : 'Controlador no configurado'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {omadaUrl && (
            <a href={omadaUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <ExternalLink className="h-3.5 w-3.5" /> Abrir Omada
              </Button>
            </a>
          )}
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading} title="Actualizar">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </div>

      {/* Error */}
      {!loading && error && (
        <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3.5 text-sm text-red-300 mb-5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">No se pudo conectar con el controlador Omada</p>
            <p className="text-xs opacity-75 mt-1">{error}</p>
            <p className="text-xs opacity-50 mt-1">Verificá que el proxy esté corriendo (<code>cd server &amp;&amp; npm start</code>)</p>
          </div>
        </div>
      )}

      {!loading && !error && !omadaConfigured && <NotConfigured />}

      {(loading || omadaConfigured) && (
        <>
          {/* ── Tab bar ─────────────────────────────────────────────────── */}
          <div className="flex gap-1 border-b border-border/50 mb-6">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px border-b-2',
                  tab === t.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>

          {/* ── Contenido del tab activo ─────────────────────────────────── */}
          {tab === 'resumen'   && <ResumenTab {...omada} />}
          {tab === 'topologia' && <TopologyView devices={devicesFull} loading={loading} />}
          {tab === 'switches'  && <SwitchView   switches={switches}   loading={loading} />}
          {tab === 'aps'       && <APsView       aps={aps}            loading={loading} />}
        </>
      )}
    </div>
  )
}
