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
