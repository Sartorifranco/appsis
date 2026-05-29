import { useCallback, useEffect, useState } from 'react'
import {
  collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, serverTimestamp, query, orderBy,
} from 'firebase/firestore'
import { getBacarPassFirebase } from '@/config/bacarpassFirebase'
import type { GastoSaaS } from '@/types'

const COLLECTION = 'itops_gastos'

function getDaysUntil(dateStr: string): number {
  const today  = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr + 'T00:00:00')
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000)
}

export type GastoStatus = 'expired' | 'critical' | 'warning' | 'ok' | 'inactive'

export function gastoStatus(g: GastoSaaS): GastoStatus {
  if (!g.activo) return 'inactive'
  const days = getDaysUntil(g.proximaRenovacion)
  if (days < 0)  return 'expired'
  if (days <= 5) return 'critical'
  if (days <= 30) return 'warning'
  return 'ok'
}

export function useGastosSaaS() {
  const [gastos, setGastos]   = useState<GastoSaaS[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    let unsub: (() => void) | undefined
    try {
      const { db } = getBacarPassFirebase()
      const q = query(collection(db, COLLECTION), orderBy('proximaRenovacion', 'asc'))
      unsub = onSnapshot(
        q,
        snap => {
          setGastos(
            snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<GastoSaaS, 'id'>) }))
          )
          setLoading(false)
          setError(null)
        },
        err => {
          console.error('[Gastos]', err)
          setError('No se pudo conectar a Firestore. Verificá la conexión.')
          setLoading(false)
        },
      )
    } catch (e) {
      queueMicrotask(() => {
        setError(e instanceof Error ? e.message : 'Error al iniciar Firebase')
        setLoading(false)
      })
    }
    return () => unsub?.()
  }, [])

  const add = useCallback(async (data: Omit<GastoSaaS, 'id'>) => {
    const { db } = getBacarPassFirebase()
    await addDoc(collection(db, COLLECTION), { ...data, _createdAt: serverTimestamp() })
  }, [])

  const update = useCallback(async (id: string, data: Partial<Omit<GastoSaaS, 'id'>>) => {
    const { db } = getBacarPassFirebase()
    await updateDoc(doc(db, COLLECTION, id), { ...data, _updatedAt: serverTimestamp() })
  }, [])

  const remove = useCallback(async (id: string) => {
    const { db } = getBacarPassFirebase()
    await deleteDoc(doc(db, COLLECTION, id))
  }, [])

  /** Gastos que vencen dentro de los próximos `days` días (o ya vencieron) */
  const expiringSoon = useCallback(
    (days = 5) =>
      gastos.filter(g => {
        if (!g.activo) return false
        const d = getDaysUntil(g.proximaRenovacion)
        return d <= days
      }),
    [gastos],
  )

  return { gastos, loading, error, add, update, remove, expiringSoon, getDaysUntil }
}
