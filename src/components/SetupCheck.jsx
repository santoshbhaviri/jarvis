// Setup check: each key in Netlify, whether it works, and the one thing to do if it doesn't.
// The check runs on Jarvis's server, so no key ever reaches the phone.
import { useState, useEffect, useCallback } from 'react'
import { CircleCheck, CircleAlert, RotateCw } from 'lucide-react'
import { checkSetup } from '../lib/server'
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
                <div>
                  <div className={styles.name}>{c.name}{c.ok && <span className={styles.works}> works</span>}</div>
                  {c.fix && <p className={styles.fix}>{c.fix}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      {checks?.some(c => !c.ok) && (
        <p className={styles.muted}>After changing a key in Netlify, open Deploys, tap Trigger deploy, wait for Published, then tap Check again.</p>
      )}
    </section>
  )
}
