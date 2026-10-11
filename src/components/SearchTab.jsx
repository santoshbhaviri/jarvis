// Search: type or say anything. Jarvis shows the latest Google News headlines and Wikipedia
// right here (free, no key), and a short answer on top once the free Gemini key is added.
// Google itself is one tap away for everything else. Once Jarvis has answered, the box moves
// under the answer and asks follow-ups in the same conversation; New topic starts afresh.
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNowStrict } from 'date-fns'
import { Volume2, Copy, ArrowUpRight, Sparkles, Clock, SquarePen } from 'lucide-react'
import { searchWeb, searchAnswer } from '../lib/server'
import { googleLink } from '../lib/assistant'
import CommandBox from './CommandBox'
import SaveButton from './SaveButton'
import styles from './SearchTab.module.css'

const RECENT = 'jarvis-searches'
const ERRORS = {
  offline: 'No internet connection.',
  busy: 'Too many searches in a short time. Try again in a minute.',
  bad_key: 'The Gemini key in Netlify was not accepted.',
  not_signed_in: 'Please sign out and sign in again.',
}
let last = null   // the last search stays when you switch tabs

const recent = () => { try { return JSON.parse(localStorage.getItem(RECENT)) || [] } catch { return [] } }
const remember = (q) => { try { localStorage.setItem(RECENT, JSON.stringify([q, ...recent().filter(r => r !== q)].slice(0, 6))) } catch { /* private mode */ } }
const ago = (d) => { try { return formatDistanceToNowStrict(new Date(d), { addSuffix: true }) } catch { return '' } }

export default function SearchTab() {
  const [text, setText] = useState('')
  const [res, setRes]   = useState(last)   // { q, news, wiki, answer, thinking, error, more: [{ q, answer, thinking, error }] }
  const show = (r) => { last = r; setRes(r) }
  const latest = useRef(null)
  const asking = res?.more?.some(m => m.thinking)
  const canFollow = !!res?.answer
  useEffect(() => { latest.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [res?.more?.length])

  const search = async (q) => {
    remember(q); setText('')
    show({ q, loading: true })
    const found = await searchWeb(q)
    if (found.error) { show({ q, error: ERRORS[found.error] || 'Search failed. Try again.' }); return }
    const base = { q, news: found.news, wiki: found.wiki }
    show({ ...base, thinking: found.answers })
    if (!found.answers) return
    const a = await searchAnswer(q, found)
    if (last?.q !== q) return   // a newer search started meanwhile
    show({ ...base, answer: a.error ? null : a.text, answerError: a.error && (a.why || ERRORS[a.error] || null) })
  }

  // A follow-up goes to Gemini with the same news and Wikipedia, and everything said so far
  const followUp = async (f) => {
    setText('')
    const topic = last
    const turns = [
      { role: 'user', text: topic.q }, { role: 'assistant', text: topic.answer },
      ...(topic.more || []).filter(m => m.answer).flatMap(m => [{ role: 'user', text: m.q }, { role: 'assistant', text: m.answer }]),
      { role: 'user', text: f },
    ]
    show({ ...topic, more: [...(topic.more || []), { q: f, thinking: true }] })
    const a = await searchAnswer(topic.q, topic, turns)
    if (last?.q !== topic.q || !last.more) return   // New topic meanwhile
    show({ ...last, more: last.more.map((m, i) => i < last.more.length - 1 ? m
      : { q: f, answer: a.error ? null : a.text, error: a.error && (a.why || ERRORS[a.error] || 'Could not answer. Try again.') }) })
  }

  const speak = (s) => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance(s); u.lang = 'en-IN'
    synth.speak(u)
  }
  const copy = async (s) => { try { await navigator.clipboard.writeText(s); toast.success('Copied') } catch { toast.error('Could not copy') } }

  const nothing = res && !res.loading && !res.error && !res.news?.length && !res.wiki && !res.answer && !res.thinking

  return (
    <div className={styles.tab}>
      {!canFollow && <CommandBox value={text} onChange={setText} onSubmit={search} placeholder="Search anything…" label="Search" />}

      {!res && recent().length > 0 && (
        <div className={styles.recent}>
          {recent().map(r => <button key={r} className={styles.chip} onClick={() => search(r)}><Clock size={13} />{r}</button>)}
        </div>
      )}

      {res && (
        <div className={styles.results}>
          <div className={styles.head}>
            <strong className={styles.q}>{res.q}</strong>
            <a className={styles.google} href={googleLink(res.q)} target="_blank" rel="noreferrer">Google<ArrowUpRight size={14} /></a>
          </div>

          {res.loading && <p className={styles.muted}>Searching…</p>}
          {res.error && <p className={styles.muted}>{res.error}</p>}
          {nothing && <p className={styles.muted}>Nothing found here. Tap Google for more.</p>}

          {(res.thinking || res.answer) && (
            <div className={styles.answer}>
              <div className={styles.answerHead}><Sparkles size={14} />Jarvis</div>
              {res.answer
                ? <>
                    <p>{res.answer}</p>
                    <div className={styles.tools}>
                      <button onClick={() => speak(res.answer)} aria-label="Read aloud"><Volume2 size={16} /></button>
                      <button onClick={() => copy(res.answer)} aria-label="Copy answer"><Copy size={15} /></button>
                      <SaveButton key={res.q} text={res.answer} from="search" title={res.q.slice(0, 120)} />
                    </div>
                  </>
                : <p className={styles.muted}>Thinking…</p>}
            </div>
          )}
          {res.answerError && <p className={styles.muted}>{res.answerError}</p>}

          {res.more?.map((m, i) => (
            <div key={i} className={styles.turn} ref={i === res.more.length - 1 ? latest : null}>
              <div className={styles.me}>{m.q}</div>
              {m.error
                ? <p className={styles.muted}>{m.error}</p>
                : (
                  <div className={styles.answer}>
                    {m.answer
                      ? <>
                          <p>{m.answer}</p>
                          <div className={styles.tools}>
                            <button onClick={() => speak(m.answer)} aria-label="Read aloud"><Volume2 size={16} /></button>
                            <button onClick={() => copy(m.answer)} aria-label="Copy answer"><Copy size={15} /></button>
                            <SaveButton text={m.answer} from="search" title={m.q.slice(0, 120)} />
                          </div>
                        </>
                      : <p className={styles.muted}>Thinking…</p>}
                  </div>
                )}
            </div>
          ))}

          {canFollow && (
            <div className={styles.follow}>
              <CommandBox value={text} onChange={setText} onSubmit={followUp} busy={asking} placeholder="Ask a follow-up…" label="Follow-up question" />
              <button className={styles.fresh} onClick={() => show(null)}><SquarePen size={15} />New topic</button>
            </div>
          )}

          {res.news?.length > 0 && <div className={styles.label}>Latest news</div>}
          {res.news?.length > 0 && (
            <ul className={styles.news} aria-label="News">
              {res.news.map(n => (
                <li key={n.link}>
                  <a href={n.link} target="_blank" rel="noreferrer">{n.title}</a>
                  <small>{n.source}{n.date ? ` · ${ago(n.date)}` : ''}</small>
                </li>
              ))}
            </ul>
          )}

          {res.wiki && (
            <div className={styles.wiki}>
              <div className={styles.wikiTitle}>{res.wiki.title} <small>Wikipedia</small></div>
              <p>{res.wiki.extract}</p>
              {res.wiki.link && <a href={res.wiki.link} target="_blank" rel="noreferrer">Read more<ArrowUpRight size={14} /></a>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
