// Memory: what Jarvis keeps for you (see netlify/lib/memory.mjs). Only your login can use it.
//   GET                                        → { items } newest first
//   POST { text, from }                        → saves a note → { item }
//   POST { action: 'delete', id }              → removes a note
//   POST { action: 'hide', id }                → takes one of Claude's replies off Evolve
//   POST { action: 'read', name, type, data }  → Gemini reads a PDF or photo (base64) and saves
//                                                its key points as a note (needs GEMINI_API_KEY)
import { randomUUID } from 'node:crypto'
import { json, owner, geminiKey, askGemini, geminiProblem, GEMINI_BUSY, GEMINI_LIMIT } from '../lib/common.mjs'
import { readMemory, writeMemory, LIMIT, MAX_TEXT, FROM, STORAGE_DOWN } from '../lib/memory.mjs'

const FULL = `Memory is full (${LIMIT} notes). Delete a few old ones first.`
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_FILE = 4 * 1024 * 1024   // Netlify takes about 6 MB per request; base64 adds a third

const READ = `Read this document for a senior GST (CGST) officer in India and write it up as a note they can keep.
First line: a short title (what it is, who it concerns, its number and date if shown).
Then the key facts, one per line starting with "- ": kind of document; from and to; reference numbers and dates;
GSTIN and trade name; tax period; sections, rules, notifications and circulars cited; amounts (tax, interest,
penalty, refund) with what each is for; what is alleged, demanded, ordered or asked; deadlines and hearing dates.
Then 2 to 4 sentences summing it up. Plain text only, no markdown, at most 600 words.
Copy numbers, names and dates exactly as written; never guess one. If something can't be read, say so.`

async function add(user, item) {
  const doc = await readMemory(user.id)
  if (doc.items.length >= LIMIT) return null
  doc.items.push(item)
  await writeMemory(user.id, doc)
  return item
}

const note = (text, from, title) => ({
  id: randomUUID(),
  text: text.slice(0, MAX_TEXT),
  at: new Date().toISOString(),
  from: FROM.includes(from) ? from : 'you',
  ...(title && { title: String(title).slice(0, 120) }),
})

async function read(user, { name = '', type = '', data = '' }) {
  const { key, why } = geminiKey()
  if (why) return json({ error: 'bad_key', why }, 503)
  if (!key) return json({ error: 'not_configured', why: 'Reading documents needs the free Gemini key in Netlify.' }, 503)
  if (!TYPES.includes(type)) return json({ error: 'bad_file', why: 'Jarvis reads PDFs and photos only.' }, 400)
  if (!data || data.length * 0.75 > MAX_FILE) return json({ error: 'too_big', why: 'This file is too big (over 4 MB). Try a smaller PDF, or a photo of the main pages.' }, 413)

  const res = await askGemini(key, {
    contents: [{ role: 'user', parts: [{ inlineData: { mimeType: type, data } }, { text: READ }] }],
    generationConfig: { maxOutputTokens: 2048 },
  }, 25000)
  if (!res || res.status >= 500) return json({ error: 'busy', why: GEMINI_BUSY }, 503)
  if (res.status === 429) return json({ error: 'busy', why: GEMINI_LIMIT }, 429)
  if (!res.ok) {
    const problem = geminiProblem(await res.text())
    return json({ error: problem ? 'bad_key' : 'api', why: problem || "Google couldn't read this file. Try a clearer photo or another PDF." }, 502)
  }
  const out = await res.json()
  const text = out.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim()
  if (!text) return json({ error: 'api', why: "Google couldn't read this file. Try a clearer photo or another PDF." }, 502)
  const item = await add(user, note(text, 'document', name))
  return item ? json({ item }) : json({ error: 'full', why: FULL }, 409)
}

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    if (req.method === 'GET') {
      const { items } = await readMemory(user.id)
      return json({ items: [...items].sort((a, b) => b.at.localeCompare(a.at)) })
    }

    const body = await req.json().catch(() => ({}))
    if (body.action === 'read') return await read(user, body)

    if (body.action === 'delete' || body.action === 'hide') {
      const id = body.id
      if (!id || (typeof id !== 'string' && !Number.isInteger(id))) return json({ error: 'bad_request' }, 400)
      const doc = await readMemory(user.id)
      if (body.action === 'delete') doc.items = doc.items.filter(m => m.id !== id)
      else doc.hidden = [...new Set([...doc.hidden, id])].slice(-500)
      await writeMemory(user.id, doc)
      return json({ ok: true })
    }

    const text = String(body.text || '').trim()
    if (!text) return json({ error: 'empty' }, 400)
    const item = await add(user, note(text, body.from, body.title))
    return item ? json({ item }) : json({ error: 'full', why: FULL }, 409)
  } catch {
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
