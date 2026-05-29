import { useEffect, useState } from 'react'
import { onAuthStateChanged, type User } from 'firebase/auth'
import { getBacarPassFirebase } from '@/config/bacarpassFirebase'

/**
 * Estado de sesión Firebase (misma app que BacarPass / IT Ops Hub).
 * Para acciones de login/logout usá {@link useAuth} desde AuthContext.
 */
export function useFirebaseAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { auth } = getBacarPassFirebase()
    return onAuthStateChanged(auth, u => {
      setUser(u)
      setLoading(false)
    })
  }, [])

  return { user, loading }
}
