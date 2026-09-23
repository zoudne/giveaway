import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { instagramPlugin } from './server/instagram.ts'

export default defineConfig({
  plugins: [react(), instagramPlugin()],
  preview: {
    host: '0.0.0.0',
    port: Number(process.env.PORT) || 3000,
    allowedHosts: true,
  },
})
