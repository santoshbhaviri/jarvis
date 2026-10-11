// Evolve: tell Jarvis what it should do better. Claude builds it (every few hours), it shows up
// here to try, and Approve puts it live. Nothing changes without your Approve. Claude's answers
// to your requests show here too: Save keeps one in Memory, Delete takes it off this page.
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNowStrict } from 'date-fns'
import { Check, ArrowUpRight, Wrench, Sparkles, Bookmark, Trash2 } from 'lucide-react'
import { sendRequest, approveUpdate, changeUpdate, dropUpdate, addMemory, hideReply } from '../lib/server'
import CommandBox from './CommandBox'
import SectionHeader from './SectionHeader'
import SetupCheck from './SetupCheck'
import styles from './EvolveTab.module.css'

// GitHub's clock can be a few seconds ahead of the phone's
const ago = (d) => { try { return new Date(d) > Date.now() ? 'just now' : formatDistanceToNowStrict(new Date(d), { addSuffix: true }) } catch { return '' } }

export default function EvolveTab({ data, ready, onChanged, seen = '' }) {
  const { updates = [], building = [], done = [], replies: all = [] } = data || {}
  const [gone, setGone] = useState([])   // replies just saved or deleted, gone before the list reloads
  const replies = all.filter(r => !gone.includes(r.id))
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => { onChanged() }, [onChanged])   // fresh list each time you open the tab

  const send = async (said) => {
    if (!ready) {   // GitHub key not working yet: keep the words, the Setup check says what to fix
      toast('Evolve needs the GitHub key first. The Setup check below says what to fix.', { duration: 5000 })
      return
    }
    setBusy(true)
    const res = await sendRequest(said)
    setBusy(false)
    if (res.error) { toast.error(res.why || 'Could not send. Try again.', { duration: 6000 }); if (res.why) setChecking(true); return }
    setText('')
    toast.success('Sent to Claude. Its answer or the update shows up here.', { duration: 5000 })
    onChanged()
  }

  const empty = !updates.length && !building.length && !done.length && !replies.length

  return (
    <div className={styles.tab}>
      <CommandBox value={text} onChange={setText} onSubmit={send} busy={busy}
        placeholder="What should Jarvis do better?" label="Change request" />
      {(ready === false || checking) && <SetupCheck />}

      {updates.length > 0 && (
        <section>
          <SectionHeader label="Ready to try" count={updates.length} accent="var(--accent)" />
          <div className={styles.list}>{updates.map(u => <Update key={u.number} u={u} onChanged={onChanged} />)}</div>
        </section>
      )}
      {replies.length > 0 && (
        <section>
          <SectionHeader label="Replies from Claude" count={replies.length} accent="var(--gold)" />
          <div className={styles.list}>
            {replies.map(r => <Reply key={r.id} r={r} isNew={r.at > seen}
              onGone={() => setGone(g => [...g, r.id])} onBack={() => setGone(g => g.filter(id => id !== r.id))} />)}
          </div>
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
      {ready && !checking && <button className={styles.check} onClick={() => setChecking(true)}><Wrench size={14} />Check setup</button>}
    </div>
  )
}

// Save puts the reply in Memory (so Search and Assist know it) and takes it off Evolve;
// Delete just takes it off Evolve. Either way it stays on GitHub.
function Reply({ r, isNew, onGone, onBack }) {
  const act = async (save) => {
    onGone()
    const res = save ? await addMemory(r.text, 'claude', r.request) : await hideReply(r.id)
    if (res.error) { onBack(); toast.error(res.why || 'Could not reach Jarvis. Try again.'); return }
    if (save) hideReply(r.id)   // if this one fails, the reply just shows again next time
    toast.success(save ? 'Saved to Memory' : 'Deleted')
  }
  return (
    <div className={styles.reply}>
      <div className={styles.replyHead}>
        <span className={styles.on}>{r.request}</span>
        {isNew && <span className={styles.new}>New</span>}
      </div>
      <div className={styles.replyText}><Sparkles size={14} /><p>{r.text}</p></div>
      <div className={styles.replyFoot}>
        <small>{ago(r.at)}</small>
        <span>
          <button className={styles.btn} onClick={() => act(true)}><Bookmark size={13} />Save</button>
          <button className={`${styles.btn} ${styles.quiet}`} onClick={() => act(false)}><Trash2 size={13} />Delete</button>
        </span>
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
    if (res.error) {
      toast.error(res.error === 'not_mergeable' ? 'This one needs fixing first. Tap Change and say what you saw.' : res.why || 'Could not reach GitHub. Try again.', { duration: 6000 })
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
