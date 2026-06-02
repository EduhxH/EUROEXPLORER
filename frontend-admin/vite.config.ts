// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/admin-panel/',
  plugins: [react()],
  server: {
    port: 3000
  }
})
