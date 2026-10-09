// src/components/AskTab.jsx
// Ask Jarvis: speak or type, Claude answers (with web search when needed),
// and suggestions become buttons: add tasks, send a message, call.
// Until the ask-jarvis function is set up in Supabase, questions open in the
// Claude app / claude.ai instead (free with a Claude account, no setup).
import { useState, useEffect, useRef, useCallback } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { todayStr, formatDisplay } from '../lib/dateUtils'
import { useVoice } from '../hooks/useVoice'
import styles from './AskTab.module.css'

const HISTORY_KEY = 'jarvis-ask-history'
const EXAMPLES = [
  'What is on my plate today?',
  'Polish this: sir meeting postponed to monday 11am kindly note',
  'Latest news on Telangana Rythu Bharosa',
  'I need to call the DEO, send the survey report and book train tickets for Sunday',
]

const loadHistory = () => { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] } catch { return [] } }
const saveHistory = (turns) => { try { localStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-30))) } catch { /* private mode */ } }

// What Jarvis knows about your day, sent with each question
function dayContext(tasks, isRoutineDone) {
  const today = todayStr()
  const open  = tasks.filter(t => t.status !== 'routine' && !t.completed_at && t.due_date <= today)
  const later = tasks.filter(t => t.status !== 'routine' && !t.completed_at && t.due_date > today)
  const done  = tasks.filter(t => t.status !== 'routine' && t.completed_at && t.completed_at.slice(0, 10) === today)
  const habits = tasks.filter(t => t.status === 'routine')
  const line = t => `- ${t.title}${t.important ? ' (important)' : ''}${t.postponed ? ` (carried over ${t.postponed} days)` : ''}`
  return [
    `[Today is ${format(new Date(), 'EEEE d MMMM yyyy, h:mm a')}.]`,
    open.length ? `[Tasks for today:\n${open.map(line).join('\n')}]` : '[No tasks left for today.]',
    done.length ? `[Done today: ${done.map(t => t.title).join('; ')}]` : '',
    later.length ? `[Planned later: ${later.slice(0, 15).map(t => `${t.title} on ${t.due_date}`).join('; ')}]` : '',
    habits.length ? `[Habits: ${habits.map(h => `${h.title} ${isRoutineDone(h.id, today) ? 'done' : 'not done'} today`).join('; ')}]` : '',
  ].filter(Boolean).join('\n')
}

// Question plus today's tasks, as one message for the Claude app
const claudeLink = (q, context) =>
  `https://claude.ai/new?q=${encodeURIComponent(`${q}\n\n(For context, from my Jarvis task app:\n${context})`)}`

// Is the in-app assistant set up? An empty question gets "empty" back only when it is.
async function inAppReady() {
  const { error } = await supabase.functions.invoke('ask-jarvis', { body: { turns: [] } })
  try { return (await error?.context?.json())?.error === 'empty' } catch { return false }
}

async function ask(turns, context) {
  const { data, error } = await supabase.functions.invoke('ask-jarvis', { body: { turns, context } })
  if (!error) return data
  let code = 'failed'
  try { code = (await error.context.json()).error || code } catch { /* not JSON */ }
  return { error: code }
}

const ERRORS = {
  not_configured: 'Ask Jarvis is not switched on yet. Add your Claude API key in Supabase (see the README, "Ask Jarvis").',
  bad_key: 'The Claude API key in Supabase was not accepted. Check it in Supabase → Edge Functions → Secrets.',
  busy: 'Claude is busy right now. Try again in a minute.',
  not_signed_in: 'Please sign out and sign in again.',
}

export default function AskTab({ taskData }) {
  const { tasks, addTask, isRoutineDone } = taskData
  const [turns, setTurns]     = useState(loadHistory)
  const [text, setText]       = useState('')
  const [waiting, setWaiting] = useState(false)
  const { listening, toggle } = useVoice(setText)
  const [mode, setMode]       = useState('checking')   // 'inapp' | 'claude'
  const endRef = useRef(null)

  useEffect(() => { inAppReady().then(ok => setMode(ok ? 'inapp' : 'claude')) }, [])

  useEffect(() => { saveHistory(turns) }, [turns])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [turns, waiting])

  const send = useCallback(async (said) => {
    const q = (said ?? text).trim()
    if (!q || waiting) return
    const next = [...turns, { role: 'user', text: q }]
    setTurns(next); setText(''); setWaiting(true)
    const res = await ask(next.filter(t => !t.error).map(({ role, text }) => ({ role, text })), dayContext(tasks, isRoutineDone))
    setWaiting(false)
    setTurns(prev => [...prev, res.error
      ? { role: 'assistant', text: ERRORS[res.error] || 'Something went wrong. Please try again.', error: true }
      : { role: 'assistant', text: res.text, actions: res.actions }])
  }, [text, waiting, turns, tasks, isRoutineDone])

  const clear = () => { setTurns([]); window.speechSynthesis?.cancel() }

  if (mode !== 'inapp') return <OpenInClaude text={text} setText={setText} listening={listening} toggle={toggle}
    context={dayContext(tasks, isRoutineDone)} />

  return (
    <div className={styles.wrap}>
      {turns.length === 0 ? (
        <div className={styles.intro}>
          <h2 className={styles.title}>Ask Jarvis</h2>
          <p className={styles.sub}>Ask anything, have a message polished, or say what's on your mind and Jarvis turns it into tasks.</p>
          <div className={styles.examples}>
            {EXAMPLES.map(e => <button key={e} className={styles.example} onClick={() => send(e)}>{e}</button>)}
          </div>
        </div>
      ) : (
        <div className={styles.thread}>
          {turns.map((t, i) => t.role === 'user'
            ? <div key={i} className={styles.me}>{t.text}</div>
            : <Answer key={i} turn={t} addTask={addTask} />)}
          {waiting && <div className={`${styles.them} ${styles.thinking}`}>Thinking…</div>}
          <button className={styles.clear} onClick={clear}>Clear conversation</button>
        </div>
      )}
      <div ref={endRef} />

      <form className={styles.composer} onSubmit={e => { e.preventDefault(); send() }}>
        <textarea
          className={styles.input} rows={1} value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
          placeholder={listening ? 'Listening…' : 'Ask or tell Jarvis…'} aria-label="Ask Jarvis"
        />
        <button type="button" onClick={() => toggle(text)}
          className={`${styles.mic} ${listening ? styles.micOn : ''}`}
          aria-label={listening ? 'Stop listening' : 'Speak'}>🎙️</button>
        <button type="submit" className={styles.send} disabled={!text.trim() || waiting} aria-label="Send">↑</button>
      </form>
    </div>
  )
}

function Answer({ turn, addTask }) {
  const [added, setAdded] = useState({})
  const a = turn.actions
  const speak = () => {
    const synth = window.speechSynthesis
    if (!synth) { toast('Reading aloud is not supported here'); return }
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
          <div className={styles.cardTitle}>Add to your list</div>
          {a.tasks.map((t, i) => (
            <div key={i} className={styles.taskRow}>
              <span>{t.important ? '★ ' : ''}{t.title}<small>{t.date && t.date > todayStr() ? ` · ${formatDisplay(t.date)}` : ' · today'}</small></span>
              <button className={styles.small} disabled={added[i]} onClick={() => add(t, i)}>{added[i] ? '✓ Added' : '+ Add'}</button>
            </div>
          ))}
        </div>
      )}

      {a?.message && <MessageCard m={a.message} copy={copy} />}

      {a?.call && (
        <a className={styles.action} href={`tel:${a.call.replace(/[^\d+]/g, '')}`}>📞 Call {a.call}</a>
      )}
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
      <div className={styles.cardTitle}>Message ready</div>
      <div className={styles.draft}>{m.text}</div>
      <div className={styles.actions}>
        <button className={styles.action} onClick={() => copy(m.text)}>⧉ Copy</button>
        <a className={styles.action} href={`https://wa.me/${email ? '' : phone}?text=${body}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className={styles.action} href={`sms:${email ? '' : (m.to || '').replace(/[^\d+]/g, '')}?&body=${body}`}>SMS</a>
        <a className={styles.action} href={`mailto:${email}?subject=${encodeURIComponent(m.subject || '')}&body=${body}`}>Email</a>
      </div>
    </div>
  )
}

// No setup needed: the question (with today's tasks) opens in Claude
function OpenInClaude({ text, setText, listening, toggle, context }) {
  const q = text.trim()
  return (
    <div className={styles.wrap}>
      <div className={styles.intro}>
        <h2 className={styles.title}>Ask Jarvis</h2>
        <p className={styles.sub}>
          Speak or type, then tap <b>Ask Claude</b>. Your question opens in the Claude app with today's tasks attached,
          so you can search, polish a message or plan your day. Free with your Claude account.
        </p>
        <div className={styles.examples}>
          {EXAMPLES.map(e => (
            <a key={e} className={styles.example} href={claudeLink(e, context)} target="_blank" rel="noreferrer">{e}</a>
          ))}
        </div>
      </div>
      <div className={styles.composerCol}>
        <div className={styles.composer}>
          <textarea
            className={styles.input} rows={2} value={text}
            onChange={e => setText(e.target.value)}
            placeholder={listening ? 'Listening…' : 'Ask or tell Jarvis…'} aria-label="Ask Jarvis"
          />
          <button type="button" onClick={() => toggle(text)}
            className={`${styles.mic} ${listening ? styles.micOn : ''}`}
            aria-label={listening ? 'Stop listening' : 'Speak'}>🎙️</button>
        </div>
        <a className={`${styles.askClaude} ${q ? '' : styles.disabled}`}
          href={q ? claudeLink(q, context) : undefined} target="_blank" rel="noreferrer"
          aria-disabled={!q} onClick={() => q && setTimeout(() => setText(''), 500)}>
          Ask Claude ↗
        </a>
      </div>
    </div>
  )
}
