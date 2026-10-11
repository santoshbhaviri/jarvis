// Memory: what Jarvis keeps for you (see netlify/lib/memory.mjs). Only your login can use it.
//   GET                                        → { items } newest first
//   POST { text, from }                        → saves a note → { item }
//   POST { action: 'delete', id }              → removes a note
//   POST { action: 'hide', id }                → takes one of Claude's replies off Evolve
// Documents are kept in full in the Library instead (jarvis-library).
import { randomUUID } from 'node:crypto'
import { json, owner } from '../lib/common.mjs'
import { readMemory, writeMemory, LIMIT, MAX_TEXT, FROM, STORAGE_DOWN } from '../lib/memory.mjs'

const FULL = `Memory is full (${LIMIT} notes). Delete a few old ones first.`

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

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    if (req.method === 'GET') {
      const { items } = await readMemory(user.id)
      return json({ items: [...items].sort((a, b) => b.at.localeCompare(a.at)) })
    }

    const body = await req.json().catch(() => ({}))

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
