// Assist: chat with Jarvis like ChatGPT or Gemini. It knows today's tasks, writes and polishes
// messages (send by WhatsApp, SMS or email), turns what you say into tasks, and can dial a number.
// It knows GST law and drafts notices, orders and replies, and reads your Memory before answering;
// "remember …" saves a note there straight away.
// Runs on the free Gemini key in Netlify; without it, your question opens in ChatGPT or Claude.
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { Volume2, Copy, Phone, ArrowUpRight, Check, Plus, SquarePen, BookMarked } from 'lucide-react'
import { askJarvis, isReady, addMemory } from '../lib/server'
import { dayContext, chatgptLink, claudeLink, googleLink } from '../lib/assistant'
import { todayStr } from '../lib/dateUtils'
import CommandBox from './CommandBox'
import MemoryPanel from './MemoryPanel'
import SaveButton from './SaveButton'
import styles from './AssistTab.module.css'

const CHAT = 'jarvis-chat'
const IDEAS = ['Plan my day', "What's pending this week?", 'Explain section 74 of CGST Act', 'What can you do?']
// "Remember that …" saves to Memory; "remember to …" is a task, and a question is a question
const REMEMBER = /^(?:please\s+|jarvis[,\s]+)*remember(?:\s+that)?\b[\s:,-]*/i
const ERRORS = {
  busy: 'Too many questions in a short time. Try again in a minute.',
  bad_key: 'The Gemini key in Netlify was not accepted. Check GEMINI_API_KEY.',
  not_signed_in: 'Please sign out and sign in again.',
  offline: 'No internet connection.',
}
const loadChat = () => { try { return JSON.parse(localStorage.getItem(CHAT)) || [] } catch { return [] } }
const saveChat = (t) => { try { localStorage.setItem(CHAT, JSON.stringify(t.slice(-30))) } catch { /* private mode */ } }

export default function AssistTab({ taskData }) {
  const { tasks, addTask, isRoutineDone } = taskData
  const [inApp, setInApp]     = useState(null)       // Gemini key added in Netlify (null = checking)
  const [turns, setTurns]     = useState(loadChat)
  const [text, setText]       = useState('')
  const [waiting, setWaiting] = useState(false)
  const [asked, setAsked]     = useState(null)       // without the key: the question to open elsewhere
  const [memory, setMemory]   = useState(false)      // showing Memory instead of the chat
  const endRef = useRef(null)
  const ctx = dayContext(tasks, isRoutineDone)

  useEffect(() => { isReady('jarvis-ask').then(setInApp) }, [])
  useEffect(() => { saveChat(turns) }, [turns])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }) }, [turns.length, waiting])

  const ask = async (said) => {
    setText('')
    const lead = said.match(REMEMBER)?.[0]
    const note = lead && said.slice(lead.length).trim()
    if (note && !/^to\b/i.test(note) && !note.endsWith('?')) {
      setTurns(prev => [...prev, { role: 'user', text: said }]); setWaiting(true)
      const res = await addMemory(note, 'you')
      setWaiting(false)
      setTurns(prev => [...prev, res.error
        ? { role: 'assistant', text: res.why || 'Could not save that. Try again.', error: true }
        : { role: 'assistant', text: "Saved to Memory. I'll keep it in mind.", saved: true }])
      return
    }
    const ok = inApp ?? await isReady('jarvis-ask')
    if (!ok) { setAsked(said); return }
    const next = [...turns, { role: 'user', text: said }]
    setTurns(next); setWaiting(true)
    // A draft sits in its own card, so it goes back with the answer for "make it shorter"
    const history = next.filter(t => !t.error).slice(-10)
      .map(({ role, text, actions }) => ({ role, text: actions?.message?.text ? `${text}\n\n${actions.message.text}` : text }))
    const res = await askJarvis(history, ctx)
    setWaiting(false)
    setTurns(prev => [...prev, res.error
      ? { role: 'assistant', text: res.why || ERRORS[res.error] || 'Something went wrong. Please try again.', error: true }
      : { role: 'assistant', text: res.text, actions: res.actions }])
  }

  if (memory) return <div className={styles.tab}><MemoryPanel onBack={() => setMemory(false)} /></div>

  return (
    <div className={styles.tab}>
      <div className={styles.bar}>
        <button className={styles.fresh} onClick={() => setMemory(true)}><BookMarked size={15} />Memory</button>
        {turns.length > 0 && <button className={styles.fresh} onClick={() => setTurns([])}><SquarePen size={15} />New chat</button>}
      </div>
      {turns.length > 0 && (
        <div className={styles.thread}>
          {turns.map((t, i) => t.role === 'user'
            ? <div key={i} className={styles.me}>{t.text}</div>
            : <Answer key={i} turn={t} q={turns[i - 1]?.text} addTask={addTask} />)}
          {waiting && <div className={`${styles.them} ${styles.thinking}`}>Thinking…</div>}
        </div>
      )}

      {turns.length === 0 && !asked && (
        <div className={styles.ideas}>
          {IDEAS.map(s => <button key={s} className={styles.chip} onClick={() => ask(s)}>{s}</button>)}
        </div>
      )}

      {asked && (
        <div className={styles.elsewhere}>
          <div className={styles.me}>{asked}</div>
          <div className={styles.actions}>
            <a className={styles.small} href={chatgptLink(asked, ctx)} target="_blank" rel="noreferrer">ChatGPT<ArrowUpRight size={14} /></a>
            <a className={styles.small} href={claudeLink(asked, ctx)} target="_blank" rel="noreferrer">Claude<ArrowUpRight size={14} /></a>
            <a className={styles.small} href={googleLink(asked, ctx)} target="_blank" rel="noreferrer">Google<ArrowUpRight size={14} /></a>
          </div>
          <p className={styles.note}>Add the free Gemini key in Netlify to chat right here.</p>
        </div>
      )}

      <div ref={endRef}>
        <CommandBox value={text} onChange={setText} onSubmit={ask} busy={waiting}
          placeholder="Ask Jarvis anything…" label="Ask Jarvis" />
      </div>
    </div>
  )
}

function Answer({ turn, q = '', addTask }) {
  const [added, setAdded] = useState({})
  const a = turn.actions
  const speak = () => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(turn.text); u.lang = 'en-IN'
    synth.speak(u)
  }
  const copy = async (s) => {
    try { await navigator.clipboard.writeText(s); toast.success('Copied') } catch { toast.error('Could not copy') }
  }
  const add = async (t, i) => {
    const { error } = await addTask({ title: t.title, due_date: t.date && t.date >= todayStr() ? t.date : todayStr(), important: t.important })
    if (error) toast.error('Could not add'); else setAdded(p => ({ ...p, [i]: true }))
  }

  return (
    <div className={`${styles.them} ${turn.error ? styles.err : ''}`}>
      <div className={styles.text}>{turn.text}</div>
      {!turn.error && !turn.saved && (
        <div className={styles.tools}>
          <button onClick={speak} aria-label="Read aloud"><Volume2 size={16} /></button>
          <button onClick={() => copy(turn.text)} aria-label="Copy answer"><Copy size={15} /></button>
          <SaveButton from="assist" title={q.slice(0, 120)}
            text={a?.message?.text ? `${turn.text}\n\n${a.message.text}` : turn.text} />
        </div>
      )}
      {a?.remember && <RememberCard note={a.remember} />}
      {a?.tasks?.length > 0 && (
        <div className={styles.card}>
          {a.tasks.map((t, i) => (
            <div key={i} className={styles.taskRow}>
              <span>{t.title}<small>{t.date && t.date > todayStr() ? ` · ${format(parseISO(t.date), 'd MMM')}` : ''}</small></span>
              <button className={styles.small} disabled={added[i]} onClick={() => add(t, i)}>{added[i] ? <Check size={14} /> : <><Plus size={14} />Add</>}</button>
            </div>
          ))}
        </div>
      )}
      {a?.message && <MessageCard m={a.message} copy={copy} />}
      {a?.call && <a className={styles.small} href={`tel:${a.call.replace(/[^\d+]/g, '')}`}><Phone size={14} />Call {a.call}</a>}
    </div>
  )
}

// Jarvis heard a lasting preference or fact: one tap keeps it in Memory
function RememberCard({ note }) {
  const [state, setState] = useState('')
  const save = async () => {
    setState('saving')
    const res = await addMemory(note, 'assist')
    if (res.error) { setState(''); toast.error(res.why || 'Could not save. Try again.'); return }
    setState('saved')
  }
  return (
    <div className={styles.card}>
      <div className={styles.taskRow}>
        <span><small>Remember this? </small>{note}</span>
        <button className={styles.small} disabled={!!state} onClick={save}>{state === 'saved' ? <Check size={14} /> : 'Save'}</button>
      </div>
    </div>
  )
}

function MessageCard({ m, copy }) {
  const body = encodeURIComponent(m.text)
  const digits = (m.to || '').replace(/[^\d]/g, '')
  const phone = digits.length === 10 ? '91' + digits : digits   // Indian mobile without country code
  const email = m.to && m.to.includes('@') ? m.to : ''
  return (
    <div className={styles.card}>
      <div className={styles.draft}>{m.text}</div>
      <div className={styles.actions}>
        <button className={styles.small} onClick={() => copy(m.text)}>Copy</button>
        <a className={styles.small} href={`https://wa.me/${email ? '' : phone}?text=${body}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className={styles.small} href={`sms:${email ? '' : (m.to || '').replace(/[^\d+]/g, '')}?&body=${body}`}>SMS</a>
        <a className={styles.small} href={`mailto:${email}?subject=${encodeURIComponent(m.subject || '')}&body=${body}`}>Email</a>
      </div>
    </div>
  )
}
