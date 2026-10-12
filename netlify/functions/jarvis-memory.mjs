// Memory: the notes in your Knowledge (see netlify/lib/store.mjs). Only your login can use it.
//   GET                                        → { items } newest first
//   POST { text, from }                        → saves a note → { item }
//   POST { action: 'edit', id, text }          → corrects a note → { item }
//   POST { action: 'delete', id }              → removes a note
//   POST { action: 'hide', id }                → takes one of Claude's replies off Evolve
// Documents are kept in full in the Library instead (jarvis-library).
import { json, owner } from '../lib/common.mjs'
import { readMemory, writeMemory, STORAGE_DOWN } from '../lib/memory.mjs'
import { openStore, Refused } from '../lib/store.mjs'

const okId = (id) => (typeof id === 'string' && id.length <= 100) || Number.isInteger(id)

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    const k = await openStore(req, user)
    if (req.method === 'GET') return json({ items: await k.notes.list() })

    const body = await req.json().catch(() => ({}))

    // Claude's replies you deleted in Evolve are listed on Netlify, wherever your notes are
    if (body.action === 'hide') {
      if (!okId(body.id)) return json({ error: 'bad_request' }, 400)
      const doc = await readMemory(user.id)
      doc.hidden = [...new Set([...doc.hidden, body.id])].slice(-500)
      await writeMemory(user.id, doc)
      return json({ ok: true })
    }
    if (body.action === 'delete') {
      if (!okId(body.id)) return json({ error: 'bad_request' }, 400)
      await k.notes.remove(body.id)
      return json({ ok: true })
    }

    const text = String(body.text || '').trim()
    if (!text) return json({ error: 'empty' }, 400)
    if (body.action === 'edit') {
      if (!okId(body.id)) return json({ error: 'bad_request' }, 400)
      const item = await k.notes.edit(body.id, text)
      return item ? json({ item }) : json({ error: 'not_found', why: "That note isn't in your Knowledge any more." }, 404)
    }
    return json({ item: await k.notes.add({ text, from: body.from, title: body.title }) })
  } catch (e) {
    if (e instanceof Refused) return json({ error: e.error, why: e.why }, e.status)
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
