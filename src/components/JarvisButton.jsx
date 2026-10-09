// The Jarvis button: one floating button on every screen, like AssistiveTouch.
// Tap it and speak (or type). Jarvis works out what you meant:
//   tasks   "On 21st call the DEO and send the survey report" → added on the right days
//   ask     "Latest news on Rythu Bharosa", "Polish this: …"  → answered (free, via Google / Gemini)
//   improve "Jarvis should show a weekly summary"              → sent to GitHub; Claude builds it
import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { supabase } from '../lib/supabase'
import { parseCommand } from '../lib/parseTask'
import { classify, dayContext, googleLink, chatgptLink, claudeLink, improveLink } from '../lib/assistant'
import { todayStr } from '../lib/dateUtils'
import { REPO_URL } from '../lib/constants'
import { useVoice, voiceSupported } from '../hooks/useVoice'
import styles from './JarvisButton.module.css'

const KINDS = [
  { key: 'task',    label: 'Task' },
  { key: 'ask',     label: 'Ask' },
  { key: 'improve', label: 'Improve app' },
]

const dayLabel = (t) => {
  if (t.status === 'routine') return 'Daily habit'
  const today = todayStr()
  if (t.due_date === today) return 'Today'
  return format(parseISO(t.due_date), 'EEE d MMM')
}

// Is the in-app assistant switched on? An empty question gets "empty" back only when it is.
async function inAppReady() {
  const { error } = await supabase.functions.invoke('ask-jarvis', { body: { turns: [] } })
  try { return (await error?.context?.json())?.error === 'empty' } catch { return false }
}

async function askInApp(turns, context) {
  const { data, error } = await supabase.functions.invoke('ask-jarvis', { body: { turns, context } })
  if (!error) return data
  let code = 'failed'
  try { code = (await error.context.json()).error || code } catch { /* not JSON */ }
  return { error: code }
}

const ERRORS = {
  busy: 'Too many questions in a short time. Try again in a minute.',
  bad_key: 'The AI key in Supabase was not accepted. Check it under Edge Functions → Secrets.',
  not_signed_in: 'Please sign out and sign in again.',
}

export default function JarvisButton({ taskData }) {
  const { tasks, addTask, deleteTask, isRoutineDone } = taskData
  const [open, setOpen]       = useState(false)
  const [text, setText]       = useState('')
  const [kind, setKind]       = useState(null)      // chosen by hand; null = Jarvis decides
  const [turns, setTurns]     = useState([])        // in-app answers while the sheet is open
  const [waiting, setWaiting] = useState(false)
  const [inApp, setInApp]     = useState(false)
  const openRef  = useRef(false)
  const inputRef = useRef(null)

  useEffect(() => { inAppReady().then(setInApp) }, [])

  const q = text.trim()
  const guess = kind || (q ? classify(q) : 'task')
  const preview = guess === 'task' && q ? parseCommand(q) : []

  const addAll = useCallback(async (said) => {
    const list = parseCommand(said)
    const added = []
    for (const t of list) {
      const { data, error } = await addTask(t)
      if (error) { toast.error(`Could not save "${t.title}"`); continue }
      added.push(data)
    }
    if (!added.length) return
    const undo = async (id) => { toast.dismiss(id); for (const t of added) await deleteTask(t.id) }
    toast((tt) => (
      <span className={styles.toast}>
        <span>✓ {added.length === 1 ? `${added[0].title} · ${dayLabel(added[0])}` : `${added.length} tasks added`}</span>
        <button onClick={() => undo(tt.id)}>Undo</button>
      </span>
    ), { duration: 5000 })
    close()
  }, [addTask, deleteTask])   // eslint-disable-line react-hooks/exhaustive-deps

  const ask = useCallback(async (said) => {
    const next = [...turns, { role: 'user', text: said }]
    setTurns(next); setText(''); setKind(null); setWaiting(true)
    const res = await askInApp(next.filter(t => !t.error).map(({ role, text }) => ({ role, text })), dayContext(tasks, isRoutineDone))
    setWaiting(false)
    setTurns(prev => [...prev, res.error
      ? { role: 'assistant', text: ERRORS[res.error] || 'Something went wrong. Please try again.', error: true }
      : { role: 'assistant', text: res.text, actions: res.actions }])
  }, [turns, tasks, isRoutineDone])

  // Do it straight away when that needs no extra tap
  const go = useCallback((said = text, k = null) => {
    const s = said.trim()
    if (!s || !openRef.current) return
    const what = k || kind || classify(s)
    if (what === 'task') addAll(s)
    else if (what === 'ask' && inApp) ask(s)
    // free answers and app requests open another app, which needs your tap
  }, [text, kind, inApp, addAll, ask])

  const voice = useVoice(setText, useCallback((said) => go(said), [go]))

  const start = () => {
    openRef.current = true
    setOpen(true)
    if (voiceSupported) voice.toggle('')
    else setTimeout(() => inputRef.current?.focus(), 0)   // iPhone keyboard has its own 🎙
  }
  function close() {
    openRef.current = false
    if (voice.listening) voice.toggle()
    setOpen(false); setText(''); setKind(null); setTurns([])
    window.speechSynthesis?.cancel()
  }

  const ctx = dayContext(tasks, isRoutineDone)
  const clearSoon = () => setTimeout(() => { setText(''); setKind(null) }, 400)

  return (
    <>
      {!open && (
        <button className={styles.fab} onClick={start} aria-label="Talk to Jarvis">
          <MicIcon />
        </button>
      )}

      {open && (
        <div className={styles.backdrop} onClick={close}>
          <div className={styles.sheet} role="dialog" aria-label="Jarvis" onClick={e => e.stopPropagation()}>
            <div className={styles.grab} />

            {turns.length > 0 && (
              <div className={styles.thread}>
                {turns.map((t, i) => t.role === 'user'
                  ? <div key={i} className={styles.me}>{t.text}</div>
                  : <Answer key={i} turn={t} addTask={addTask} />)}
                {waiting && <div className={`${styles.them} ${styles.thinking}`}>Thinking…</div>}
                {!waiting && !q && (
                  <div className={styles.alt}>
                    <a href={googleLink(turns.filter(t => t.role === 'user').at(-1).text, ctx)} target="_blank" rel="noreferrer">Search Google</a> for the latest
                  </div>
                )}
              </div>
            )}

            <form className={styles.row} onSubmit={e => { e.preventDefault(); go() }}>
              <textarea ref={inputRef} className={styles.input} rows={2} value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); go() } }}
                placeholder={voice.listening ? 'Listening…' : 'Say or type anything'} aria-label="Tell Jarvis" />
              {voiceSupported && (
                <button type="button" onClick={() => voice.toggle(text)}
                  className={`${styles.mic} ${voice.listening ? styles.micOn : ''}`}
                  aria-label={voice.listening ? 'Stop listening' : 'Speak'}><MicIcon /></button>
              )}
            </form>

            {q && (
              <div className={styles.kinds} role="radiogroup" aria-label="What should Jarvis do">
                {KINDS.map(k => (
                  <button key={k.key} role="radio" aria-checked={guess === k.key}
                    className={`${styles.kind} ${guess === k.key ? styles.kindOn : ''}`}
                    onClick={() => setKind(k.key)}>{k.label}</button>
                ))}
              </div>
            )}

            {q && guess === 'task' && (
              <>
                <ul className={styles.preview}>
                  {preview.map((t, i) => (
                    <li key={i}><span>{t.important ? '★ ' : ''}{t.title}</span><small>{dayLabel(t)}</small></li>
                  ))}
                </ul>
                <button className={styles.primary} onClick={() => go(text, 'task')}>
                  Add {preview.length > 1 ? `${preview.length} tasks` : 'task'}
                </button>
              </>
            )}

            {q && guess === 'ask' && (inApp
              ? (
                <>
                  <button className={styles.primary} onClick={() => go(text, 'ask')} disabled={waiting}>Ask Jarvis</button>
                  <div className={styles.alt}>
                    or <a href={googleLink(q, ctx)} target="_blank" rel="noreferrer" onClick={clearSoon}>Search Google</a>
                  </div>
                </>
              )
              : (
                <>
                  <a className={styles.primary} href={googleLink(q, ctx)} target="_blank" rel="noreferrer" onClick={clearSoon}>Ask Google ↗</a>
                  <div className={styles.alt}>
                    or <a href={chatgptLink(q, ctx)} target="_blank" rel="noreferrer" onClick={clearSoon}>ChatGPT</a>
                    {' · '}<a href={claudeLink(q, ctx)} target="_blank" rel="noreferrer" onClick={clearSoon}>Claude</a>
                  </div>
                </>
              ))}

            {q && guess === 'improve' && (
              <>
                <a className={styles.primary} href={improveLink(q)} target="_blank" rel="noreferrer" onClick={clearSoon}>Send to GitHub ↗</a>
                <div className={styles.alt}>
                  Tap <b>Create</b> there. You get a preview to try next morning. <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">My requests</a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function Answer({ turn, addTask }) {
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
      {!turn.error && (
        <div className={styles.tools}>
          <button onClick={speak} aria-label="Read aloud">🔊</button>
          <button onClick={() => copy(turn.text)} aria-label="Copy answer">⧉</button>
        </div>
      )}
      {a?.tasks?.length > 0 && (
        <div className={styles.card}>
          {a.tasks.map((t, i) => (
            <div key={i} className={styles.taskRow}>
              <span>{t.title}<small>{t.date && t.date > todayStr() ? ` · ${format(parseISO(t.date), 'd MMM')}` : ''}</small></span>
              <button className={styles.small} disabled={added[i]} onClick={() => add(t, i)}>{added[i] ? '✓' : '+ Add'}</button>
            </div>
          ))}
        </div>
      )}
      {a?.message && <MessageCard m={a.message} copy={copy} />}
      {a?.call && <a className={styles.small} href={`tel:${a.call.replace(/[^\d+]/g, '')}`}>📞 Call {a.call}</a>}
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
