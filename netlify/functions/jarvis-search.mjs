// The Search tab. Free, no key needed:
//   GET ?q=…                 → latest Google News headlines and a Wikipedia summary
//   POST {q, news, wiki}     → a short answer written from those by Claude (or the free Gemini key
//                              until Claude is connected), with your Memory and Library in mind
// Jarvis fetches the news first and hands it over with the question.
import { json, owner, geminiKey } from '../lib/common.mjs'
import { askAI, aiReady } from '../lib/ai.mjs'
import { memoryFor } from '../lib/memory.mjs'
import { libraryFor } from '../lib/library.mjs'

const UA = 'Jarvis personal assistant (https://github.com/santoshbhaviri/jarvis)'
const STOP = new Set('what who whom whose why how when where which is are was were the a an of in on for to and or about latest news today update updates tell me give show find search please jarvis does did can could should would'.split(' '))

const unescape = (s) => (s || '')
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
const tag = (xml, name) => unescape(xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`))?.[1] || '').trim()

async function get(url, as = 'text') {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(4000) })
  if (!res.ok) throw new Error(`${res.status}`)
  return as === 'json' ? res.json() : res.text()
}

// Google News, India edition: headline, source, when, link
async function news(q) {
  const xml = await get(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-IN&gl=IN&ceid=IN:en`)
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map(([, it]) => {
    const source = tag(it, 'source')
    const title = tag(it, 'title').replace(new RegExp(`\\s+-\\s+${source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`), '')
    return { title, source, date: tag(it, 'pubDate'), link: tag(it, 'link') }
  }).filter(n => n.title && /^https:\/\//.test(n.link))
}

// Wikipedia's summary of the best match, only when its title shares a real word with the question
async function wiki(q) {
  const words = q.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2 && !STOP.has(w))
  if (!words.length) return null
  const found = await get(`https://en.wikipedia.org/w/api.php?action=query&list=search&srlimit=1&format=json&srsearch=${encodeURIComponent(words.join(' '))}`, 'json')
  const title = found?.query?.search?.[0]?.title
  if (!title || !words.some(w => title.toLowerCase().includes(w))) return null
  const page = await get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, 'json')
  if (page.type !== 'standard' || !page.extract) return null
  return { title: page.title, extract: page.extract, link: page.content_urls?.mobile?.page || page.content_urls?.desktop?.page }
}

const SYSTEM = `You are Jarvis, the search assistant in a phone app used by a senior government officer in Telangana, India.
Answer the question in 2 to 5 short sentences of plain text (no markdown, no headings), leading with the answer. Go longer only when they ask for detail.
They may ask follow-up questions about your answer; answer those as a continuation of the same conversation.
Use the news headlines and Wikipedia text given with the question when they are relevant, and say which source and how recent.
If they don't answer it, answer from your own knowledge and say it may be out of date, or say plainly that you don't know and that Google has more.
For GST and tax law, name the section, rule, notification or circular when you are sure of it, and say the bare Act on cbic-gst.gov.in is the final word.
Never invent facts, figures, GO numbers, section or notification numbers, or dates.`

export default async (req) => {
  const began = Date.now()
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  if (req.method === 'GET') {
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 200)
    if (!q) return json({ error: 'empty' }, 400)
    const [n, w] = await Promise.allSettled([news(q), wiki(q)])
    return json({ news: n.value || [], wiki: w.value || null, answers: await aiReady() })
  }

  if (!(await aiReady())) {
    const { why } = geminiKey()
    return why ? json({ error: 'bad_key', why }, 503) : json({ error: 'not_configured' }, 503)
  }
  // turns: the conversation so far when you ask a follow-up ([{ role, text }], ending with yours)
  const { q = '', news: found = [], wiki: w = null, turns = [] } = await req.json()
  if (!q.trim()) return json({ error: 'empty' }, 400)
  const sources = [
    `Today is ${new Date().toDateString()}.`,
    found.length ? 'News headlines:\n' + found.slice(0, 6).map(n => `- ${n.title} (${n.source}, ${n.date})`).join('\n') : 'No news headlines found.',
    w ? `Wikipedia, "${w.title}": ${String(w.extract).slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n\n')

  const last = turns.length ? turns.at(-1).text : q
  const [memory, library] = await Promise.all([memoryFor(user), libraryFor(user, `${q}\n${last}`, { budget: 12000 })])
  const out = await askAI({
    system: [SYSTEM, memory].filter(Boolean).join('\n\n'), extra: library,
    turns: [
      { role: 'user', text: `${sources}\n\nQuestion: ${q.slice(0, 500)}` },
      // The first question carries the sources; later turns follow it (the last 12 at most)
      ...turns.slice(1).slice(-12).filter(t => t.text?.trim()).map(t => ({ role: t.role, text: String(t.text).slice(0, 4000) })),
    ],
    effort: 'low', maxTokens: 4096, until: began + 26000,
  })
  if (out.error) return json({ error: out.error, why: out.why }, out.status || 502)
  if (!out.text) return json({ error: 'api' }, 502)
  return json({ text: out.cut ? `${out.text} …` : out.text })
}
