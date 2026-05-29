import { useState } from 'react'
import { Mail, Plus, Pencil, Trash2, RefreshCw, Users, Building2, Briefcase } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useEquipo } from '@/hooks/useEquipo'
import type { MiembroEquipo } from '@/types'

const FORM_EMPTY: Omit<MiembroEquipo, 'id'> = {
  nombre: '',
  rol: '',
  email: '',
  departamento: '',
}

function MiembroForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: Omit<MiembroEquipo, 'id'>
  onSave: (data: Omit<MiembroEquipo, 'id'>) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [err, setErr] = useState('')

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm(prev => ({ ...prev, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.nombre.trim()) return setErr('El nombre es obligatorio.')
    if (!form.rol.trim()) return setErr('El rol es obligatorio.')
    if (!form.email.trim()) return setErr('El email es obligatorio.')
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    if (!emailOk) return setErr('Ingresá un email válido.')
    try {
      await onSave({
        ...form,
        nombre: form.nombre.trim(),
        rol: form.rol.trim(),
        email: form.email.trim().toLowerCase(),
        departamento: form.departamento?.trim() || undefined,
      })
    } catch {
      setErr('No se pudo guardar. Verificá la conexión o permisos en Firestore.')
    }
  }

  const inputCls =
    'w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
  const labelCls = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Nombre *</label>
          <input
            className={inputCls}
            placeholder="Nombre completo"
            value={form.nombre}
            onChange={e => set('nombre', e.target.value)}
          />
        </div>
        <div>
          <label className={labelCls}>Rol *</label>
          <input
            className={inputCls}
            placeholder="Ej: SysAdmin, Soporte N1…"
            value={form.rol}
            onChange={e => set('rol', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Email *</label>
          <input
            className={inputCls}
            type="email"
            placeholder="correo@empresa.com"
            value={form.email}
            onChange={e => set('email', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Departamento</label>
          <input
            className={inputCls}
            placeholder="Opcional"
            value={form.departamento ?? ''}
            onChange={e => set('departamento', e.target.value)}
          />
        </div>
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
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

export function EquipoPage() {
  const { miembros, loading, error, add, update, remove } = useEquipo()
  const [mode, setMode] = useState<'hidden' | 'add' | 'edit'>('hidden')
  const [editing, setEditing] = useState<MiembroEquipo | null>(null)
  const [saving, setSaving] = useState(false)
  const [q, setQ] = useState('')

  const filtered = miembros.filter(m => {
    const s = q.toLowerCase()
    return (
      m.nombre.toLowerCase().includes(s) ||
      m.rol.toLowerCase().includes(s) ||
      m.email.toLowerCase().includes(s) ||
      (m.departamento ?? '').toLowerCase().includes(s)
    )
  })

  async function handleSave(data: Omit<MiembroEquipo, 'id'>) {
    setSaving(true)
    try {
      if (mode === 'edit' && editing) await update(editing.id, data)
      else await add(data)
      setMode('hidden')
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este miembro del directorio?')) return
    await remove(id)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Directorio de equipo</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Contactos internos (Firestore: <code className="text-xs">itops_equipo</code>)
          </p>
        </div>
        {mode === 'hidden' && (
          <Button onClick={() => setMode('add')}>
            <Plus className="h-4 w-4" /> Agregar miembro
          </Button>
        )}
      </div>

      {mode !== 'hidden' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              {mode === 'add' ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
              {mode === 'add' ? 'Nuevo miembro' : `Editar: ${editing?.nombre}`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MiembroForm
              initial={
                mode === 'edit' && editing
                  ? {
                      nombre: editing.nombre,
                      rol: editing.rol,
                      email: editing.email,
                      departamento: editing.departamento ?? '',
                    }
                  : FORM_EMPTY
              }
              onSave={handleSave}
              onCancel={() => {
                setMode('hidden')
                setEditing(null)
              }}
              saving={saving}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Miembros ({miembros.length})
            </CardTitle>
            <input
              className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring sm:w-56"
              placeholder="Buscar…"
              value={q}
              onChange={e => setQ(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading && (
            <p className="py-10 text-center text-sm text-muted-foreground animate-pulse">Cargando…</p>
          )}
          {error && (
            <p className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && filtered.length === 0 && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {miembros.length === 0
                ? 'No hay miembros. Agregá el primero con el botón de arriba.'
                : 'Ningún resultado para la búsqueda.'}
            </p>
          )}
          {!loading && !error && filtered.length > 0 && (
            <ul className="divide-y divide-border">
              {filtered.map(m => (
                <li
                  key={m.id}
                  className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-medium">{m.nombre}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Briefcase className="h-3 w-3 shrink-0" />
                        {m.rol}
                      </span>
                      {m.departamento && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3 w-3 shrink-0" />
                          {m.departamento}
                        </span>
                      )}
                      <a
                        href={`mailto:${m.email}`}
                        className={cn('inline-flex items-center gap-1 text-primary hover:underline')}
                      >
                        <Mail className="h-3 w-3 shrink-0" />
                        {m.email}
                      </a>
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Editar"
                      onClick={() => {
                        setEditing(m)
                        setMode('edit')
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                      className="rounded p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="Eliminar"
                      onClick={() => void handleDelete(m.id)}
                      className="rounded p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
