// Your Library: documents kept in full (the Acts and Rules, notices, orders, circulars, letters),
// so Assist and Search can quote them. The app reads each document on the phone (PDF text, or
// the AI for scanned pages and photos) and sends the text here page by page. For each question
// Jarvis finds the passages that match best and hands only those to the AI, the way ChatGPT
// works with files: a whole Act is far too long to send with every question.
// Kept in Netlify Blobs, per login:
//   <user>/index     → [{ id, name, pages, chars, at, ready }]
//   <user>/doc/<id>  → { id, name, chunks: [{ p: page, t: text }] }
import { getStore } from '@netlify/blobs'

export const MAX_DOCS = 200
export const MAX_CHARS = 4_000_000          // in one document (a long Act with all its forms fits)
export const MAX_TOTAL = 12_000_000         // in the whole Library
const CHUNK = 1500                          // characters in one passage

const store = () => getStore({ name: 'jarvis-library', consistency: 'strong' })
const indexKey = (user) => `${user}/index`
const docKey = (user, id) => `${user}/doc/${id}`

export async function readIndex(user) {
  const list = await store().get(indexKey(user), { type: 'json' })
  return Array.isArray(list) ? list : []
}
export const writeIndex = (user, list) => store().setJSON(indexKey(user), list)
export const readDoc = (user, id) => store().get(docKey(user, id), { type: 'json' })
export const writeDoc = (user, doc) => store().setJSON(docKey(user, doc.id), doc)
export const removeDoc = (user, id) => store().delete(docKey(user, id))

// A page split into passages of about CHUNK characters, at line breaks where possible
export function chunkPage(p, text) {
  const out = []
  let rest = String(text || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  while (rest.length > CHUNK * 1.3) {
    let cut = rest.lastIndexOf('\n', CHUNK)
    if (cut < CHUNK * 0.5) cut = rest.lastIndexOf(' ', CHUNK)
    if (cut < CHUNK * 0.5) cut = CHUNK
    out.push({ p, t: rest.slice(0, cut).trim() })
    rest = rest.slice(cut).trim()
  }
  if (rest) out.push({ p, t: rest })
  return out
}

const STOP = new Set(('the a an and or of to in on for by with from at as is are was were be been it its this that these those ' +
  'what which who whom whose when where why how can could should would will shall may might must do does did done ' +
  'me my i you your we our us they them their he she his her please tell explain give show about under into any all ' +
  'there here than then also not no yes if so such per vide said one two jarvis').split(' '))

// Words worth searching for: "refunds" also finds refund, refunded
export function terms(q) {
  const words = String(q).toLowerCase().match(/[a-z0-9][a-z0-9/()-]*/g) || []
  return [...new Set(words
    .map(w => w.replace(/[()]+$/, ''))
    .filter(w => (w.length > 2 || /\d/.test(w)) && !STOP.has(w))
    .map(w => (w.length > 4 && /[^s]s$/.test(w) ? w.slice(0, -1) : w)))].slice(0, 16)
}

// "section 16(4)", "s. 74A", "u/s 73", "rule 86A", "r 36(4)" → which number, and whether a rule
export function refs(q) {
  const out = []
  for (const m of String(q).matchAll(/\b(sections?|sec|s|u\/s|rules?|r)\.?\s*(\d{1,3}[a-z]{0,2})\b/gi)) {
    out.push({ n: m[2].toUpperCase(), rule: /^r/i.test(m[1]) })
  }
  return out
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const count = (text, re) => (text.match(re) || []).length

// The best passages for a question: Okapi BM25 over every passage, plus a strong lift for a
// passage where the section or rule asked about begins ("73. (1) Where…"), and for documents
// opened in this chat (`docs`). A short document opened in this chat goes in whole.
export async function searchLibrary(user, q, { docs = [], budget = 24000 } = {}) {
  const index = (await readIndex(user)).filter(d => d.ready)
  if (!index.length) return { list: [], text: '' }
  const all = (await Promise.all(index.map(d => readDoc(user, d.id).catch(() => null)))).filter(Boolean)
  const list = index.map(d => `${d.name} (${d.pages} page${d.pages === 1 ? '' : 's'})`)

  const picked = new Set(docs)
  const whole = []
  let room = budget
  for (const d of all.filter(d => picked.has(d.id))) {
    const size = d.chunks.reduce((n, c) => n + c.t.length, 0)
    if (size <= Math.min(room, 40000)) { whole.push(d.id); room -= size }
  }

  const words = terms(q), asked = refs(q)
  const passages = all.filter(d => !whole.includes(d.id)).flatMap(d => d.chunks.map((c, i) => ({ d, i, c, low: c.t.toLowerCase() })))
  const df = new Map(words.map(w => [w, 0]))
  const pats = new Map(words.map(w => [w, new RegExp(`(^|[^a-z0-9])${esc(w)}`, 'g')]))
  for (const x of passages) for (const w of words) if (x.low.includes(w)) df.set(w, df.get(w) + 1)
  const N = passages.length || 1
  const avg = passages.reduce((n, x) => n + x.c.t.length, 0) / N || 1
  const heads = asked.map(r => ({ ...r, start: new RegExp(`(^|\\n)\\s*\\[?${esc(r.n)}\\.\\s`, 'i'), named: new RegExp(`\\b(section|rule)s?\\s+${esc(r.n)}\\b`, 'i') }))

  for (const x of passages) {
    let s = 0
    for (const w of words) {
      if (!df.get(w) || !x.low.includes(w)) continue
      const tf = count(x.low, pats.get(w))
      const idf = Math.log(1 + (N - df.get(w) + 0.5) / (df.get(w) + 0.5))
      s += idf * (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * x.c.t.length / avg))
    }
    for (const h of heads) {
      const right = h.rule ? /rule/i.test(x.d.name) : !/rule/i.test(x.d.name)
      if (h.start.test(x.c.t)) s += right ? 12 : 4
      else if (h.named.test(x.c.t)) s += 1.5
    }
    if (picked.has(x.d.id)) s *= 2
    x.s = s
  }

  // Best first; a section that runs past its passage brings the next one along
  const chosen = new Map()
  const take = (x) => {
    const key = `${x.d.id}:${x.i}`
    if (chosen.has(key) || x.c.t.length > room) return
    chosen.set(key, x); room -= x.c.t.length
  }
  const ranked = passages.filter(x => x.s > 0).sort((a, b) => b.s - a.s)
  for (const [k, x] of ranked.slice(0, 40).entries()) {
    if (room < 500) break
    take(x)
    const next = x.d.chunks[x.i + 1]
    if (k < 3 && next) take({ d: x.d, i: x.i + 1, c: next })
  }

  const parts = [
    ...all.filter(d => whole.includes(d.id)).map(d => `[${d.name}, all of it]\n` + d.chunks.map(c => c.t).join('\n')),
    // best first, each continuation right after the passage it continues
    ...[...chosen.values()].map(x => `[${x.d.name}, page ${x.c.p}]\n${x.c.t}`),
  ]
  return { list, text: parts.join('\n\n') }
}

// What the AI is told about the Library with each question
export function libraryPrompt({ list, text }) {
  if (!list.length) return 'Their Library is empty. If they want answers from the bare Act, Rules or their own notices and orders, suggest adding the PDFs with the paperclip in Assist.'
  return `Their Library (documents they added, kept in full): ${list.join('; ')}.\n` +
    (text
      ? 'Passages from it that match this question follow, best first. Base your answer on them when they cover the question, quote the key words, and name the document and page. If they do not cover it, say so and answer from your own knowledge.\n\n' + text
      : 'No passage in it matches this question; answer from your own knowledge and say so.')
}

// The Library is extra: if it can't be read, Search and Assist still answer
export async function libraryFor(user, q, opts) {
  try { return libraryPrompt(await searchLibrary(user.id, q, opts)) } catch { return '' }
}
