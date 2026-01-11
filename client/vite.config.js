import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    copyPublicDir: true
  },
  publicDir: 'public',
  server: {
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
