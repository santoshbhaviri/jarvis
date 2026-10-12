// Your Knowledge: notes and preferences (Memory), whole documents (Library) and Assist chats.
// Until the setup code has run in Supabase (supabase-knowledge.sql) and your Memory and Library
// have moved there, they stay in Netlify Blobs as before, with no setup. After the move they live
// in your own Supabase database, where they can keep growing; the Netlify copy stays as a backup.
//   const k = await openStore(req, user)
//   k.notes.list() / add({ text, from, title }) / edit(id, text) / remove(id)
//   k.docs.list() / start(name) / append(id, pages) / finish(id) / remove(id) / search(q, opts)
//   k.chats.add(question, answer) / recall(q, skip) / count() / clear()   (Supabase only)
// A refusal the app should show comes as a Refused error: { status, error, why }.
import { createHash, randomUUID } from 'node:crypto'
import { getStore } from '@netlify/blobs'
import { db, setUp } from './supa.mjs'
import { readMemory, writeMemory, memoryText, LIMIT, MAX_TEXT, FROM } from './memory.mjs'
import {
  readIndex, writeIndex, readDoc, writeDoc, removeDoc, chunkPage, searchLibrary,
  rankPassages, pickPassages, passageText, docLine, tsQuery, headsPattern, terms, libraryPrompt,
  MAX_DOCS, MAX_CHARS, MAX_TOTAL,
} from './library.mjs'

export class Refused extends Error {
  constructor(status, error, why) { super(why || error); Object.assign(this, { status, error, why }) }
}
const FULL_NOTES = `Memory is full (${LIMIT} notes). Delete a few old ones first.`
const FULL_DOCS = `Your Library is full (${MAX_DOCS} documents). Delete some first.`
const GONE = "That document isn't in your Library any more."
const TOO_LONG = 'This document is too long for Jarvis (over about 2,000 pages of text).'
const FULL_LIBRARY = 'Your Library is full. Delete some documents first.'
const EMPTY_DOC = 'Jarvis found no text in this document.'
const MAX_NOTES = 5000          // in Supabase

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isId = (id) => typeof id === 'string' && UUID.test(id)
// Supabase wants UUIDs; an older id becomes the same UUID every time, so moving twice is harmless
const asUuid = (id) => {
  if (isId(String(id))) return String(id)
  const h = createHash('sha1').update(`jarvis:${id}`).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
}
const clip = (s, n) => String(s || '').slice(0, n)

// Where this login's Knowledge is: once moved, always Supabase
const settings = () => getStore({ name: 'jarvis-settings', consistency: 'strong' })
const movedKey = (user) => `moved/${user.id}`
const movedUsers = new Set()
export async function moved(user) {
  if (movedUsers.has(user.id)) return true
  const p = await settings().get(movedKey(user), { type: 'json' }).catch(() => null)
  if (p?.done) movedUsers.add(user.id)
  return !!p?.done
}

export async function openStore(req, user) {
  return (await moved(user)) ? supabaseStore(req) : netlifyStore(user)
}

// What Search and Assist read before answering: your notes (in the instructions, the same for
// every question), and beside the question the Library passages, older notes and (in Assist)
// earlier chats that match it. Each part is extra: if one can't be read, the answer still comes.
//   → { k: the store, items: your notes, text, extra }
export async function knowledgeFor(req, user, q, { docs = [], budget = 24000, chats = false, skip = [] } = {}) {
  const k = await openStore(req, user).catch(() => null)
  if (!k) return { k: null, items: [], text: '', extra: '' }
  const [items, library, earlier] = await Promise.all([
    k.notes.list().catch(() => []),
    k.docs.search(q, { docs, budget }).then(libraryPrompt).catch(() => ''),
    chats ? k.chats.recall(q, skip).catch(() => '') : '',
  ])
  const memory = memoryText(items, q)
  return { k, items, text: memory.text, extra: [library, memory.extra, earlier].filter(Boolean).join('\n\n') }
}

// ---------------------------------------------------------------- Netlify Blobs (as before)
function netlifyStore(user) {
  const notes = {
    async list() {
      const { items } = await readMemory(user.id)
      return [...items].sort((a, b) => b.at.localeCompare(a.at))
    },
    async add({ text, from, title }) {
      const doc = await readMemory(user.id)
      if (doc.items.length >= LIMIT) throw new Refused(409, 'full', FULL_NOTES)
      const item = {
        id: randomUUID(), text: clip(text, MAX_TEXT), at: new Date().toISOString(),
        from: FROM.includes(from) ? from : 'you', ...(title && { title: clip(title, 120) }),
      }
      doc.items.push(item)
      await writeMemory(user.id, doc)
      return item
    },
    async edit(id, text) {
      const doc = await readMemory(user.id)
      const item = doc.items.find(m => m.id === id)
      if (!item) return null
      item.text = clip(text, MAX_TEXT)
      await writeMemory(user.id, doc)
      return item
    },
    async remove(id) {
      const doc = await readMemory(user.id)
      doc.items = doc.items.filter(m => m.id !== id)
      await writeMemory(user.id, doc)
    },
  }

  const docs = {
    async list() { return (await readIndex(user.id)).sort((a, b) => b.at.localeCompare(a.at)) },
    async start(name) {
      const index = await readIndex(user.id)
      if (index.length >= MAX_DOCS) throw new Refused(409, 'full', FULL_DOCS)
      const id = randomUUID()
      await writeDoc(user.id, { id, name, chunks: [] })
      await writeIndex(user.id, [...index, { id, name, pages: 0, chars: 0, at: new Date().toISOString(), ready: false }])
      return id
    },
    async append(id, pages) {
      const index = await readIndex(user.id)
      const entry = index.find(d => d.id === id)
      if (!entry) throw new Refused(404, 'not_found', GONE)
      const doc = await readDoc(user.id, entry.id) || { id: entry.id, name: entry.name, chunks: [] }
      const adding = pages.flatMap(pg => chunkPage(Number(pg.p) || 0, pg.t))
      const chars = adding.reduce((n, c) => n + c.t.length, 0)
      const total = index.reduce((n, d) => n + (d.chars || 0), 0)
      if (entry.chars + chars > MAX_CHARS) throw new Refused(413, 'too_big', TOO_LONG)
      if (total + chars > MAX_TOTAL) throw new Refused(409, 'full', FULL_LIBRARY)
      doc.chunks.push(...adding)
      await writeDoc(user.id, doc)
      entry.chars += chars
      entry.pages = Math.max(entry.pages, ...pages.map(pg => Number(pg.p) || 0))
      await writeIndex(user.id, index)
    },
    async finish(id) {
      const index = await readIndex(user.id)
      const entry = index.find(d => d.id === id)
      if (!entry) throw new Refused(404, 'not_found', GONE)
      if (!entry.chars) throw new Refused(400, 'empty', EMPTY_DOC)
      entry.ready = true
      await writeIndex(user.id, index)
      return entry
    },
    async remove(id) {
      const index = await readIndex(user.id)
      if (!index.some(d => d.id === id)) throw new Refused(404, 'not_found', GONE)
      await removeDoc(user.id, id)
      await writeIndex(user.id, index.filter(d => d.id !== id))
    },
    search: (q, opts) => searchLibrary(user.id, q, opts),
  }

  const chats = { add: async () => {}, recall: async () => '', count: async () => 0, clear: async () => {} }
  return { where: 'netlify', notes, docs, chats }
}

// ---------------------------------------------------------------- Supabase
function supabaseStore(req) {
  const sb = db(req)
  const toItem = (r) => ({ id: r.id, text: r.text, ...(r.title && { title: r.title }), from: r.source, at: r.created_at })
  const toDoc = (r) => ({ id: r.id, name: r.name, pages: r.pages, chars: r.chars, ready: r.ready, at: r.created_at })
  const NOTE = 'id,text,title,source,created_at'
  const DOC = 'id,name,pages,chars,ready,created_at'

  const notes = {
    async list() { return (await sb.get(`jarvis_notes?select=${NOTE}&order=created_at.desc&limit=${MAX_NOTES}`)).map(toItem) },
    async add({ text, from, title }) {
      const row = { text: clip(text, MAX_TEXT), title: title ? clip(title, 120) : null, source: FROM.includes(from) ? from : 'you' }
      return toItem((await sb.post(`jarvis_notes?select=${NOTE}`, row))[0])
    },
    async edit(id, text) {
      if (!isId(id)) return null
      const rows = await sb.patch(`jarvis_notes?id=eq.${id}&select=${NOTE}`, { text: clip(text, MAX_TEXT), updated_at: new Date().toISOString() })
      return rows[0] ? toItem(rows[0]) : null
    },
    async remove(id) { if (isId(id)) await sb.del(`jarvis_notes?id=eq.${id}`) },
  }

  const one = async (id) => {
    const rows = isId(id) ? await sb.get(`jarvis_documents?id=eq.${id}&select=${DOC}`) : []
    if (!rows.length) throw new Refused(404, 'not_found', GONE)
    return toDoc(rows[0])
  }
  const docs = {
    async list() { return (await sb.get(`jarvis_documents?select=${DOC}&order=created_at.desc`)).map(toDoc) },
    async start(name) {
      if ((await sb.get('jarvis_documents?select=id')).length >= MAX_DOCS) throw new Refused(409, 'full', FULL_DOCS)
      return (await sb.post('jarvis_documents?select=id', { name }))[0].id
    },
    async append(id, pages) {
      const doc = await one(id)
      const adding = pages.flatMap(pg => chunkPage(Number(pg.p) || 0, pg.t))
      const chars = adding.reduce((n, c) => n + c.t.length, 0)
      const total = (await sb.get('jarvis_documents?select=chars')).reduce((n, d) => n + (d.chars || 0), 0)
      if (doc.chars + chars > MAX_CHARS) throw new Refused(413, 'too_big', TOO_LONG)
      if (total + chars > MAX_TOTAL) throw new Refused(409, 'full', FULL_LIBRARY)
      const last = (await sb.get(`jarvis_passages?doc_id=eq.${id}&select=seq&order=seq.desc&limit=1`))[0]?.seq ?? -1
      const rows = adding.map((c, k) => ({ doc_id: id, seq: last + 1 + k, page: c.p, text: c.t }))
      for (let k = 0; k < rows.length; k += 500) await sb.upsert('jarvis_passages', rows.slice(k, k + 500))
      await sb.patch(`jarvis_documents?id=eq.${id}`, {
        chars: doc.chars + chars, pages: Math.max(doc.pages, ...pages.map(pg => Number(pg.p) || 0)),
      })
    },
    async finish(id) {
      const doc = await one(id)
      if (!doc.chars) throw new Refused(400, 'empty', EMPTY_DOC)
      return toDoc((await sb.patch(`jarvis_documents?id=eq.${id}&select=${DOC}`, { ready: true }))[0])
    },
    async remove(id) {
      await one(id)
      await sb.del(`jarvis_documents?id=eq.${id}`)   // its passages go with it
    },
    // Supabase finds up to 200 passages that share words with the question (or where the section
    // asked about begins); Jarvis ranks those the same way as on Netlify
    async search(q, { docs: opened = [], budget = 24000 } = {}) {
      const index = (await docs.list()).filter(d => d.ready)
      if (!index.length) return { list: [], text: '' }
      const picked = new Set(opened)
      let room = budget
      const whole = []
      for (const d of index.filter(d => picked.has(d.id))) {
        if (d.chars <= Math.min(room, 40000)) { whole.push(d); room -= d.chars }
      }
      const wholeText = await Promise.all(whole.map(async d =>
        `[${d.name}, all of it]\n` + (await sb.get(`jarvis_passages?doc_id=eq.${d.id}&select=text&order=seq`)).map(r => r.text).join('\n')))

      const query = tsQuery(q), heads = headsPattern(q)
      const found = query || heads ? await sb.rpc('jarvis_search', { q: query, heads: heads || null, how_many: 200 }) : []
      const skip = new Set(whole.map(d => d.id))
      const ranked = rankPassages(found.filter(r => !skip.has(r.doc_id))
        .map(r => ({ d: { id: r.doc_id, name: r.name }, i: r.seq, c: { p: r.page, t: r.text } })), q, picked)
      // The passage after each of the best three, for a section that runs on
      const after = ranked.slice(0, 3).map(x => `and(doc_id.eq.${x.d.id},seq.eq.${x.i + 1})`)
      const nexts = after.length ? await sb.get(`jarvis_passages?select=doc_id,seq,page,text&or=(${after.join(',')})`) : []
      const next = (x) => {
        const r = nexts.find(n => n.doc_id === x.d.id && n.seq === x.i + 1)
        return r && { d: x.d, i: r.seq, c: { p: r.page, t: r.text } }
      }
      const chosen = pickPassages(ranked, room, next)
      return { list: index.map(docLine), text: [...wholeText, ...chosen.map(passageText)].join('\n\n') }
    },
  }

  const chats = {
    async add(question, answer) {
      await sb.post('jarvis_chats', { question: clip(question, 8000), answer: clip(answer, 20000) }, 'return=minimal')
    },
    // Up to two earlier conversations that share most words with the question; skip: questions
    // already in this chat
    async recall(q, skip = []) {
      const query = tsQuery(q)
      if (!query) return ''
      const rows = await sb.get(`jarvis_chats?select=question,answer,created_at&words=fts(english).${encodeURIComponent(query)}&order=created_at.desc&limit=40`)
      const words = terms(q)
      const seen = new Set(skip.map(s => s.trim()))
      const best = rows
        .filter(r => !seen.has(r.question.trim()))
        .map(r => ({ r, n: words.filter(w => `${r.question} ${r.answer}`.toLowerCase().includes(w)).length }))
        .filter(x => x.n >= Math.min(2, words.length))
        .sort((a, b) => b.n - a.n)
        .slice(0, 2)
      if (!best.length) return ''
      return 'Earlier conversations with them that may help (use them only if they are relevant to this question):\n' +
        best.map(({ r }) => `[${r.created_at.slice(0, 10)}] They asked: ${clip(r.question, 600)}\nYou answered: ${clip(r.answer, 1500)}`).join('\n\n')
    },
    async count() { return sb.count('jarvis_chats') },
    async clear() { await sb.del('jarvis_chats?id=not.is.null') },
  }
  return { where: 'supabase', notes, docs, chats }
}

// ---------------------------------------------------------------- Moving to Supabase
// One step of the move, until about `until`: notes first, then each document (in passages of
// 300). It picks up where it stopped, and copying anything twice is harmless. Returns
// { done, docs, of }. Nothing on Netlify is deleted.
export async function moveStep(req, user, until) {
  const key = movedKey(user)
  const p = (await settings().get(key, { type: 'json' })) || {}
  if (p.done) return { done: true }
  if ((await setUp(req)) !== true) throw new Refused(409, 'not_set_up', 'Paste the setup code in Supabase first.')
  const sb = db(req)
  p.docs ||= []
  const save = () => settings().setJSON(key, p)

  const copyNotes = async () => {
    const { items } = await readMemory(user.id)
    for (let k = 0; k < items.length; k += 200) {
      await sb.upsert('jarvis_notes', items.slice(k, k + 200).map(m => ({
        id: asUuid(m.id), text: clip(m.text, MAX_TEXT), title: m.title || null,
        source: FROM.includes(m.from) ? m.from : 'you', created_at: m.at, updated_at: m.at,
      })))
    }
  }
  if (!p.notes) { await copyNotes(); p.notes = true; await save() }

  const index = (await readIndex(user.id)).filter(d => d.ready)
  const progress = (done) => ({ done, docs: p.docs.length, of: index.length })
  let did = false   // each step moves at least one batch, however slow Supabase is
  for (const d of index) {
    if (p.docs.includes(d.id)) continue
    if (did && Date.now() > until) return progress(false)
    const id = asUuid(d.id)
    const chunks = (await readDoc(user.id, d.id))?.chunks || []
    await sb.upsert('jarvis_documents', [{ id, name: d.name, pages: d.pages, chars: d.chars, ready: false, created_at: d.at }])
    let k = p.part?.id === d.id ? p.part.k : 0
    for (; k < chunks.length; k += 300) {
      if (did && Date.now() > until) { p.part = { id: d.id, k }; await save(); return progress(false) }
      await sb.upsert('jarvis_passages', chunks.slice(k, k + 300).map((c, j) => ({ doc_id: id, seq: k + j, page: c.p, text: c.t })))
      did = true
    }
    await sb.patch(`jarvis_documents?id=eq.${id}`, { ready: true })
    p.docs.push(d.id); delete p.part
    await save()
  }
  await copyNotes()   // and any notes added while moving
  Object.assign(p, { done: true, at: new Date().toISOString() })
  await save()
  movedUsers.add(user.id)
  return progress(true)
}
