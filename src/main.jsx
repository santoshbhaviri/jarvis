import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/global.css'

// Chrome may offer the install prompt before the app has drawn; keep it for the Install button
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installPrompt = e })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" toastOptions={{
      style: { fontFamily:'var(--font-body)', fontSize:'13px', fontWeight:600,
        borderRadius:'99px', padding:'10px 18px', background:'var(--surface)',
        color:'var(--text)', border:'1px solid var(--border2)', boxShadow:'var(--shadow)' },
      success: { iconTheme:{ primary:'var(--done)', secondary:'var(--surface)' } },
      error:   { iconTheme:{ primary:'var(--danger)', secondary:'var(--surface)' } },
    }} />
  </React.StrictMode>
)

// Installable app + reminders (see public/sw.js)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}
