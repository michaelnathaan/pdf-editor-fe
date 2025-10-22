import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const PORT = process.env.VITE_API_PORT;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // proxy: {
    //   '/api': {
    //     target: API_URL || 'http://localhost:8000',
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
          'pdfjs': ['pdfjs-dist']
        }
      }
    }
  }
})