import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { getBacarPassFirebase } from '@/config/bacarpassFirebase'
import type { MiembroEquipo } from '@/types'

const COLLECTION = 'itops_equipo'

export function useEquipo() {
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    let cancelled = false
    try {
      const { db } = getBacarPassFirebase()
      const q = query(collection(db, COLLECTION), orderBy('nombre', 'asc'))
      unsub = onSnapshot(
        q,
        snap => {
          setMiembros(
            snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MiembroEquipo, 'id'>) })),
          )
          setLoading(false)
          setError(null)
        },
        err => {
          console.error('[Equipo]', err)
          queueMicrotask(() => {
            if (cancelled) return
            setError('No se pudo conectar a Firestore. Verificá la conexión.')
            setLoading(false)
          })
        },
      )
    } catch (e) {
      queueMicrotask(() => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Error al iniciar Firebase')
        setLoading(false)
      })
    }
    return () => {
      cancelled = true
      unsub?.()
    }
  }, [])

  const add = useCallback(async (data: Omit<MiembroEquipo, 'id'>) => {
    const { db } = getBacarPassFirebase()
    await addDoc(collection(db, COLLECTION), { ...data, _createdAt: serverTimestamp() })
  }, [])

  const update = useCallback(async (id: string, data: Partial<Omit<MiembroEquipo, 'id'>>) => {
    const { db } = getBacarPassFirebase()
    await updateDoc(doc(db, COLLECTION, id), { ...data, _updatedAt: serverTimestamp() })
  }, [])

  const remove = useCallback(async (id: string) => {
    const { db } = getBacarPassFirebase()
    await deleteDoc(doc(db, COLLECTION, id))
  }, [])

  return { miembros, loading, error, add, update, remove }
}
