import { useCallback, useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  doc,
} from 'firebase/firestore'
import { getBacarPassFirebase } from '@/config/bacarpassFirebase'
import type { BacarPassCredential } from '@/types'

function getBacarPassCollection() {
  const { db } = getBacarPassFirebase()
  return collection(
    doc(
      collection(
        doc(collection(db, 'artifacts'), 'bacarpass-v1'),
        'public'
      ),
      'data'
    ),
    'passwords'
  )
}

export function useBacarPassCredentials() {
  const [credentials, setCredentials] = useState<BacarPassCredential[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCredentials = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const col = getBacarPassCollection()
      const snapshot = await getDocs(col)
      const list: BacarPassCredential[] = []
      snapshot.forEach((d) => {
        const data = d.data()
        list.push({
          id: d.id,
          title: (data['title'] as string) ?? '',
          username: (data['username'] as string) ?? '',
          passwordValue: (data['passwordValue'] as string) ?? '',
          url: (data['url'] as string) ?? '',
          tag: (data['tag'] as string) ?? '',
        })
      })
      setCredentials(list)
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Error al cargar credenciales BacarPass'
      setError(message)
      setCredentials([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCredentials()
  }, [fetchCredentials])

  return { credentials, loading, error, refetch: fetchCredentials }
}
