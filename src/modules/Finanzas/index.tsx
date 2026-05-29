import { useState } from 'react'
import {
  DollarSign, Plus, Pencil, Trash2, AlertTriangle,
  CheckCircle2, Clock, XCircle, Tag, RefreshCw, CreditCard,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useGastosSaaS, gastoStatus, type GastoStatus } from '@/hooks/useGastosSaaS'
import type {
  GastoSaaS, MonedaGasto, CategoriaGasto, FrecuenciaGasto,
} from '@/types'

// ── Constantes de dominio ─────────────────────────────────────────────────────

const CATEGORIAS: { value: CategoriaGasto; label: string }[] = [
  { value: 'software',        label: 'Software / SaaS' },
  { value: 'dominio',         label: 'Dominio / Hosting' },
  { value: 'infraestructura', label: 'Infraestructura' },
  { value: 'seguridad',       label: 'Seguridad' },
  { value: 'comunicaciones',  label: 'Comunicaciones' },
  { value: 'otro',            label: 'Otro' },
]

const FRECUENCIAS: { value: FrecuenciaGasto; label: string }[] = [
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual',   label: 'Anual'  },
  { value: 'unico',   label: 'Pago único' },
]

const MONEDAS: MonedaGasto[] = ['ARS', 'USD', 'EUR']

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Calcula la próxima fecha de renovación según la frecuencia */
function nextRenewalDate(currentDate: string, frecuencia: FrecuenciaGasto): string {
  const d = new Date(currentDate + 'T00:00:00')
  if (frecuencia === 'mensual') {
    d.setMonth(d.getMonth() + 1)
  } else if (frecuencia === 'anual') {
    d.setFullYear(d.getFullYear() + 1)
  }
  return d.toISOString().slice(0, 10)
}

function formatMonto(monto: number, moneda: MonedaGasto): string {
  const sym = moneda === 'ARS' ? '$' : moneda === 'USD' ? 'US$' : '€'
  return `${sym} ${monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function daysUntil(dateStr: string): number {
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

// ── Status Badge ──────────────────────────────────────────────────────────────

const STATUS_CFG: Record<GastoStatus, { label: string; cls: string; icon: React.ReactNode }> = {
  expired:  { label: 'Vencido',       cls: 'bg-red-500/15 text-red-400 border-red-500/30',       icon: <XCircle      className="h-3.5 w-3.5" /> },
  critical: { label: 'Por vencer',    cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  warning:  { label: 'Próximo',       cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', icon: <Clock        className="h-3.5 w-3.5" /> },
  ok:       { label: 'Vigente',       cls: 'bg-green-500/15 text-green-400 border-green-500/30',  icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  inactive: { label: 'Inactivo',      cls: 'bg-muted/40 text-muted-foreground border-border',     icon: <XCircle      className="h-3.5 w-3.5" /> },
}

function StatusBadge({ status }: { status: GastoStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium', cfg.cls)}>
      {cfg.icon}{cfg.label}
    </span>
  )
}

function CategoriaBadge({ categoria }: { categoria: CategoriaGasto }) {
  const label = CATEGORIAS.find(c => c.value === categoria)?.label ?? categoria
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
      <Tag className="h-3 w-3" />{label}
    </span>
  )
}

// ── Formulario ────────────────────────────────────────────────────────────────

const FORM_EMPTY: Omit<GastoSaaS, 'id'> = {
  servicio: '', descripcion: '', monto: 0, moneda: 'ARS',
  proximaRenovacion: '', categoria: 'software', frecuencia: 'anual', activo: true,
}

function GastoForm({
  initial, onSave, onCancel, saving,
}: {
  initial: Omit<GastoSaaS, 'id'>
  onSave: (data: Omit<GastoSaaS, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [err, setErr]   = useState('')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.servicio.trim())         return setErr('El nombre del servicio es requerido.')
    if (!form.proximaRenovacion)       return setErr('La fecha de renovación es requerida.')
    if (form.monto < 0)                return setErr('El monto no puede ser negativo.')
    try {
      await onSave(form)
    } catch {
      setErr('No se pudo guardar. Verificá la conexión.')
    }
  }

  const inputCls = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
  const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

        {/* Nombre del servicio */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Nombre del servicio *</label>
          <input className={inputCls} placeholder="Ej: Cursor Pro, GitHub Copilot, Cloudflare…"
            value={form.servicio} onChange={e => set('servicio', e.target.value)} />
        </div>

        {/* Descripción */}
        <div className="sm:col-span-2">
          <label className={labelCls}>Descripción / notas</label>
          <input className={inputCls} placeholder="Opcional"
            value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} />
        </div>

        {/* Monto */}
        <div>
          <label className={labelCls}>Monto *</label>
          <input className={inputCls} type="number" min="0" step="0.01" placeholder="0.00"
            value={form.monto || ''} onChange={e => set('monto', parseFloat(e.target.value) || 0)} />
        </div>

        {/* Moneda */}
        <div>
          <label className={labelCls}>Moneda</label>
          <select className={inputCls} value={form.moneda}
            onChange={e => set('moneda', e.target.value as MonedaGasto)}>
            {MONEDAS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Fecha de renovación */}
        <div>
          <label className={labelCls}>Próxima renovación *</label>
          <input className={inputCls} type="date"
            value={form.proximaRenovacion} onChange={e => set('proximaRenovacion', e.target.value)} />
        </div>

        {/* Frecuencia */}
        <div>
          <label className={labelCls}>Frecuencia</label>
          <select className={inputCls} value={form.frecuencia}
            onChange={e => set('frecuencia', e.target.value as FrecuenciaGasto)}>
            {FRECUENCIAS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* Categoría */}
        <div>
          <label className={labelCls}>Categoría</label>
          <select className={inputCls} value={form.categoria}
            onChange={e => set('categoria', e.target.value as CategoriaGasto)}>
            {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>

        {/* Activo */}
        <div className="flex items-center gap-2 pt-5">
          <input id="activo" type="checkbox" className="h-4 w-4 accent-green-500"
            checked={form.activo} onChange={e => set('activo', e.target.checked)} />
          <label htmlFor="activo" className="text-sm text-muted-foreground">Suscripción activa</label>
        </div>
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {saving ? 'Guardando…' : 'Guardar'}
        </Button>
      </div>
    </form>
  )
}

// ── Tabla de gastos ───────────────────────────────────────────────────────────

function GastosTable({
  gastos,
  onEdit,
  onDelete,
  onToggle,
  onRenew,
}: {
  gastos: GastoSaaS[]
  onEdit: (g: GastoSaaS) => void
  onDelete: (id: string) => void
  onToggle: (g: GastoSaaS) => void
  onRenew: (g: GastoSaaS) => void
}) {
  if (gastos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
        <DollarSign className="h-8 w-8 opacity-30" />
        <p className="text-sm">Sin gastos registrados. Agregá el primero.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="pb-2 text-left font-medium">Servicio</th>
            <th className="pb-2 text-right font-medium">Monto</th>
            <th className="pb-2 text-center font-medium">Frecuencia</th>
            <th className="pb-2 text-center font-medium">Renovación</th>
            <th className="pb-2 text-center font-medium">Estado</th>
            <th className="pb-2 text-right font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {gastos.map(g => {
            const st   = gastoStatus(g)
            const days = daysUntil(g.proximaRenovacion)
            const freq = FRECUENCIAS.find(f => f.value === g.frecuencia)?.label ?? g.frecuencia
            return (
              <tr key={g.id} className={cn('transition-colors hover:bg-muted/30', !g.activo && 'opacity-50')}>
                <td className="py-3 pr-4">
                  <p className="font-medium">{g.servicio}</p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                    <CategoriaBadge categoria={g.categoria} />
                    {g.descripcion && (
                      <span className="text-xs text-muted-foreground">{g.descripcion}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 text-right font-mono font-medium whitespace-nowrap">
                  {formatMonto(g.monto, g.moneda)}
                </td>
                <td className="py-3 text-center text-muted-foreground whitespace-nowrap">
                  {freq}
                </td>
                <td className="py-3 text-center whitespace-nowrap">
                  <p className="text-sm">{g.proximaRenovacion}</p>
                  {g.activo && (
                    <p className={cn('text-xs mt-0.5',
                      days < 0    ? 'text-red-400'
                      : days <= 5  ? 'text-orange-400'
                      : days <= 30 ? 'text-yellow-400'
                      : 'text-muted-foreground'
                    )}>
                      {days < 0 ? `Venció hace ${Math.abs(days)}d` : `En ${days}d`}
                    </p>
                  )}
                </td>
                <td className="py-3 text-center">
                  <StatusBadge status={st} />
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-1">
                    {/* Botón Renovar — visible cuando está vencido o por vencer */}
                    {g.activo && (st === 'expired' || st === 'critical') && g.frecuencia !== 'unico' && (
                      <button
                        title={`Marcar como pagado y avanzar fecha (${g.frecuencia})`}
                        onClick={() => onRenew(g)}
                        className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/30 transition-colors hover:bg-green-500/25"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Pagado
                      </button>
                    )}
                    <button
                      title={g.activo ? 'Desactivar' : 'Activar'}
                      onClick={() => onToggle(g)}
                      className={cn('rounded p-1.5 transition-colors hover:bg-muted',
                        g.activo ? 'text-green-400' : 'text-muted-foreground')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button title="Editar" onClick={() => onEdit(g)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button title="Eliminar" onClick={() => onDelete(g.id)}
                      className="rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-red-400">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Stats resumidas ───────────────────────────────────────────────────────────

function StatsBar({ gastos }: { gastos: GastoSaaS[] }) {
  const activos  = gastos.filter(g => g.activo)
  const critical = activos.filter(g => gastoStatus(g) === 'critical' || gastoStatus(g) === 'expired')

  // Estimación mensual en cada moneda
  const porMoneda: Record<string, number> = {}
  activos.forEach(g => {
    const m = g.frecuencia === 'mensual' ? g.monto
            : g.frecuencia === 'anual'   ? g.monto / 12
            : 0
    porMoneda[g.moneda] = (porMoneda[g.moneda] ?? 0) + m
  })

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[
        { label: 'Total registrados', value: String(gastos.length), sub: `${activos.length} activos` },
        { label: 'Por vencer / Vencidos', value: String(critical.length),
          sub: 'en los próximos 5 días', accent: critical.length > 0 ? 'text-orange-400' : undefined },
        ...Object.entries(porMoneda).map(([mon, val]) => ({
          label: `Estimado mensual (${mon})`,
          value: formatMonto(val, mon as MonedaGasto),
          sub: 'suma de suscripciones activas',
        })),
      ].map((s, i) => (
        <Card key={i} className="py-0">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={cn('mt-1 text-xl font-bold', s.accent)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ── Página principal ──────────────────────────────────────────────────────────

type FormMode = 'hidden' | 'add' | 'edit'

export function FinanzasPage() {
  const { gastos, loading, error, add, update, remove } = useGastosSaaS()
  const [mode, setMode]       = useState<FormMode>('hidden')
  const [editing, setEditing] = useState<GastoSaaS | null>(null)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [catFilter, setCatFilter] = useState<CategoriaGasto | 'todas'>('todas')

  const filtered = gastos.filter(g => {
    const matchSearch = g.servicio.toLowerCase().includes(search.toLowerCase()) ||
                        (g.descripcion ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = catFilter === 'todas' || g.categoria === catFilter
    return matchSearch && matchCat
  })

  async function handleSave(data: Omit<GastoSaaS, 'id'>) {
    setSaving(true)
    try {
      if (mode === 'edit' && editing) {
        await update(editing.id, data)
      } else {
        await add(data)
      }
      setMode('hidden')
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(g: GastoSaaS) {
    setEditing(g)
    setMode('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto? Esta acción no se puede deshacer.')) return
    await remove(id)
  }

  async function handleToggle(g: GastoSaaS) {
    await update(g.id, { activo: !g.activo })
  }

  async function handleRenew(g: GastoSaaS) {
    if (g.frecuencia === 'unico') return
    const next = nextRenewalDate(g.proximaRenovacion, g.frecuencia)
    const label = g.frecuencia === 'mensual' ? '+1 mes' : '+1 año'
    if (!confirm(`¿Marcar "${g.servicio}" como pagado?\nNueva fecha de renovación: ${next} (${label})`)) return
    await update(g.id, { proximaRenovacion: next })
  }

  function handleCancel() {
    setMode('hidden')
    setEditing(null)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Gestión de Gastos</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            SaaS, licencias, dominios y servicios recurrentes
          </p>
        </div>
        {mode === 'hidden' && (
          <Button onClick={() => setMode('add')}>
            <Plus className="h-4 w-4" /> Agregar gasto
          </Button>
        )}
      </div>

      {/* Stats */}
      {!loading && <StatsBar gastos={gastos} />}

      {/* Formulario */}
      {mode !== 'hidden' && (
        <Card className="border-blue-500/20 bg-blue-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {mode === 'add' ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {mode === 'add' ? 'Nuevo gasto' : `Editando: ${editing?.servicio}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <GastoForm
              initial={
                mode === 'edit' && editing
                  ? { servicio: editing.servicio, descripcion: editing.descripcion,
                      monto: editing.monto, moneda: editing.moneda,
                      proximaRenovacion: editing.proximaRenovacion,
                      categoria: editing.categoria, frecuencia: editing.frecuencia,
                      activo: editing.activo }
                  : FORM_EMPTY
              }
              onSave={handleSave}
              onCancel={handleCancel}
              saving={saving}
            />
          </CardContent>
        </Card>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <DollarSign className="h-4 w-4" />
              Suscripciones y licencias
            </CardTitle>
            <div className="flex gap-2">
              <input
                className="w-48 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Buscar…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                className="rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={catFilter}
                onChange={e => setCatFilter(e.target.value as CategoriaGasto | 'todas')}
              >
                <option value="todas">Todas las categorías</option>
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">
              Cargando gastos…
            </p>
          )}
          {error && (
            <p className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">
              {error}
            </p>
          )}
          {!loading && !error && (
            <GastosTable
              gastos={filtered}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRenew={handleRenew}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
