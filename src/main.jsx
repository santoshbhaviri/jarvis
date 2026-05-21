import React from 'react'
import ReactDOM from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/global.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
    <Toaster position="top-center" toastOptions={{
      style: { fontFamily:'var(--font-body)', fontSize:'13px', fontWeight:600,
        borderRadius:'99px', padding:'10px 18px', background:'#1a1d2e',
        color:'#f0f2ff', border:'1px solid rgba(255,255,255,0.1)' },
      success: { iconTheme:{ primary:'#22c55e', secondary:'#1a1d2e' } },
      error:   { iconTheme:{ primary:'#ef4444', secondary:'#1a1d2e' } },
    }} />
  </React.StrictMode>
)
