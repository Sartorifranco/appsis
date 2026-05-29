/**
 * IT Ops Hub - Modelos de datos centralizados
 */

/** Cámara IP / NVR */
export interface Camara {
  id: string
  nombre: string
  ip: string
  user: string
  pass: string
  nvrId: string
  estaGrabando: boolean
  status: 'online' | 'offline' | 'error' | 'mantenimiento'
}

export type MonedaGasto     = 'ARS' | 'USD' | 'EUR'
export type CategoriaGasto  = 'software' | 'dominio' | 'infraestructura' | 'seguridad' | 'comunicaciones' | 'otro'
export type FrecuenciaGasto = 'mensual' | 'anual' | 'unico'

/** Gasto SaaS / Licencias */
export interface GastoSaaS {
  id: string
  servicio: string
  descripcion?: string
  monto: number
  moneda: MonedaGasto
  /** Fecha ISO YYYY-MM-DD de próxima renovación */
  proximaRenovacion: string
  categoria: CategoriaGasto
  frecuencia: FrecuenciaGasto
  activo: boolean
}

/** Nodo de red (Omada, switch, AP, etc.) */
export interface NodoRed {
  id: string
  nombre: string
  ip: string
  tipo: 'switch' | 'ap' | 'gateway' | 'controller' | 'otro'
  status: 'online' | 'offline' | 'warning' | 'unknown'
}

export type TicketEstado    = 'abierto' | 'en_progreso' | 'resuelto' | 'cerrado'
export type TicketPrioridad = 'baja' | 'media' | 'alta' | 'critica'
export type TicketCategoria = 'hardware' | 'software' | 'red' | 'accesos' | 'camaras' | 'otro'

/** Ticket de soporte */
export interface Ticket {
  id: string
  titulo: string
  descripcion?: string
  estado: TicketEstado
  prioridad: TicketPrioridad
  categoria: TicketCategoria
  /** Nombre del dev/técnico asignado */
  asignadoA?: string
  reportadoPor?: string
  creadoEn: string       // ISO string
  actualizadoEn: string  // ISO string
  resueltoEn?: string    // ISO string (se completa al cerrar)
}

/** Credencial (API externa, servicio) */
export interface Credencial {
  id: string
  nombre: string
  servicio: string
  tipo: 'api' | 'web' | 'vpn' | 'otro'
  ultimaActualizacion: string
}

/** Miembro del equipo */
export interface MiembroEquipo {
  id: string
  nombre: string
  rol: string
  email: string
  departamento?: string
}

// ── NVR / Cámaras ────────────────────────────────────────────────────────────

/** Estado consolidado de un canal del NVR */
export type NvrChannelStatus = 'recording' | 'motion' | 'online' | 'offline' | 'checking' | 'error'

export interface NvrChannel {
  id: number
  name?: string
  videoStatus: string
  recordMode: string
  recording: boolean
  online: boolean
  /** Canal configurado para grabar por movimiento (no necesariamente activo ahora) */
  motionReady?: boolean
  /** Bitrate de entrada en kbps (> 0 confirma flujo activo) */
  bitRate?: number
  /** Estado calculado para el indicador visual */
  status: NvrChannelStatus
  error?: string
}

export interface NvrHdd {
  id: string
  status: string
  capacityMB: number
  freeMB: number
}

export interface NvrStatus {
  nvrId?: number
  nvrName?: string
  configured: boolean
  brand?: string
  hdds: NvrHdd[]
  channels: NvrChannel[]
  hddError?: string | null
  channelError?: string | null
  error?: string
}

/** Info básica de un NVR configurado (devuelto por /api/nvrs) */
export interface NvrInfo {
  id: number
  name: string
  brand: string
  url: string
  channelCount: number
}

// ── Documentación dinámica ────────────────────────────────────────────────────

export type CategoriaDoc =
  | 'procedimiento'
  | 'configuracion'
  | 'troubleshooting'
  | 'referencia'
  | 'tutorial'
  | 'otro'

/** Entrada de documentación (Firestore: itops_docs) */
export interface DocEntry {
  id: string
  titulo: string
  /** Descripción corta visible en el listado */
  resumen?: string
  categoria: CategoriaDoc
  tags: string[]
  /** Contenido en Markdown */
  contenido: string
  creadoEn: string
  actualizadoEn: string
  autor?: string
}

export type CategoriaArchivo =
  | 'software'
  | 'script'
  | 'driver'
  | 'utilidad'
  | 'manual'
  | 'imagen'
  | 'otro'

/** Archivo / programa subido (Firestore: itops_archivos, Storage: it-ops/files/) */
export interface ArchivoIT {
  id: string
  nombre: string
  descripcion?: string
  categoria: CategoriaArchivo
  tags: string[]
  /** URL de descarga en Firebase Storage */
  fileUrl: string
  fileName: string
  fileSize: number
  fileType: string
  creadoEn: string
  subidoPor?: string
}

// ── BacarPass ──────────────────────────────────────────────────────────────────

/** Credencial BacarPass (Firestore: artifacts/bacarpass-v1/public/data/passwords) */
export interface BacarPassCredential {
  id: string
  title: string
  username: string
  passwordValue: string
  url: string
  tag: string
}
