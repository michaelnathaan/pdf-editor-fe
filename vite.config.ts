// vite.config.ts
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // Load env variables
  const env = loadEnv(mode, process.cwd(), '')

  const PORT = Number(env.VITE_API_PORT) || 5173

  return {
    plugins: [react()],
    server: {
      port: PORT,
      // proxy: {
      //   '/api': {
      //     target: env.VITE_API_URL || 'http://localhost:8000',
      //     changeOrigin: true,
      //   }
      // }
    },
    optimizeDeps: {
      include: ['pdfjs-dist']
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            pdfjs: ['pdfjs-dist']
          }
        }
      }
    }
  }
})
