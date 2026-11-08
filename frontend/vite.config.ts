import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react(), { name: 'sample-entry-isolation', configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (mode !== 'samples' && (req.url?.startsWith('/samples.html') || req.url?.startsWith('/src/samples/'))) { res.statusCode = 404; res.end('Not found'); return }
      next()
    })
  } }],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 5173, strictPort: true },
}))
