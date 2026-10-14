// Your day, on Today: today's birthdays and meetings from your calendar, a look at tomorrow, and the
// mail from people that needs you (sorted by Claude, one line each). + puts a birthday wish or a
// reply on today's list; × hides a mail; tapping a mail opens it in Gmail.
// The first time, the card walks through the two one-time steps: your calendar's private link and a
// Google app password. Jarvis only reads both, and they stay on Jarvis's server.
import { useState, useEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Cake, CalendarDays, Mail, Plus, Check, ArrowUpRight, RotateCw, Settings2, X } from 'lucide-react'
import { getDay, linkCalendar, linkMail, unlinkDay } from '../lib/server'
import { todayStr } from '../lib/dateUtils'
import styles from './YourDay.module.css'

const KEPT = 'jarvis-day'          // the last card, shown at once next time
const MARKS = 'jarvis-day-marks'   // mails you closed, and what you already added to today
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const keep = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }

const time = (iso) => format(new Date(iso), 'h:mm a')
const first = (name) => (name || '').replace(/^["'(]+/, '').split(/[\s(,]/)[0] || name
// "Ravi's Birthday" → "Ravi"; a Birthdays calendar holds just the name
const birthdayOf = (title) => title.replace(/['’]s\b/i, '').replace(/\b(happy\s+)?(birthday|b'?day)\b/ig, '').replace(/[\s:–-]+$|^[\s:–-]+/g, '').trim() || title

export default function YourDay({ addTask }) {
  const [day, setDay]       = useState(() => load(KEPT, null))
  const [busy, setBusy]     = useState(false)
  const [setup, setSetup]   = useState(false)
  const [marks, setMarks]   = useState(() => load(MARKS, { hidden: [], added: [] }))

  const refresh = useCallback(async (fresh) => {
    setBusy(true)
    const res = await getDay(fresh)
    setBusy(false)
    if (res.error === 'no_owner' || res.error === 'not_signed_in') { setDay({ off: true }); return }
    if (res.error) { if (fresh) toast.error(res.why || "Couldn't refresh just now. Try again."); return }
    setDay(res); keep(KEPT, res)
  }, [])
  useEffect(() => { refresh(false) }, [refresh])
  useEffect(() => { keep(MARKS, { hidden: marks.hidden.slice(-200), added: marks.added.slice(-200) }) }, [marks])

  if (!day || day.off) return null
  const linked = day.calendar || day.mail
  if (!linked || setup) {
    return <Connect day={day} onClose={linked ? () => setSetup(false) : null}
      onChanged={() => { setSetup(true); return refresh(true) }} />
  }

  const current = day.day === todayStr()      // a card kept from yesterday waits for the new one
  const events  = current ? day.events || [] : []
  const birthdays = events.filter(e => e.day === 'today' && e.birthday)
  const today     = events.filter(e => e.day === 'today' && !e.birthday)
  const tomorrow  = events.filter(e => e.day === 'tomorrow')
  const mails     = (current ? day.mails || [] : []).filter(m => !marks.hidden.includes(m.id))
  const now = Date.now()

  const add = async (id, title) => {
    if (marks.added.includes(id)) return
    const { error } = await addTask({ title, due_date: todayStr() })
    if (error) { toast.error('Could not add it. Try again.'); return }
    setMarks(m => ({ ...m, added: [...m.added, id] }))
    toast.success('Added to today')
  }
  const hide = (id) => setMarks(m => ({ ...m, hidden: [...m.hidden, id] }))
  const addButton = (id, title, label) => (
    <button className={styles.add} onClick={() => add(id, title)} aria-label={label} disabled={marks.added.includes(id)}>
      {marks.added.includes(id) ? <Check size={15} /> : <Plus size={16} />}
    </button>
  )

  return (
    <section className={styles.card} aria-label="Your day">
      <div className={styles.head}>
        <h2 className={styles.title}>Your day</h2>
        {current && day.at && <span className={styles.when}>{time(day.at)}</span>}
        <button className={styles.icon} onClick={() => refresh(true)} disabled={busy} aria-label="Refresh"><RotateCw size={15} className={busy ? styles.spin : ''} /></button>
        <button className={styles.icon} onClick={() => setSetup(true)} aria-label="Calendar and mail settings"><Settings2 size={15} /></button>
      </div>

      {!current && <p className={styles.muted}>{busy ? 'Looking at today…' : 'Tap refresh for today.'}</p>}

      {birthdays.map((b, i) => (
        <div key={`b${i}`} className={`${styles.row} ${styles.birthday}`}>
          <Cake size={16} className={styles.gold} />
          <span className={styles.what}>{b.title}</span>
          {addButton(`${day.day}:${b.title}`, `Wish ${birthdayOf(b.title)} a happy birthday`, `Add wishing ${birthdayOf(b.title)} to today`)}
        </div>
      ))}

      {today.slice(0, 8).map((e, i) => (
        <div key={`t${i}`} className={`${styles.row} ${!e.allDay && Date.parse(e.end) < now ? styles.past : ''}`}>
          <span className={styles.at}>{e.allDay ? 'All day' : time(e.start)}</span>
          <span className={styles.what}>{e.title}{e.where && <small>{e.where}</small>}</span>
        </div>
      ))}
      {current && day.calendar && !today.length && !birthdays.length && <p className={styles.muted}>Nothing on your calendar today.</p>}

      {tomorrow.length > 0 && (
        <>
          <div className={styles.sub}>Tomorrow</div>
          {tomorrow.slice(0, 4).map((e, i) => (
            <div key={`n${i}`} className={`${styles.row} ${styles.small}`}>
              {e.birthday ? <Cake size={14} className={styles.gold} /> : <span className={styles.at}>{e.allDay ? 'All day' : time(e.start)}</span>}
              <span className={styles.what}>{e.title}</span>
            </div>
          ))}
        </>
      )}

      {day.mail && current && (
        <>
          <div className={styles.sub}><Mail size={13} />Mail{mails.length ? ` · ${mails.length}` : ''}</div>
          {mails.map(m => (
            <div key={m.id} className={styles.mail}>
              <a className={styles.mailBody} href={m.link} target="_blank" rel="noreferrer">
                <span className={styles.who}>{m.name}{m.unread && <i className={styles.dot} aria-label="unread" />}</span>
                <span className={styles.line}>{m.line}</span>
              </a>
              {addButton(m.id, `${m.reply ? 'Reply to ' : ''}${first(m.name)}: ${m.line}`, `Add ${m.name}'s mail to today`)}
              <button className={styles.icon} onClick={() => hide(m.id)} aria-label={`Hide ${m.name}'s mail`}><X size={15} /></button>
            </div>
          ))}
          {!mails.length && <p className={styles.muted}>No mail waiting for you.</p>}
        </>
      )}

      {current && Object.values(day.problems || {}).map((p, i) => <p key={i} className={styles.problem}>{p}</p>)}
    </section>
  )
}

// The two one-time steps (best on the laptop), and later: what's connected, with Remove
function Connect({ day, onClose, onChanged }) {
  const [link, setLink]         = useState('')
  const [address, setAddress]   = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving]     = useState('')

  const save = (what, send, done) => async (e) => {
    e.preventDefault()
    if (saving) return
    setSaving(what)
    const res = await send()
    setSaving('')
    if (res.error) { toast.error(res.why || "Couldn't save. Try again.", { duration: 7000 }); return }
    done(res)
    onChanged()
  }
  const saveCalendar = save('calendar', () => linkCalendar(link), (res) => {
    setLink(''); toast.success(`Calendar connected${res.today ? ` · ${res.today} today` : ''}`)
  })
  const saveMail = save('mail', () => linkMail(address, password), () => {
    setPassword(''); toast.success('Gmail connected')
  })

  return (
    <section className={styles.card} aria-label="Connect your calendar and mail">
      <div className={styles.head}>
        <h2 className={styles.title}>Your day</h2>
        {onClose && <button className={styles.icon} onClick={onClose} aria-label="Close"><X size={16} /></button>}
      </div>
      <p className={styles.lead}>Your meetings, birthdays and the mail that needs you, here each morning. Set it up once, best on your laptop.</p>

      <div className={styles.step}>
        <div className={styles.stepHead}><CalendarDays size={16} />Calendar{day.calendar && <span className={styles.ok}>Connected</span>}</div>
        {day.calendar
          ? <Remove what="calendar" onDone={onChanged} />
          : (
            <>
              <p className={styles.hint}>In Google Calendar open Settings, click your calendar, and copy <b>Secret address in iCal format</b>. Import birthdays_calendar.ics first (Settings, Import &amp; export). An iPhone calendar's Public Calendar link works too.</p>
              <form className={styles.paste} onSubmit={saveCalendar}>
                <input value={link} onChange={e => setLink(e.target.value)} placeholder="https://calendar.google.com/…" aria-label="Calendar link"
                  autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} inputMode="url" />
                <button type="submit" disabled={!link.trim() || !!saving}>{saving === 'calendar' ? 'Checking…' : 'Save'}</button>
              </form>
            </>
          )}
      </div>

      <div className={styles.step}>
        <div className={styles.stepHead}><Mail size={16} />Gmail{day.mail && <span className={styles.ok}>{day.mail}</span>}</div>
        {day.mail
          ? <Remove what="mail" onDone={onChanged} />
          : (
            <>
              <p className={styles.hint}>Make an app password named Jarvis and copy its 16 letters. If Google asks, turn on 2-Step Verification first.</p>
              <a className={styles.open} href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">Open Google<ArrowUpRight size={14} /></a>
              <form className={styles.mailForm} onSubmit={saveMail}>
                <input type="email" value={address} onChange={e => setAddress(e.target.value)} placeholder="you@gmail.com" aria-label="Gmail address"
                  autoComplete="email" autoCapitalize="off" spellCheck={false} />
                <div className={styles.paste}>
                  <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="App password" aria-label="App password"
                    autoComplete="new-password" autoCorrect="off" autoCapitalize="off" spellCheck={false} />
                  <button type="submit" disabled={!address.trim() || !password.trim() || !!saving}>{saving === 'mail' ? 'Checking…' : 'Save'}</button>
                </div>
              </form>
            </>
          )}
      </div>

      <p className={styles.muted}>Jarvis only reads. Claude sorts your mail; the free Gemini never sees it.</p>
    </section>
  )
}

// Asks once more, for three seconds
function Remove({ what, onDone }) {
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t) }, [sure])
  const remove = async () => {
    const res = await unlinkDay(what)
    if (res.error) { toast.error(res.why || 'Could not remove it. Try again.'); return }
    toast.success(what === 'mail' ? 'Gmail removed' : 'Calendar removed')
    onDone()
  }
  return sure
    ? <button className={styles.remove} onClick={remove}>Remove {what === 'mail' ? 'Gmail' : 'the calendar'}?</button>
    : <button className={styles.remove} onClick={() => setSure(true)}>Remove</button>
}
