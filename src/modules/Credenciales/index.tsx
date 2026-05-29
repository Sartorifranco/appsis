import { useCallback, useEffect, useState } from 'react'
import { Key, RefreshCw } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  fetchCredentials,
  isCredentialsApiConfigured,
  type CredentialItem,
  type CredentialsApiResponse,
} from '@/services/credentialsApi'
import { CredentialVault } from './CredentialVault'

function CredentialsList({ data }: { data: CredentialsApiResponse }) {
  const list =
    Array.isArray(data.data) ? data.data : Array.isArray(data.credentials) ? data.credentials : []
  if (list.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No hay credenciales en la respuesta o el formato no es el esperado.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {list.map((item: CredentialItem, i: number) => (
        <li
          key={item.id ?? i}
          className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
        >
          <span className="font-medium">{item.name ?? item.service ?? 'Sin nombre'}</span>
          {item.service != null && (
            <span className="text-muted-foreground">{String(item.service)}</span>
          )}
        </li>
      ))}
    </ul>
  )
}

export function CredencialesPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<CredentialsApiResponse | null>(null)

  const load = useCallback(async () => {
    if (!isCredentialsApiConfigured()) {
      setError(null)
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchCredentials()
      setData(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar credenciales')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-semibold">Credenciales</h1>
      <div className="space-y-6">
        <CredentialVault />
        {!isCredentialsApiConfigured() && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Key className="h-5 w-5" />
                API externa de contraseñas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Opcional: configura <code className="rounded bg-muted px-1">VITE_CREDENTIALS_API_URL</code> y
                <code className="ml-1 rounded bg-muted px-1">VITE_CREDENTIALS_API_TOKEN</code> en tu .env.
              </p>
            </CardContent>
          </Card>
        )}
        {isCredentialsApiConfigured() && (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            API externa de contraseñas
          </CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            <span className="ml-2">Actualizar</span>
          </Button>
        </CardHeader>
        <CardContent>
          {loading && !data && (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          )}
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {data && !loading && <CredentialsList data={data} />}
        </CardContent>
      </Card>
        )}
      </div>
    </div>
  )
}
