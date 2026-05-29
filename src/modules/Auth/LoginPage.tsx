import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Activity, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

const AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential':
    'Email o contraseña incorrectos. Verificá que hayas reseteado la contraseña desde la consola de Firebase.',
  'auth/invalid-login-credentials':
    'Email o contraseña incorrectos.',
  'auth/user-not-found':
    'No existe ninguna cuenta con ese email en el sistema.',
  'auth/wrong-password':
    'Contraseña incorrecta. Podés resetearla desde la consola de Firebase.',
  'auth/invalid-email':
    'El formato del email no es válido.',
  'auth/user-disabled':
    'Tu cuenta está deshabilitada. Contactá a sistemas.TI@bacarsa.com.ar',
  'auth/too-many-requests':
    'Demasiados intentos fallidos. La cuenta está temporalmente bloqueada. Esperá unos minutos o reseteá tu contraseña.',
  'auth/network-request-failed':
    'Sin conexión a internet. Verificá tu red e intentá de nuevo.',
  'auth/operation-not-allowed':
    '⚠️ El inicio de sesión con email/contraseña NO está habilitado en Firebase. Ir a: Firebase Console → Authentication → Sign-in method → Email/Password → Habilitar.',
  'auth/missing-password':
    'Ingresá tu contraseña.',
  'auth/missing-email':
    'Ingresá tu email.',
}

function getErrorMessage(err: unknown): { message: string; code: string } {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: string }).code
    const message = AUTH_ERRORS[code]
      ?? `Error al iniciar sesión (código: ${code}). Contactá a sistemas.TI@bacarsa.com.ar`
    return { message, code }
  }
  const raw = err instanceof Error ? err.message : String(err)
  return { message: `Error inesperado: ${raw}`, code: 'unknown' }
}

export function LoginPage() {
  const { login, user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-sm text-muted-foreground animate-pulse">Cargando…</span>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim() || !password) {
      setErrorMsg('Completá el email y la contraseña.')
      return
    }
    setLoading(true)
    setErrorMsg(null)

    try {
      await login(email.trim().toLowerCase(), password)
      navigate('/', { replace: true })
    } catch (err) {
      console.error('[IT Ops Hub] Error de login:', err)
      const { message } = getErrorMessage(err)
      setErrorMsg(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">

        {/* Brand */}
        <div className="text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Activity className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">IT Ops Hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Iniciá sesión con tu cuenta corporativa
          </p>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 rounded-lg border border-border bg-card p-6"
        >
          {/* Email */}
          <div className="space-y-1.5">
            <label htmlFor="email" className="block text-sm font-medium text-foreground">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@admin.com"
                disabled={loading}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label htmlFor="password" className="block text-sm font-medium text-foreground">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                disabled={loading}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {errorMsg && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className={cn(
              'flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity',
              loading ? 'cursor-not-allowed opacity-60' : 'hover:opacity-90'
            )}
          >
            {loading ? (
              <>
                <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Iniciando sesión…
              </>
            ) : (
              'Ingresar'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          ¿No tenés acceso?{' '}
          <a
            href="mailto:sistemas.TI@bacarsa.com.ar"
            className="text-primary hover:underline"
          >
            Contactá a IT
          </a>
        </p>
      </div>
    </div>
  )
}
