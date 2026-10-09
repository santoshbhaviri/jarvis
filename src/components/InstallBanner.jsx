// Offers to put Jarvis on the home screen so it opens like a normal app.
// Android / Chrome: one-tap install. iPhone: Safari's steps (Chrome and apps such as
// WhatsApp or Gmail cannot add to the home screen, so it asks you to open Safari).
// Hidden once installed, or after ×.
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './InstallBanner.module.css'

const DISMISS_KEY = 'jarvis-install-dismissed'

const isInstalled = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true
const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
// Real Safari, not Chrome/Firefox/Edge or a browser inside another app
const isSafari = () => {
  const ua = navigator.userAgent
  return /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\/|fban|fbav|instagram|line\/|whatsapp|gmail|linkedin|twitter|snapchat|claude/i.test(ua)
}

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(() => window.__installPrompt || null)
  const [steps, setSteps]   = useState(false)
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
    if (!prompt) { setSteps(s => !s); return }
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    window.__installPrompt = null
    setPrompt(null)
    if (outcome === 'accepted') setHidden(true)
  }
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(location.origin); toast.success('Link copied. Paste it in Safari.') }
    catch { toast(`Open ${location.host} in Safari`) }
  }

  return (
    <div className={styles.banner} role="region" aria-label="Install Jarvis">
      <div className={styles.top}>
        <img src="/icon-192.png" alt="" className={styles.icon} />
        <strong className={styles.title}>Add Jarvis to your Home Screen</strong>
        <button className={styles.install} onClick={install}>{prompt ? 'Install' : steps ? 'Hide' : 'Show me'}</button>
        <button className={styles.close} onClick={dismiss} aria-label="Not now">×</button>
      </div>

      {steps && ios && isSafari() && (
        <ol className={styles.steps}>
          <li>Tap <b>Share</b> <ShareIcon />. On newer iPhones, tap <b>•••</b> first, then <b>Share</b>.</li>
          <li>Scroll down and tap <b>Add to Home Screen</b>. If you don't see it, tap <b>View More</b>.</li>
          <li>Keep <b>Open as Web App</b> on, then tap <b>Add</b>.</li>
        </ol>
      )}
      {steps && ios && !isSafari() && (
        <div className={styles.steps}>
          <p>This only works in <b>Safari</b>. Copy the link, open Safari, paste it and tap Go. Then tap Show me again.</p>
          <button className={styles.install} onClick={copyLink}>Copy link</button>
        </div>
      )}
    </div>
  )
}

function ShareIcon() {
  return (
    <svg className={styles.share} viewBox="0 0 24 24" width="16" height="16" aria-label="Share icon" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v12M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  )
}
