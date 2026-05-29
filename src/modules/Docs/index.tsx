import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import {
  FileText, Upload, Search, Plus, Pencil, Trash2, X,
  Download, File, Tag, ChevronDown, ChevronUp,
  BookOpen, Wrench, AlertTriangle, BookMarked, GraduationCap, MoreHorizontal,
  ImageIcon, Code2, HardDrive,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useDocs, useArchivos, formatBytes, type DocInput, type ArchivoInput } from '@/hooks/useDocs'
import type { DocEntry, ArchivoIT, CategoriaDoc, CategoriaArchivo } from '@/types'

// ── Constantes ─────────────────────────────────────────────────────────────────

const CAT_DOC: { value: CategoriaDoc; label: string; icon: React.ReactNode }[] = [
  { value: 'procedimiento',   label: 'Procedimiento',   icon: <BookOpen     className="h-3.5 w-3.5" /> },
  { value: 'configuracion',   label: 'Configuración',   icon: <Wrench       className="h-3.5 w-3.5" /> },
  { value: 'troubleshooting', label: 'Troubleshooting', icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  { value: 'referencia',      label: 'Referencia',      icon: <BookMarked   className="h-3.5 w-3.5" /> },
  { value: 'tutorial',        label: 'Tutorial',        icon: <GraduationCap className="h-3.5 w-3.5" /> },
  { value: 'otro',            label: 'Otro',            icon: <MoreHorizontal className="h-3.5 w-3.5" /> },
]

const CAT_FILE: { value: CategoriaArchivo; label: string; icon: React.ReactNode }[] = [
  { value: 'software',  label: 'Software',   icon: <HardDrive  className="h-3.5 w-3.5" /> },
  { value: 'script',    label: 'Script',     icon: <Code2      className="h-3.5 w-3.5" /> },
  { value: 'driver',    label: 'Driver',     icon: <HardDrive  className="h-3.5 w-3.5" /> },
  { value: 'utilidad',  label: 'Utilidad',   icon: <Wrench     className="h-3.5 w-3.5" /> },
  { value: 'manual',    label: 'Manual',     icon: <BookOpen   className="h-3.5 w-3.5" /> },
  { value: 'imagen',    label: 'Imagen ISO', icon: <ImageIcon  className="h-3.5 w-3.5" /> },
  { value: 'otro',      label: 'Otro',       icon: <File       className="h-3.5 w-3.5" /> },
]

const DOC_CAT_COLORS: Record<CategoriaDoc, string> = {
  procedimiento:   'bg-blue-500/15 text-blue-400',
  configuracion:   'bg-purple-500/15 text-purple-400',
  troubleshooting: 'bg-orange-500/15 text-orange-400',
  referencia:      'bg-cyan-500/15 text-cyan-400',
  tutorial:        'bg-green-500/15 text-green-400',
  otro:            'bg-muted text-muted-foreground',
}

const FILE_CAT_COLORS: Record<CategoriaArchivo, string> = {
  software:  'bg-blue-500/15 text-blue-400',
  script:    'bg-yellow-500/15 text-yellow-400',
  driver:    'bg-purple-500/15 text-purple-400',
  utilidad:  'bg-teal-500/15 text-teal-400',
  manual:    'bg-green-500/15 text-green-400',
  imagen:    'bg-pink-500/15 text-pink-400',
  otro:      'bg-muted text-muted-foreground',
}

// ── Componentes de badge ────────────────────────────────────────────────────────

function CategoriaBadge({ cat, type }: { cat: string; type: 'doc' | 'file' }) {
  const colorMap = type === 'doc' ? DOC_CAT_COLORS : FILE_CAT_COLORS
  const cfg = type === 'doc'
    ? CAT_DOC.find(c => c.value === cat)
    : CAT_FILE.find(c => c.value === cat)
  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
      colorMap[cat as CategoriaDoc & CategoriaArchivo] ?? 'bg-muted text-muted-foreground',
    )}>
      {cfg?.icon}{cfg?.label ?? cat}
    </span>
  )
}

function TagPill({ tag }: { tag: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      <Tag className="h-2.5 w-2.5" />{tag}
    </span>
  )
}

// ── Input de tags ──────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (t: string[]) => void }) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim()
    if (t && !tags.includes(t)) onChange([...tags, t])
    setInput('')
  }
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Agregar tag…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        />
        <Button type="button" variant="outline" size="sm" onClick={add} disabled={!input.trim()}>
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map(t => (
            <button
              key={t} type="button"
              onClick={() => onChange(tags.filter(x => x !== t))}
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <Tag className="h-2.5 w-2.5" />{t}
              <X className="h-2.5 w-2.5" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── ── ── ── ── SECCIÓN DOCUMENTOS ── ── ── ── ──────────────────────────────

const DOC_EMPTY: DocInput = {
  titulo: '', resumen: '', categoria: 'procedimiento',
  tags: [], contenido: '', autor: '',
}

function DocForm({
  initial, onSave, onCancel, saving,
}: {
  initial: DocInput
  onSave: (d: DocInput) => Promise<void>
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState<DocInput>(initial)
  const [preview, setPreview] = useState(false)
  const [err, setErr] = useState('')

  const set = <K extends keyof DocInput>(k: K, v: DocInput[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    if (!form.titulo.trim())    return setErr('El título es requerido.')
    if (!form.contenido.trim()) return setErr('El contenido no puede estar vacío.')
    try { await onSave(form) } catch { setErr('Error al guardar. Verificá tu conexión.') }
  }

  const inp = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
  const lbl = 'mb-1 block text-xs font-medium text-muted-foreground'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Título *</label>
          <input className={inp} placeholder="Ej: Configurar VPN en Windows 11"
            value={form.titulo} onChange={e => set('titulo', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descripción corta</label>
          <input className={inp} placeholder="Resumen breve visible en el listado"
            value={form.resumen ?? ''} onChange={e => set('resumen', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Categoría</label>
          <select className={inp} value={form.categoria}
            onChange={e => set('categoria', e.target.value as CategoriaDoc)}>
            {CAT_DOC.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Autor</label>
          <input className={inp} placeholder="Nombre o email"
            value={form.autor ?? ''} onChange={e => set('autor', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Tags</label>
          <TagInput tags={form.tags} onChange={t => set('tags', t)} />
        </div>
      </div>

      {/* Editor / Preview */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <label className={lbl + ' mb-0'}>Contenido (Markdown) *</label>
          <button type="button" onClick={() => setPreview(p => !p)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            {preview ? <><Pencil className="h-3 w-3" /> Editar</> : <><BookOpen className="h-3 w-3" /> Vista previa</>}
          </button>
        </div>
        {preview ? (
          <div className={cn(inp, 'min-h-48 overflow-auto prose prose-invert prose-sm max-w-none',
            'prose-headings:text-foreground prose-p:text-muted-foreground prose-code:text-pink-400',
            'prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:text-xs',
            'prose-a:text-blue-400 prose-strong:text-foreground prose-li:text-muted-foreground',
            'prose-pre:p-0 prose-pre:bg-transparent',
          )}>
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                code({ className, children }) {
                  const match = /language-(\w+)/.exec(className ?? '')
                  if (!match) return <code className="text-pink-400 bg-muted rounded px-1 py-0.5 text-xs">{children}</code>
                  return (
                    <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div"
                      customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                      {String(children).replace(/\n$/, '')}
                    </SyntaxHighlighter>
                  )
                },
              }}
            >
              {form.contenido || '*Sin contenido aún…*'}
            </ReactMarkdown>
          </div>
        ) : (
          <textarea
            className={cn(inp, 'min-h-48 font-mono text-xs resize-y')}
            placeholder={'# Título de la sección\n\nEscribí tu documentación en **Markdown**.\n\n## Pasos\n\n1. Paso uno\n2. Paso dos\n\n```bash\ncomando de ejemplo\n```'}
            value={form.contenido}
            onChange={e => set('contenido', e.target.value)}
          />
        )}
      </div>

      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? 'Guardando…' : <><FileText className="h-4 w-4" /> Guardar</>}
        </Button>
      </div>
    </form>
  )
}

function DocCard({
  doc, onEdit, onDelete,
}: {
  doc: DocEntry
  onEdit: (d: DocEntry) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden">
      <div className="flex cursor-pointer items-start gap-3 p-4"
        onClick={() => setExpanded(e => !e)}>
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-snug">{doc.titulo}</p>
            <div className="flex shrink-0 items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => onEdit(doc)}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => { if (confirm('¿Eliminar esta entrada?')) onDelete(doc.id) }}
                className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-red-400">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </div>
          {doc.resumen && <p className="mt-0.5 text-xs text-muted-foreground">{doc.resumen}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <CategoriaBadge cat={doc.categoria} type="doc" />
            {doc.autor && <span className="text-xs text-muted-foreground">{doc.autor}</span>}
            {doc.tags.map(t => <TagPill key={t} tag={t} />)}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(doc.actualizadoEn).toLocaleDateString('es-AR')}
            </span>
          </div>
        </div>
      </div>

      {expanded && (
        <div className={cn(
          'border-t border-border px-4 pb-4 pt-3',
          'prose prose-invert prose-sm max-w-none',
          'prose-headings:text-foreground prose-p:text-muted-foreground',
          'prose-code:text-pink-400 prose-code:bg-muted prose-code:rounded prose-code:px-1 prose-code:text-xs',
          'prose-a:text-blue-400 prose-strong:text-foreground prose-li:text-muted-foreground',
          'prose-table:text-xs prose-th:border prose-th:border-border prose-th:px-2 prose-th:py-1 prose-th:bg-muted/30',
          'prose-td:border prose-td:border-border prose-td:px-2 prose-td:py-1',
          'prose-blockquote:border-l-blue-500 prose-pre:p-0 prose-pre:bg-transparent prose-pre:rounded-lg prose-pre:overflow-hidden',
        )}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children }) {
                const match = /language-(\w+)/.exec(className ?? '')
                if (!match) return <code className="text-pink-400 bg-muted rounded px-1 py-0.5 text-xs">{children}</code>
                return (
                  <SyntaxHighlighter style={vscDarkPlus} language={match[1]} PreTag="div"
                    customStyle={{ margin: 0, borderRadius: '0.5rem', fontSize: '0.75rem' }}>
                    {String(children).replace(/\n$/, '')}
                  </SyntaxHighlighter>
                )
              },
              a({ href, children }) {
                return <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
              },
            }}
          >
            {doc.contenido}
          </ReactMarkdown>
        </div>
      )}
    </Card>
  )
}

// ── ── ── ── ── SECCIÓN ARCHIVOS ── ── ── ── ─────────────────────────────────

const FILE_EMPTY: ArchivoInput = {
  nombre: '', descripcion: '', categoria: 'software', tags: [], subidoPor: '',
}

function DropZone({
  file, onFile,
}: {
  file: File | null
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => {
        e.preventDefault(); setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 transition-colors',
        dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40 hover:bg-muted/20',
      )}
    >
      <input ref={inputRef} type="file" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />
      <Upload className={cn('h-8 w-8 mb-2', dragging ? 'text-primary' : 'text-muted-foreground')} />
      {file ? (
        <div className="text-center">
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatBytes(file.size)}</p>
        </div>
      ) : (
        <div className="text-center">
          <p className="text-sm text-muted-foreground">Arrastrá el archivo aquí o hacé click</p>
          <p className="text-xs text-muted-foreground mt-0.5">Cualquier tipo de archivo</p>
        </div>
      )}
    </div>
  )
}

function ArchivoForm({
  onSave, onCancel,
}: {
  onSave: (meta: ArchivoInput, file: File, onProgress: (p: number) => void) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm]       = useState<ArchivoInput>(FILE_EMPTY)
  const [file, setFile]       = useState<File | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [err, setErr]         = useState('')

  const set = <K extends keyof ArchivoInput>(k: K, v: ArchivoInput[K]) =>
    setForm(p => ({ ...p, [k]: v }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setErr('')
    if (!file) return setErr('Seleccioná un archivo.')
    const nombreFinal = form.nombre.trim() ? form.nombre : file.name
    try {
      setProgress(0)
      await onSave({ ...form, nombre: nombreFinal }, file, p => setProgress(p))
    } catch (ex) {
      setErr('Error al subir: ' + (ex instanceof Error ? ex.message : String(ex)))
      setProgress(null)
    }
  }

  const inp = 'w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring'
  const lbl = 'mb-1 block text-xs font-medium text-muted-foreground'
  const uploading = progress !== null && progress < 100

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DropZone file={file} onFile={f => { setFile(f); if (!form.nombre) set('nombre', f.name) }} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl}>Nombre *</label>
          <input className={inp} placeholder="Nombre del archivo o programa"
            value={form.nombre} onChange={e => set('nombre', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Descripción</label>
          <input className={inp} placeholder="Para qué sirve, versión, notas…"
            value={form.descripcion ?? ''} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div>
          <label className={lbl}>Categoría</label>
          <select className={inp} value={form.categoria}
            onChange={e => set('categoria', e.target.value as CategoriaArchivo)}>
            {CAT_FILE.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className={lbl}>Subido por</label>
          <input className={inp} placeholder="Nombre"
            value={form.subidoPor ?? ''} onChange={e => set('subidoPor', e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl}>Tags</label>
          <TagInput tags={form.tags} onChange={t => set('tags', t)} />
        </div>
      </div>

      {/* Barra de progreso */}
      {progress !== null && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{progress < 100 ? 'Subiendo…' : '✅ Subido'}</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-blue-500 transition-all duration-200"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={uploading}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={uploading || !file}>
          {uploading
            ? `Subiendo ${progress}%…`
            : <><Upload className="h-4 w-4" /> Subir archivo</>}
        </Button>
      </div>
    </form>
  )
}

function ArchivoCard({
  archivo, onDelete,
}: {
  archivo: ArchivoIT
  onDelete: (a: ArchivoIT) => void
}) {
  const ext = archivo.fileName.split('.').pop()?.toLowerCase() ?? ''
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)

  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg',
          isImage ? 'bg-pink-500/15' : 'bg-blue-500/15',
        )}>
          {isImage ? <ImageIcon className="h-5 w-5 text-pink-400" />
                   : <File className="h-5 w-5 text-blue-400" />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-sm">{archivo.nombre}</p>
          {archivo.descripcion && (
            <p className="text-xs text-muted-foreground truncate">{archivo.descripcion}</p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CategoriaBadge cat={archivo.categoria} type="file" />
            <span className="text-xs text-muted-foreground">{formatBytes(archivo.fileSize)}</span>
            <span className="text-xs text-muted-foreground uppercase">{ext}</span>
            {archivo.tags.map(t => <TagPill key={t} tag={t} />)}
            <span className="ml-auto text-xs text-muted-foreground">
              {new Date(archivo.creadoEn).toLocaleDateString('es-AR')}
              {archivo.subidoPor && ` · ${archivo.subidoPor}`}
            </span>
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <a href={archivo.fileUrl} target="_blank" rel="noopener noreferrer" download={archivo.fileName}>
            <button className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Descargar">
              <Download className="h-4 w-4" />
            </button>
          </a>
          <button
            onClick={() => { if (confirm(`¿Eliminar "${archivo.nombre}"?`)) onDelete(archivo) }}
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-red-400 transition-colors" title="Eliminar">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── ── ── ── ── PÁGINA PRINCIPAL ── ── ── ── ──────────────────────────────────

type Tab = 'docs' | 'archivos'
type DocMode = 'hidden' | 'new' | 'edit'

export function DocsPage() {
  const { docs,     loading: docsLoading,  error: docsErr,   add: addDoc, update: updateDoc, remove: removeDoc   } = useDocs()
  const { archivos, loading: filesLoading, error: filesErr,  upload,      remove: removeFile } = useArchivos()

  const [tab, setTab]           = useState<Tab>('docs')
  const [docMode, setDocMode]   = useState<DocMode>('hidden')
  const [editDoc, setEditDoc]   = useState<DocEntry | null>(null)
  const [showUpload, setShowUpload] = useState(false)
  const [search, setSearch]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [filterCat, setFilterCat] = useState<string>('todas')

  // Filtrar documentos
  const filteredDocs = docs.filter(d => {
    const q = search.toLowerCase()
    const matchSearch = !q || d.titulo.toLowerCase().includes(q)
      || (d.resumen ?? '').toLowerCase().includes(q)
      || d.tags.some(t => t.toLowerCase().includes(q))
      || d.contenido.toLowerCase().includes(q)
    const matchCat = filterCat === 'todas' || d.categoria === filterCat
    return matchSearch && matchCat
  })

  // Filtrar archivos
  const filteredFiles = archivos.filter(a => {
    const q = search.toLowerCase()
    const matchSearch = !q || a.nombre.toLowerCase().includes(q)
      || (a.descripcion ?? '').toLowerCase().includes(q)
      || a.tags.some(t => t.toLowerCase().includes(q))
      || a.fileName.toLowerCase().includes(q)
    const matchCat = filterCat === 'todas' || a.categoria === filterCat
    return matchSearch && matchCat
  })

  async function handleDocSave(data: DocInput) {
    setSaving(true)
    try {
      if (docMode === 'edit' && editDoc) await updateDoc(editDoc.id, data)
      else await addDoc(data)
      setDocMode('hidden'); setEditDoc(null)
    } finally { setSaving(false) }
  }

  async function handleUpload(meta: ArchivoInput, file: File, onProgress: (p: number) => void) {
    await upload(file, meta, onProgress)
    setShowUpload(false)
  }

  function startEdit(d: DocEntry) {
    setEditDoc(d); setDocMode('edit')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="space-y-6 p-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documentación IT</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {docs.length} documento{docs.length !== 1 ? 's' : ''} · {archivos.length} archivo{archivos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === 'docs' && docMode === 'hidden' && (
            <Button size="sm" onClick={() => { setDocMode('new'); setEditDoc(null) }}>
              <Plus className="h-4 w-4" /> Nuevo doc
            </Button>
          )}
          {tab === 'archivos' && !showUpload && (
            <Button size="sm" onClick={() => setShowUpload(true)}>
              <Upload className="h-4 w-4" /> Subir archivo
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted/20 p-1 w-fit">
        {([
          { id: 'docs',     label: 'Documentos',       icon: <FileText className="h-4 w-4" />,  count: docs.length },
          { id: 'archivos', label: 'Archivos y programas', icon: <Upload className="h-4 w-4" />, count: archivos.length },
        ] as const).map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setSearch(''); setFilterCat('todas') }}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors',
              tab === t.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}>
            {t.icon}{t.label}
            <span className={cn('rounded-full px-1.5 py-0 text-xs', tab === t.id ? 'bg-muted' : 'bg-transparent text-muted-foreground')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Búsqueda y filtros */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            className="w-full rounded-md border border-border bg-background pl-9 pr-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={tab === 'docs' ? 'Buscar documentos…' : 'Buscar archivos…'}
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          value={filterCat} onChange={e => setFilterCat(e.target.value)}
        >
          <option value="todas">Todas las categorías</option>
          {(tab === 'docs' ? CAT_DOC : CAT_FILE).map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* ── TAB DOCUMENTOS ── */}
      {tab === 'docs' && (
        <div className="space-y-4">

          {/* Formulario */}
          {docMode !== 'hidden' && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  {docMode === 'new' ? <Plus className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  {docMode === 'new' ? 'Nueva entrada' : `Editando: ${editDoc?.titulo}`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DocForm
                  initial={docMode === 'edit' && editDoc ? {
                    titulo:    editDoc.titulo,
                    resumen:   editDoc.resumen,
                    categoria: editDoc.categoria,
                    tags:      editDoc.tags,
                    contenido: editDoc.contenido,
                    autor:     editDoc.autor,
                  } : DOC_EMPTY}
                  onSave={handleDocSave}
                  onCancel={() => { setDocMode('hidden'); setEditDoc(null) }}
                  saving={saving}
                />
              </CardContent>
            </Card>
          )}

          {docsLoading && <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">Cargando documentación…</p>}
          {docsErr    && <p className="text-sm text-red-400 rounded border border-red-500/20 bg-red-500/5 p-3">{docsErr}</p>}

          {!docsLoading && !docsErr && filteredDocs.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {search || filterCat !== 'todas' ? 'Sin resultados para ese filtro' : 'Todavía no hay documentación'}
              </p>
              {!search && filterCat === 'todas' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Hacé click en "Nuevo doc" para empezar a cargar procedimientos, configs y más.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {filteredDocs.map(d => (
              <DocCard key={d.id} doc={d} onEdit={startEdit}
                onDelete={id => removeDoc(id)} />
            ))}
          </div>
        </div>
      )}

      {/* ── TAB ARCHIVOS ── */}
      {tab === 'archivos' && (
        <div className="space-y-4">

          {/* Formulario de subida */}
          {showUpload && (
            <Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4" /> Subir archivo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ArchivoForm
                  onSave={handleUpload}
                  onCancel={() => setShowUpload(false)}
                />
              </CardContent>
            </Card>
          )}

          {filesLoading && <p className="py-8 text-center text-sm text-muted-foreground animate-pulse">Cargando archivos…</p>}
          {filesErr    && <p className="text-sm text-red-400 rounded border border-red-500/20 bg-red-500/5 p-3">{filesErr}</p>}

          {!filesLoading && !filesErr && filteredFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
              <Upload className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">
                {search || filterCat !== 'todas' ? 'Sin resultados para ese filtro' : 'No hay archivos subidos'}
              </p>
              {!search && filterCat === 'todas' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Subí programas de soporte, scripts, drivers, manuales y cualquier herramienta útil para el equipo.
                </p>
              )}
            </div>
          )}

          <div className="space-y-3">
            {filteredFiles.map(a => (
              <ArchivoCard key={a.id} archivo={a} onDelete={f => removeFile(f)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
