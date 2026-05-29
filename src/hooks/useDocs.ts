import { useCallback, useEffect, useState } from 'react'
import {
  collection, onSnapshot, addDoc, updateDoc, deleteDoc,
  doc, serverTimestamp, Timestamp, orderBy, query,
} from 'firebase/firestore'
import {
  ref, uploadBytesResumable, getDownloadURL, deleteObject,
} from 'firebase/storage'
import { getBacarPassFirebase } from '@/config/bacarpassFirebase'
import type { DocEntry, ArchivoIT, CategoriaDoc, CategoriaArchivo } from '@/types'

// ── Tipos de entrada para formularios ─────────────────────────────────────────

export interface DocInput {
  titulo: string
  resumen?: string
  categoria: CategoriaDoc
  tags: string[]
  contenido: string
  autor?: string
}

export interface ArchivoInput {
  nombre: string
  descripcion?: string
  categoria: CategoriaArchivo
  tags: string[]
  subidoPor?: string
}

// ── Helpers de conversión ──────────────────────────────────────────────────────

function tsToIso(v: unknown): string {
  if (!v) return new Date().toISOString()
  if (v instanceof Timestamp) return v.toDate().toISOString()
  return String(v)
}

function docToDocEntry(id: string, d: Record<string, unknown>): DocEntry {
  return {
    id,
    titulo:       String(d.titulo ?? ''),
    resumen:      d.resumen ? String(d.resumen) : undefined,
    categoria:    (d.categoria as CategoriaDoc) ?? 'otro',
    tags:         Array.isArray(d.tags) ? (d.tags as string[]) : [],
    contenido:    String(d.contenido ?? ''),
    creadoEn:     tsToIso(d.creadoEn),
    actualizadoEn: tsToIso(d.actualizadoEn),
    autor:        d.autor ? String(d.autor) : undefined,
  }
}

function docToArchivo(id: string, d: Record<string, unknown>): ArchivoIT {
  return {
    id,
    nombre:      String(d.nombre ?? ''),
    descripcion: d.descripcion ? String(d.descripcion) : undefined,
    categoria:   (d.categoria as CategoriaArchivo) ?? 'otro',
    tags:        Array.isArray(d.tags) ? (d.tags as string[]) : [],
    fileUrl:     String(d.fileUrl ?? ''),
    fileName:    String(d.fileName ?? ''),
    fileSize:    Number(d.fileSize ?? 0),
    fileType:    String(d.fileType ?? ''),
    creadoEn:    tsToIso(d.creadoEn),
    subidoPor:   d.subidoPor ? String(d.subidoPor) : undefined,
  }
}

// ── Hook: documentación ────────────────────────────────────────────────────────

export function useDocs() {
  const [docs,    setDocs]    = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    const { db } = getBacarPassFirebase()
    const q = query(collection(db, 'itops_docs'), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q,
      snap => {
        setDocs(snap.docs.map(d => docToDocEntry(d.id, d.data() as Record<string, unknown>)))
        setLoading(false)
        setError(null)
      },
      err => { setError(err.message); setLoading(false) },
    )
    return unsub
  }, [])

  const add = useCallback(async (input: DocInput) => {
    const { db } = getBacarPassFirebase()
    await addDoc(collection(db, 'itops_docs'), {
      ...input,
      tags: input.tags ?? [],
      creadoEn:      serverTimestamp(),
      actualizadoEn: serverTimestamp(),
    })
  }, [])

  const update = useCallback(async (id: string, input: Partial<DocInput>) => {
    const { db } = getBacarPassFirebase()
    await updateDoc(doc(db, 'itops_docs', id), {
      ...input,
      actualizadoEn: serverTimestamp(),
    })
  }, [])

  const remove = useCallback(async (id: string) => {
    const { db } = getBacarPassFirebase()
    await deleteDoc(doc(db, 'itops_docs', id))
  }, [])

  return { docs, loading, error, add, update, remove }
}

// ── Hook: archivos & programas ─────────────────────────────────────────────────

export type UploadProgress = { progress: number; state: 'running' | 'done' | 'error' }

export function useArchivos() {
  const [archivos, setArchivos] = useState<ArchivoIT[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  useEffect(() => {
    const { db } = getBacarPassFirebase()
    const q = query(collection(db, 'itops_archivos'), orderBy('creadoEn', 'desc'))
    const unsub = onSnapshot(q,
      snap => {
        setArchivos(snap.docs.map(d => docToArchivo(d.id, d.data() as Record<string, unknown>)))
        setLoading(false)
        setError(null)
      },
      err => { setError(err.message); setLoading(false) },
    )
    return unsub
  }, [])

  /**
   * Sube un archivo a Firebase Storage y guarda la metadata en Firestore.
   * onProgress(0-100) se llama durante la subida.
   */
  const upload = useCallback(async (
    file: File,
    meta: ArchivoInput,
    onProgress?: (pct: number) => void,
  ): Promise<void> => {
    const { db, storage } = getBacarPassFirebase()
    const storageRef = ref(storage, `it-ops/files/${Date.now()}_${file.name}`)

    await new Promise<void>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file)
      task.on(
        'state_changed',
        snap => onProgress?.(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        reject,
        async () => {
          try {
            const fileUrl = await getDownloadURL(storageRef)
            await addDoc(collection(db, 'itops_archivos'), {
              ...meta,
              tags:      meta.tags ?? [],
              fileUrl,
              fileName:  file.name,
              fileSize:  file.size,
              fileType:  file.type || 'application/octet-stream',
              creadoEn:  serverTimestamp(),
            })
            resolve()
          } catch (e) { reject(e) }
        },
      )
    })
  }, [])

  const remove = useCallback(async (archivo: ArchivoIT) => {
    const { db, storage } = getBacarPassFirebase()
    // Intentar eliminar de Storage (puede fallar si ya no existe)
    try {
      const fileRef = ref(storage, archivo.fileUrl)
      await deleteObject(fileRef)
    } catch { /* ignorar si ya no existe */ }
    await deleteDoc(doc(db, 'itops_archivos', archivo.id))
  }, [])

  return { archivos, loading, error, upload, remove }
}

// ── Utilidades de formato ──────────────────────────────────────────────────────

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}
