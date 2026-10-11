import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
// Fonts come with the app (work offline, nothing loaded from Google)
import '@fontsource-variable/inter'
import '@fontsource/instrument-serif/400.css'
import './styles/global.css'

// Chrome may offer the install prompt before the app has drawn; keep it for the Install button
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" toastOptions={{
      style: { fontFamily:'var(--font-body)', fontSize:'13.5px', fontWeight:500,
        borderRadius:'16px', padding:'11px 16px', background:'var(--toast-bg)',
        color:'var(--toast-text)', boxShadow:'var(--shadow-lg)', maxWidth:'92vw' },
      success: { iconTheme:{ primary:'var(--gold)', secondary:'var(--toast-bg)' } },
      error:   { iconTheme:{ primary:'var(--danger)', secondary:'var(--toast-bg)' } },
    }} />
  </React.StrictMode>
)

// Installable app + reminders (see public/sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

// A home-screen app keeps showing the copy it opened with. Each time you come back to
// Jarvis, check whether a newer one went live and switch to it (once per new version).
if (import.meta.env.PROD) {
  const latest = async () => {
    try {
      const { build } = await (await fetch('/version.json', { cache: 'no-store' })).json()
      if (build && build !== __BUILD__ && sessionStorage.getItem('jarvis-reloaded') !== build) {
        sessionStorage.setItem('jarvis-reloaded', build)
        location.reload()
      }
    } catch { /* offline: keep the copy we have */ }
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') latest() })
  latest()
}
