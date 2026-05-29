import { useMemo, useState } from 'react'
import { Copy, Eye, EyeOff, Key, RefreshCw, Search } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useBacarPassCredentials } from '@/hooks/useBacarPassCredentials'
import type { BacarPassCredential } from '@/types'
import { cn } from '@/lib/utils'

const MASK = '••••••••'

function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

function CredentialRow({
  cred,
  revealedIds,
  toggleReveal,
}: {
  cred: BacarPassCredential
  revealedIds: Set<string>
  toggleReveal: (id: string) => void
}) {
  const [copiedField, setCopiedField] = useState<'user' | 'pass' | null>(null)
  const revealed = revealedIds.has(cred.id)
  const passwordDisplay = revealed ? cred.passwordValue : MASK

  const handleCopy = (field: 'user' | 'pass', value: string) => {
    copyToClipboard(value).then(() => {
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 1500)
    })
  }

  return (
    <tr className="border-b border-border hover:bg-muted/30">
      <td className="px-3 py-2 text-sm font-medium">{cred.title || '—'}</td>
      <td className="px-3 py-2 font-mono text-sm">{cred.username || '—'}</td>
      <td className="px-3 py-2 font-mono text-sm">
        {passwordDisplay}
      </td>
      <td className="px-3 py-2 text-sm text-muted-foreground">{cred.tag || '—'}</td>
      <td className="px-3 py-2 text-sm">
        {cred.url ? (
          <a
            href={cred.url.startsWith('http') ? cred.url : `https://${cred.url}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline truncate max-w-[120px] inline-block"
          >
            {cred.url}
          </a>
        ) : (
          '—'
        )}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleCopy('user', cred.username)}
            title="Copiar usuario"
          >
            {copiedField === 'user' ? (
              <span className="text-xs text-signal-success">OK</span>
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => handleCopy('pass', cred.passwordValue)}
            title="Copiar contraseña"
          >
            {copiedField === 'pass' ? (
              <span className="text-xs text-signal-success">OK</span>
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => toggleReveal(cred.id)}
            title={revealed ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {revealed ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
        </div>
      </td>
    </tr>
  )
}

export function CredentialVault() {
  const { credentials, loading, error, refetch } = useBacarPassCredentials()
  const [search, setSearch] = useState('')
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    if (!search.trim()) return credentials
    const q = search.trim().toLowerCase()
    return credentials.filter(
      (c) =>
        (c.title && c.title.toLowerCase().includes(q)) ||
        (c.tag && c.tag.toLowerCase().includes(q)) ||
        (c.username && c.username.toLowerCase().includes(q))
    )
  }, [credentials, search])

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          BacarPass – Credenciales
        </CardTitle>
        <Button variant="outline" size="sm" onClick={refetch} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          <span className="ml-2">Actualizar</span>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por título o tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {loading && (
          <p className="text-sm text-muted-foreground">Cargando credenciales…</p>
        )}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        {!loading && !error && filtered.length === 0 && (
          <p className="text-sm text-muted-foreground">
            {credentials.length === 0
              ? 'No hay credenciales o no tienes acceso.'
              : 'Ningún resultado para la búsqueda.'}
          </p>
        )}
        {!loading && filtered.length > 0 && (
          <div className="overflow-x-auto rounded-md border border-border">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Título
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Usuario
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contraseña
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Tag
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    URL
                  </th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider w-[120px]">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((cred) => (
                  <CredentialRow
                    key={cred.id}
                    cred={cred}
                    revealedIds={revealedIds}
                    toggleReveal={toggleReveal}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
