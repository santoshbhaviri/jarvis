// src/components/InstallBanner.jsx
// Offers to put Jarvis on the home screen so it opens like a normal app.
// Android / Chrome: one-tap install. iPhone / Safari: shows the Share → Add to Home Screen steps.
// Hidden once installed, or after "Not now".
import { useEffect, useState } from 'react'
import styles from './InstallBanner.module.css'

const DISMISS_KEY = 'jarvis-install-dismissed'

const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null)
  const [hidden, setHidden] = useState(() => {
    try { return isInstalled() || localStorage.getItem(DISMISS_KEY) === '1' } catch { return isInstalled() }
  })

  useEffect(() => {
    const onPrompt = (e) => { e.preventDefault(); window.__installPrompt = e; setPrompt(e) }
    const onInstalled = () => setHidden(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const ios = isIOS()
  if (hidden || (!prompt && !ios)) return null

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* private mode */ }
    setHidden(true)
  }
  const install = async () => {
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__installPrompt = null
    setPrompt(null)
    if (outcome === 'accepted') setHidden(true)
  }

  return (
    <div className={styles.banner} role="region" aria-label="Install Jarvis">
      <img src="/icon-192.png" alt="" className={styles.icon} />
      <div className={styles.text}>
        <strong>Use Jarvis as an app</strong>
        {prompt
          ? <span>Opens from your home screen, full screen, no browser bar.</span>
          : <span>In Safari, tap <b>Share</b> <span aria-hidden="true">⬆︎</span> then <b>Add to Home Screen</b>.</span>}
      </div>
      <div className={styles.actions}>
        {prompt && <button className={styles.install} onClick={install}>Install</button>}
        <button className={styles.later} onClick={dismiss}>Not now</button>
      </div>
    </div>
  )
}
