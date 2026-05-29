import path from 'path'
import type { ServerResponse } from 'http'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Mismo backend para NVR, tickets y Omada; si no corre, Vite devolvía 500 opaco (ECONNREFUSED). */
function itOpsProxy() {
  return {
    target: 'http://127.0.0.1:3001',
    changeOrigin: true,
    configure: (proxy: { on: (e: string, fn: (...args: unknown[]) => void) => void }) => {
      proxy.on('error', (_err: unknown, _req: unknown, res: unknown) => {
        const r = res as ServerResponse
        if (r?.writeHead && !r.headersSent) {
          r.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' })
          r.end(
            JSON.stringify({
              error:
                'Proxy IT Ops no disponible (puerto 3001). En otra terminal: cd server && npm start',
            }),
          )
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/nvr': itOpsProxy(),
      '/api/nvrs': itOpsProxy(),
      '/api/tickets-proxy': itOpsProxy(),
      '/api/omada': itOpsProxy(),
    },
  },
})
