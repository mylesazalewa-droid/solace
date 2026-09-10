import { resolve } from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standalone renderer dev server for browser-only visual work (no Electron).
// The real app uses electron.vite.config.ts.
export default defineConfig({
  root: 'src/renderer',
  resolve: { alias: { '@': resolve(__dirname, 'src/renderer/src') } },
  plugins: [react()],
  server: { port: 5178 }
})
