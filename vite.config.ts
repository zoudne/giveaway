import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { instagramPlugin } from './server/instagram.ts'

export default defineConfig({
  plugins: [react(), instagramPlugin()],
})
