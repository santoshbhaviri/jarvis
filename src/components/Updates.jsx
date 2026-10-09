// Updates: changes Claude has built for Jarvis, waiting for you, and requests still being built.
// Try one, ask for a change, or drop it, all from here. Putting one live is a Merge tap on GitHub.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { changeUpdate, dropUpdate } from '../lib/server'
import styles from './Updates.module.css'

export default function Updates({ data, onClose, onChanged }) {
  const { updates = [], building = [] } = data || {}
  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.sheet} role="dialog" aria-label="Updates" onClick={e => e.stopPropagation()}>
        <div className={styles.head}>
          <strong>Updates</strong>
          <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        </div>
        {updates.length === 0 && building.length === 0 && <p className={styles.none}>Nothing waiting.</p>}
        {updates.map(u => <Update key={u.number} u={u} onChanged={onChanged} />)}
        {building.length > 0 && (
          <>
            <div className={styles.label}>Being built</div>
            {building.map(b => <div key={b.number} className={styles.building}>{b.title}</div>)}
          </>
        )}
      </div>
    </div>
  )
}

function Update({ u, onChanged }) {
  const [changing, setChanging] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const act = async (fn, done) => {
    setBusy(true)
    const res = await fn()
    setBusy(false)
    if (res.error) { toast.error('Could not reach GitHub. Try again.'); return }
    toast.success(done)
    setChanging(false); setNote('')
    onChanged()
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>{u.title}</div>
      {u.summary && <div className={styles.summary}>{u.summary}</div>}
      <div className={styles.actions}>
        <a className={styles.btn} href={u.preview} target="_blank" rel="noreferrer">Try it</a>
        <a className={`${styles.btn} ${styles.primary}`} href={u.url} target="_blank" rel="noreferrer">Put live ↗</a>
        <button className={styles.btn} onClick={() => setChanging(c => !c)}>Change</button>
        <button className={`${styles.btn} ${styles.quiet}`} disabled={busy}
          onClick={() => act(() => dropUpdate(u.number), 'Dropped')}>Drop</button>
      </div>
      {changing && (
        <form className={styles.change} onSubmit={e => { e.preventDefault(); note.trim() && act(() => changeUpdate(u.number, note), 'Sent to Claude') }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What should be different?" aria-label="Change request" />
          <button className={`${styles.btn} ${styles.primary}`} disabled={!note.trim() || busy}>Send</button>
        </form>
      )}
    </div>
  )
}
