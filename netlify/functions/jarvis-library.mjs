// Library: documents kept in full (see netlify/lib/library.mjs and store.mjs). Only your login can use it.
//   GET                                          → { docs } newest first
//   POST { action: 'start', name }               → a new document → { id }
//   POST { action: 'append', id, pages }         → adds pages of text [{ p, t }] (in batches)
//   POST { action: 'finish', id }                → the document is complete and searchable
//   POST { action: 'delete', id }                → removes it
//   POST { action: 'ocr', type, data }           → Claude (Haiku, or Gemini until Claude is connected)
//                                                  reads the text off one photo or scanned page
//                                                  (base64) → { text }; nothing is kept
import { json, owner, geminiKey } from '../lib/common.mjs'
import { askAI, aiReady } from '../lib/ai.mjs'
import { openStore, Refused } from '../lib/store.mjs'
import { STORAGE_DOWN } from '../lib/memory.mjs'

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const MAX_IMAGE = 4 * 1024 * 1024
const OCR = `Copy out all the text on this page exactly as written, top to bottom, keeping line breaks,
numbering and headings. For tables, put one row per line with cells separated by " | ".
Copy numbers, names, dates and amounts exactly; never guess. Write [unclear] where you can't read something.
Output only the text, no comments.`

async function ocr({ type = '', data = '' }) {
  if (!(await aiReady())) {
    const { why } = geminiKey()
    return why ? json({ error: 'bad_key', why }, 503) : json({ error: 'not_configured', why: 'Reading photos and scanned pages needs Claude connected (Evolve, Check setup).' }, 503)
  }
  if (!IMAGES.includes(type)) return json({ error: 'bad_file', why: 'Jarvis reads PDFs, photos and text files.' }, 400)
  if (!data || data.length * 0.75 > MAX_IMAGE) return json({ error: 'too_big', why: 'This photo is too big (over 4 MB).' }, 413)
  const out = await askAI({
    system: OCR, turns: [{ role: 'user', text: 'Copy out this page.', image: { type, data } }],
    model: 'quick', maxTokens: 8192, until: Date.now() + 25000,
  })
  if (out.error) return json({ error: out.error, why: out.why || "Couldn't read this page. Try a clearer photo." }, out.status || 502)
  return json({ text: out.text })
}

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    const body = req.method === 'GET' ? null : await req.json().catch(() => ({}))
    if (body?.action === 'ocr') return await ocr(body)
    const k = await openStore(req, user)
    if (!body) return json({ docs: await k.docs.list() })
    if (body.action === 'start') return json({ id: await k.docs.start(String(body.name || '').trim().slice(0, 120) || 'Document') })
    if (typeof body.id !== 'string' || !body.id) return json({ error: 'not_found', why: "That document isn't in your Library any more." }, 404)
    if (body.action === 'append') {
      await k.docs.append(body.id, Array.isArray(body.pages) ? body.pages : [])
      return json({ ok: true })
    }
    if (body.action === 'finish') return json({ doc: await k.docs.finish(body.id) })
    if (body.action === 'delete') { await k.docs.remove(body.id); return json({ ok: true }) }
    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    if (e instanceof Refused) return json({ error: e.error, why: e.why }, e.status)
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
