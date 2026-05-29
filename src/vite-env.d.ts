/// <reference types="vite/client" />

// Permite importar archivos de texto con el sufijo ?raw
// Ej: import content from './file.md?raw'
declare module '*?raw' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string
  readonly VITE_FIREBASE_AUTH_DOMAIN: string
  readonly VITE_FIREBASE_PROJECT_ID: string
  readonly VITE_FIREBASE_STORAGE_BUCKET: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string
  readonly VITE_FIREBASE_APP_ID: string
  /** URL base del controlador Omada (ej. https://omada.ejemplo.com:8043) */
  readonly VITE_OMADA_BASE_URL?: string
  readonly VITE_OMADA_USERNAME?: string
  readonly VITE_OMADA_PASSWORD?: string
  /** IPs de cámaras separadas por coma (ej. 192.168.1.10,192.168.1.11) */
  readonly VITE_CAMERA_IPS?: string
  /** Puerto para comprobar si las cámaras responden (por defecto 80) */
  readonly VITE_CAMERA_CHECK_PORT?: string
  /** URL de la API externa de contraseñas/credenciales */
  readonly VITE_CREDENTIALS_API_URL?: string
  /** Token de acceso para la API de credenciales (Bearer) */
  readonly VITE_CREDENTIALS_API_TOKEN?: string
  /** BacarPass – segunda app Firebase (legajosonline-959f6) */
  readonly VITE_BACARPASS_PROJECT_ID?: string
  readonly VITE_BACARPASS_APP_ID?: string
  readonly VITE_BACARPASS_API_KEY?: string
  readonly VITE_BACARPASS_AUTH_DOMAIN?: string
  readonly VITE_BACARPASS_STORAGE_BUCKET?: string
  readonly VITE_BACARPASS_MESSAGING_SENDER_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
