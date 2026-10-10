// Search: type or say anything. Jarvis shows the latest Google News headlines and Wikipedia
// right here (free, no key), and a short answer on top once the free Gemini key is added.
// Google itself is one tap away for everything else.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatDistanceToNowStrict } from 'date-fns'
import { Volume2, Copy, ArrowUpRight, Sparkles, Clock } from 'lucide-react'
import { searchWeb, searchAnswer } from '../lib/server'
import { googleLink } from '../lib/assistant'
import CommandBox from './CommandBox'
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
  const [res, setRes]   = useState(last)   // { q, news, wiki, answer, thinking, error }
  const show = (r) => { last = r; setRes(r) }

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
    show({ ...base, answer: a.error ? null : a.text, answerError: a.error && (ERRORS[a.error] || null) })
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
      <CommandBox value={text} onChange={setText} onSubmit={search} placeholder="Search anything…" label="Search" />

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
                    </div>
                  </>
                : <p className={styles.muted}>Thinking…</p>}
            </div>
          )}
          {res.answerError && <p className={styles.muted}>{res.answerError}</p>}

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
