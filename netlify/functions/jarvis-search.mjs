// The Search tab. Free, no key needed:
//   GET ?q=…                 → latest Google News headlines and a Wikipedia summary
//   POST {q, news, wiki}     → a short answer written from those by Gemini (needs GEMINI_API_KEY)
// Gemini's free tier can't search Google itself, so Jarvis fetches the news first and hands it over.
import { env, json, owner } from '../lib/common.mjs'

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
Answer the question in 2 to 5 short sentences of plain text (no markdown, no headings), leading with the answer.
Use the news headlines and Wikipedia text given with the question when they are relevant, and say which source and how recent.
If they don't answer it, answer from your own knowledge and say it may be out of date, or say plainly that you don't know and that Google has more.
Never invent facts, figures, GO numbers or dates.`

export default async (req) => {
  if (!(await owner(req))) return json({ error: 'not_signed_in' }, 401)

  if (req.method === 'GET') {
    const q = (new URL(req.url).searchParams.get('q') || '').trim().slice(0, 200)
    if (!q) return json({ error: 'empty' }, 400)
    const [n, w] = await Promise.allSettled([news(q), wiki(q)])
    return json({ news: n.value || [], wiki: w.value || null, answers: !!env('GEMINI_API_KEY') })
  }

  const key = env('GEMINI_API_KEY')
  if (!key) return json({ error: 'not_configured' }, 503)
  const { q = '', news: found = [], wiki: w = null } = await req.json()
  if (!q.trim()) return json({ error: 'empty' }, 400)
  const sources = [
    `Today is ${new Date().toDateString()}.`,
    found.length ? 'News headlines:\n' + found.slice(0, 6).map(n => `- ${n.title} (${n.source}, ${n.date})`).join('\n') : 'No news headlines found.',
    w ? `Wikipedia, "${w.title}": ${String(w.extract).slice(0, 1500)}` : '',
  ].filter(Boolean).join('\n\n')

  const model = env('GEMINI_MODEL') || 'gemini-flash-latest'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents: [{ role: 'user', parts: [{ text: `${sources}\n\nQuestion: ${q.slice(0, 500)}` }] }],
      generationConfig: { maxOutputTokens: 600 },
    }),
  })
  if (res.status === 429) return json({ error: 'busy' }, 429)
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: /API key|PERMISSION|UNAUTHENTICATED/i.test(detail) ? 'bad_key' : 'api' }, 502)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
  return text ? json({ text }) : json({ error: 'api' }, 502)
}
