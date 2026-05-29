/**
 * Cliente para la API externa de contraseñas/credenciales.
 * URL y token desde variables de entorno.
 */

function getApiUrl(): string {
  const url = import.meta.env.VITE_CREDENTIALS_API_URL
  if (!url) throw new Error('VITE_CREDENTIALS_API_URL no está definida en .env')
  return url.replace(/\/$/, '')
}

function getApiToken(): string {
  const token = import.meta.env.VITE_CREDENTIALS_API_TOKEN
  return token ?? ''
}

export interface CredentialItem {
  id?: string
  name?: string
  service?: string
  type?: string
  updatedAt?: string
  [key: string]: unknown
}

export interface CredentialsApiResponse {
  success?: boolean
  data?: CredentialItem[]
  credentials?: CredentialItem[]
  [key: string]: unknown
}

/**
 * Obtiene la lista de credenciales desde la API externa.
 * Usa VITE_CREDENTIALS_API_URL y VITE_CREDENTIALS_API_TOKEN.
 */
export async function fetchCredentials(): Promise<CredentialsApiResponse> {
  const baseUrl = getApiUrl()
  const token = getApiToken()
  const headers: HeadersInit = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(baseUrl, {
    method: 'GET',
    headers,
  })
  if (!res.ok) {
    throw new Error(`Credenciales API: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<CredentialsApiResponse>
}

/**
 * Comprueba si la API de credenciales está configurada (sin lanzar petición).
 */
export function isCredentialsApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CREDENTIALS_API_URL)
}
