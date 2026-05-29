/**
 * Re-exporta desde nvrApi.ts para mantener compatibilidad con importaciones antiguas.
 * @deprecated Importar directamente desde '@/services/nvrApi'
 */
export {
  fetchNvrStatus as fetchNvrFullStatus,
  fetchRecordingStatus,
  checkNvrProxy,
} from './nvrApi'
