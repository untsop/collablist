import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    },
    allowedHosts: [
      'localhost',
      '.spdso.app',
      '.dev.spdso.app',
      'speed.so',
      'speed-app.pages.dev',
      '.speed-app.pages.dev'
    ],
    cors: {
      origin: [
        'http://localhost:5173',
        'http://localhost:5177',
        'https://speed.so',
        'https://speed-app.pages.dev',
        'https://*.speed-app.pages.dev',
        'https://*.spdso.app',
        'https://*.dev.spdso.app'
      ],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }
  }
})
