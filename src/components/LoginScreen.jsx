// src/components/LoginScreen.jsx
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './LoginScreen.module.css'

export default function LoginScreen({ onSignIn, onSignUp }) {
  const [mode, setMode]         = useState('in')
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy]         = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true)
    const { data, error } = mode === 'in' ? await onSignIn(email, password) : await onSignUp(email, password)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    if (mode === 'up' && !data.session) toast.success('Check your email and tap the link to confirm, then sign in.', { duration: 8000 })
  }

  return (
    <div className={styles.wrap}>
      <form className={styles.card} onSubmit={submit}>
        <div className={styles.brand}><span>⚡</span> JARVIS</div>
        <p className={styles.sub}>{mode === 'in' ? 'Sign in to see your tasks.' : 'Create your account. Only you will see your tasks.'}</p>
        <label className={styles.label} htmlFor="email">Email</label>
        <input id="email" className={styles.input} type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        <label className={styles.label} htmlFor="password">Password</label>
        <input id="password" className={styles.input} type="password" minLength={8} required
          autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
          value={password} onChange={e => setPassword(e.target.value)} />
        <button className={styles.btn} disabled={busy}>{busy ? '…' : mode === 'in' ? 'Sign in' : 'Create account'}</button>
        <button type="button" className={styles.link} onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'First time? Create an account' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  )
}
