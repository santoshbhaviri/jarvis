import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Each build gets an id, baked into the app and written to /version.json, so an open
// Jarvis can tell when a newer one has gone live (see src/main.jsx)
const BUILD = Date.now().toString(36)
const version = {
  name: 'jarvis-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) },
}

export default defineConfig({ plugins: [react(), version], define: { __BUILD__: JSON.stringify(BUILD) } })
