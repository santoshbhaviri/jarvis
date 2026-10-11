// Setup check: each key, whether it works, and the one thing to do if it doesn't.
// The check runs on Jarvis's server, so no key ever reaches the phone. The Claude row has a box
// for pasting your Claude key and shows what Claude has cost this month.
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { CircleCheck, CircleAlert, RotateCw } from 'lucide-react'
import { format } from 'date-fns'
import { checkSetup, connectClaude, disconnectClaude } from '../lib/server'
import { BUILT } from '../lib/constants'
import styles from './SetupCheck.module.css'

export default function SetupCheck() {
  const [checks, setChecks] = useState(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async () => {
    setBusy(true)
    const res = await checkSetup()
    setBusy(false)
    setChecks(res.error
      ? [{ name: 'Setup check', ok: false, fix: res.error === 'offline' ? 'No internet connection.' : 'Could not run the check. Try again.' }]
      : res.checks)
  }, [])
  useEffect(() => { run() }, [run])

  return (
    <section className={styles.card} aria-label="Setup check">
      <div className={styles.head}>
        <span className={styles.title}>Setup check</span>
        <button className={styles.again} onClick={run} disabled={busy}><RotateCw size={14} className={busy ? styles.spin : ''} />Check again</button>
      </div>
      {!checks
        ? <p className={styles.muted}>Checking your keys…</p>
        : (
          <ul className={styles.rows}>
            {checks.map(c => (
              <li key={c.name}>
                {c.ok ? <CircleCheck size={18} className={styles.ok} /> : <CircleAlert size={18} className={styles.bad} />}
                <div className={styles.body}>
                  <div className={styles.name}>{c.name}{c.ok && <span className={styles.works}> works</span>}</div>
                  {c.fix && <p className={styles.fix}>{c.fix}</p>}
                  {c.note && <p className={styles.note}>{c.note}</p>}
                  {c.id === 'claude' && c.paste && <ClaudeKey onDone={run} />}
                  {c.id === 'claude' && !c.paste && c.where === 'jarvis' && <RemoveClaude onDone={run} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      {checks?.some(c => !c.ok && c.id !== 'claude') && (
        <p className={styles.muted}>After changing a key in Netlify, open Deploys, tap Trigger deploy, wait for Published, then tap Check again.</p>
      )}
      <p className={styles.muted}>This Jarvis: {location.hostname}, updated {format(BUILT, 'd MMM, h:mm a')}</p>
    </section>
  )
}

// Paste the key from platform.claude.com (API keys); Jarvis tries it before keeping it
function ClaudeKey({ onDone }) {
  const [key, setKey] = useState('')
  const [saving, setSaving] = useState(false)
  const save = async (e) => {
    e.preventDefault()
    if (!key.trim() || saving) return
    setSaving(true)
    const res = await connectClaude(key)
    setSaving(false)
    if (res.error) { toast.error(res.why || 'Could not save the key. Try again.', { duration: 6000 }); return }
    setKey('')
    if (res.warn) toast(res.warn, { duration: 7000 })
    else toast.success('Claude is connected. Search and Assist answer with Claude now.', { duration: 5000 })
    onDone()
  }
  return (
    <form className={styles.paste} onSubmit={save}>
      <input value={key} onChange={e => setKey(e.target.value)} placeholder="sk-ant-…" aria-label="Claude key"
        autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
      <button type="submit" disabled={!key.trim() || saving}>{saving ? 'Checking…' : 'Save'}</button>
    </form>
  )
}

// Forget the key (Gemini answers again); asks once more first
function RemoveClaude({ onDone }) {
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t) }, [sure])
  const remove = async () => {
    const res = await disconnectClaude()
    if (res.error) { toast.error(res.why || 'Could not remove the key. Try again.'); return }
    toast.success('Claude key removed')
    onDone()
  }
  return sure
    ? <button className={styles.remove} onClick={remove}>Remove the key?</button>
    : <button className={styles.remove} onClick={() => setSure(true)}>Remove key</button>
}
