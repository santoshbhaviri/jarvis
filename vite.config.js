import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Each build gets an id, baked into the app and written to /version.json, so an open
// Jarvis can tell when a newer one has gone live (see src/main.jsx)
const BUILD = Date.now().toString(36)
const version = {
  name: 'jarvis-version',
  generateBundle() { this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ build: BUILD }) }) },
}

// pdf.js decodes the images in some scanned PDFs (fax and JPEG 2000) with these, loaded by
// name from /pdfjs/ (see src/lib/library.js)
const pdfjsDecoders = {
  name: 'pdfjs-decoders',
  generateBundle() {
    for (const f of ['jbig2_nowasm_fallback.js', 'openjpeg_nowasm_fallback.js']) {
      this.emitFile({ type: 'asset', fileName: `pdfjs/${f}`, source: readFileSync(new URL(`./node_modules/pdfjs-dist/wasm/${f}`, import.meta.url)) })
    }
  },
}

export default defineConfig({
  plugins: [react(), version, pdfjsDecoders],
  define: { __BUILD__: JSON.stringify(BUILD) },
  worker: { format: 'es' },   // pdf.js's reader runs as a module worker
})
