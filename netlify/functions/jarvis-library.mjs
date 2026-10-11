// Library: documents kept in full (see netlify/lib/library.mjs). Only your login can use it.
//   GET                                          → { docs } newest first
//   POST { action: 'start', name }               → a new document → { id }
//   POST { action: 'append', id, pages }         → adds pages of text [{ p, t }] (in batches)
//   POST { action: 'finish', id }                → the document is complete and searchable
//   POST { action: 'delete', id }                → removes it
//   POST { action: 'ocr', type, data }           → Gemini reads the text off one photo or scanned
//                                                  page (base64) → { text }; nothing is kept
import { randomUUID } from 'node:crypto'
import { json, owner, geminiKey, askGemini, geminiProblem, GEMINI_BUSY, GEMINI_LIMIT } from '../lib/common.mjs'
import { readIndex, writeIndex, readDoc, writeDoc, removeDoc, chunkPage, MAX_DOCS, MAX_CHARS, MAX_TOTAL } from '../lib/library.mjs'
import { STORAGE_DOWN } from '../lib/memory.mjs'

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_IMAGE = 4 * 1024 * 1024
const OCR = `Copy out all the text on this page exactly as written, top to bottom, keeping line breaks,
numbering and headings. For tables, put one row per line with cells separated by " | ".
Copy numbers, names, dates and amounts exactly; never guess. Write [unclear] where you can't read something.
Output only the text, no comments.`

async function ocr({ type = '', data = '' }) {
  const { key, why } = geminiKey()
  if (why) return json({ error: 'bad_key', why }, 503)
  if (!key) return json({ error: 'not_configured', why: 'Reading photos and scanned pages needs the free Gemini key in Netlify.' }, 503)
  if (!IMAGES.includes(type)) return json({ error: 'bad_file', why: 'Jarvis reads PDFs, photos and text files.' }, 400)
  if (!data || data.length * 0.75 > MAX_IMAGE) return json({ error: 'too_big', why: 'This photo is too big (over 4 MB).' }, 413)
  const res = await askGemini(key, {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: type, data } }, { text: OCR }] }],
    generationConfig: { maxOutputTokens: 8192 },
  }, 25000)
  if (!res || res.status >= 500) return json({ error: 'busy', why: GEMINI_BUSY }, 503)
  if (res.status === 429) return json({ error: 'busy', why: GEMINI_LIMIT }, 429)
  if (!res.ok) {
    const problem = geminiProblem(await res.text())
    return json({ error: problem ? 'bad_key' : 'api', why: problem || "Google couldn't read this page. Try a clearer photo." }, 502)
  }
  const out = await res.json()
  return json({ text: out.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim() || '' })
}

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    if (req.method === 'GET') {
      const docs = (await readIndex(user.id)).sort((a, b) => b.at.localeCompare(a.at))
      return json({ docs })
    }

    const body = await req.json().catch(() => ({}))
    if (body.action === 'ocr') return await ocr(body)

    const index = await readIndex(user.id)
    if (body.action === 'start') {
      const name = String(body.name || '').trim().slice(0, 120) || 'Document'
      if (index.length >= MAX_DOCS) return json({ error: 'full', why: `Your Library is full (${MAX_DOCS} documents). Delete some first.` }, 409)
      const id = randomUUID()
      await writeDoc(user.id, { id, name, chunks: [] })
      await writeIndex(user.id, [...index, { id, name, pages: 0, chars: 0, at: new Date().toISOString(), ready: false }])
      return json({ id })
    }

    const entry = index.find(d => d.id === body.id)
    if (!entry) return json({ error: 'not_found', why: "That document isn't in your Library any more." }, 404)

    if (body.action === 'append') {
      const pages = Array.isArray(body.pages) ? body.pages : []
      const doc = await readDoc(user.id, entry.id) || { id: entry.id, name: entry.name, chunks: [] }
      const adding = pages.flatMap(pg => chunkPage(Number(pg.p) || 0, pg.t))
      const chars = adding.reduce((n, c) => n + c.t.length, 0)
      const total = index.reduce((n, d) => n + (d.chars || 0), 0)
      if (entry.chars + chars > MAX_CHARS) return json({ error: 'too_big', why: 'This document is too long for Jarvis (over about 2,000 pages of text).' }, 413)
      if (total + chars > MAX_TOTAL) return json({ error: 'full', why: 'Your Library is full. Delete some documents first.' }, 409)
      doc.chunks.push(...adding)
      await writeDoc(user.id, doc)
      entry.chars += chars
      entry.pages = Math.max(entry.pages, ...pages.map(pg => Number(pg.p) || 0))
      await writeIndex(user.id, index)
      return json({ ok: true })
    }
    if (body.action === 'finish') {
      if (!entry.chars) return json({ error: 'empty', why: 'Jarvis found no text in this document.' }, 400)
      entry.ready = true
      await writeIndex(user.id, index)
      return json({ doc: entry })
    }
    if (body.action === 'delete') {
      await removeDoc(user.id, entry.id)
      await writeIndex(user.id, index.filter(d => d.id !== entry.id))
      return json({ ok: true })
    }
    return json({ error: 'bad_request' }, 400)
  } catch {
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
