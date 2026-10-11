// Evolve: tell Jarvis what it should do better. Claude builds it (every morning), it shows up
// here to try, and Approve puts it live. Nothing changes without your Approve.
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, ArrowUpRight } from 'lucide-react'
import { sendRequest, approveUpdate, changeUpdate, dropUpdate } from '../lib/server'
import { improveLink } from '../lib/assistant'
import CommandBox from './CommandBox'
import SectionHeader from './SectionHeader'
import styles from './EvolveTab.module.css'

const ago = (d) => { try { return formatDistanceToNowStrict(new Date(d), { addSuffix: true }) } catch { return '' } }

export default function EvolveTab({ data, ready, onChanged }) {
  const { updates = [], building = [], done = [] } = data || {}
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { onChanged() }, [onChanged])   // fresh list each time you open the tab

  const send = async (said) => {
    if (!ready) {   // GitHub key not added yet: the request opens on GitHub, tap Create there
      window.open(improveLink(said), '_blank', 'noopener')
      setText('')
      return
    }
    setBusy(true)
    const res = await sendRequest(said)
    setBusy(false)
    if (res.error) { toast.error('Could not send. Try again.'); return }
    setText('')
    toast.success('Sent to Claude. It shows up here to try, usually by next morning.', { duration: 5000 })
    onChanged()
  }

  const empty = !updates.length && !building.length && !done.length

  return (
    <div className={styles.tab}>
      <CommandBox value={text} onChange={setText} onSubmit={send} busy={busy} voiceSubmits={false}
        placeholder="What should Jarvis do better?" label="Change request" />
      {ready === false && <p className={styles.note}>Requests open on GitHub until GITHUB_TOKEN is added in Netlify.</p>}

      {updates.length > 0 && (
        <section>
          <SectionHeader label="Ready to try" count={updates.length} accent="var(--accent)" />
          <div className={styles.list}>{updates.map(u => <Update key={u.number} u={u} onChanged={onChanged} />)}</div>
        </section>
      )}
      {building.length > 0 && (
        <section>
          <SectionHeader label="Being built" count={building.length} accent="var(--star)" />
          <ul className={styles.rows}>
            {building.map(b => <li key={b.number}><span>{b.title}</span><small>{ago(b.asked)}</small></li>)}
          </ul>
        </section>
      )}
      {done.length > 0 && (
        <section>
          <SectionHeader label="Added lately" count={done.length} accent="var(--done)" />
          <ul className={styles.rows}>
            {done.map(d => <li key={d.number}><span className={styles.doneTitle}><Check size={15} />{d.title}</span><small>{ago(d.closed)}</small></li>)}
          </ul>
        </section>
      )}
      {ready && empty && <p className={styles.note}>Your ideas show up here while Claude builds them.</p>}
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
    if (res.error) {
      toast.error(res.error === 'not_mergeable' ? 'This one needs fixing first. Tap Change and say what you saw.' : 'Could not reach GitHub. Try again.')
      return
    }
    toast.success(done)
    setChanging(false); setNote('')
    onChanged()
  }

  return (
    <div className={styles.card}>
      <div className={styles.title}>{u.title}</div>
      {u.summary && <div className={styles.summary}>{u.summary}</div>}
      <div className={styles.actions}>
        <a className={styles.btn} href={u.preview} target="_blank" rel="noreferrer">Try it<ArrowUpRight size={14} /></a>
        <button className={`${styles.btn} ${styles.primary}`} disabled={busy}
          onClick={() => act(() => approveUpdate(u.number), 'Approved. Live in a couple of minutes.')}>Approve</button>
        <button className={styles.btn} onClick={() => setChanging(c => !c)}>Change</button>
        <button className={`${styles.btn} ${styles.quiet}`} disabled={busy}
          onClick={() => act(() => dropUpdate(u.number), 'Dropped')}>Drop</button>
      </div>
      {changing && (
        <form className={styles.change} onSubmit={e => { e.preventDefault(); note.trim() && act(() => changeUpdate(u.number, note), 'Sent to Claude') }}>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What should be different?" aria-label="What should be different" />
          <button className={`${styles.btn} ${styles.primary}`} disabled={!note.trim() || busy}>Send</button>
        </form>
      )}
    </div>
  )
}
