// Knowledge: where your notes, documents and chats are kept, and moving them into your own
// Supabase (see netlify/lib/store.mjs). Only your login can use it.
//   GET            → { where: 'netlify' | 'supabase', setUp: true | false | null, sql, counts }
//   GET ?quick     → { where, move }: move is true when the setup code has run in Supabase and
//                    your Memory and Library haven't moved yet (the app then moves them)
//   POST { action: 'move' }          → moves the next part (about 20 seconds' worth)
//                                      → { done, docs, of }
//   POST { action: 'forget_chats' }  → deletes the Assist chats kept in Supabase
import { json, owner } from '../lib/common.mjs'
import { STORAGE_DOWN } from '../lib/memory.mjs'
import { setUp, sqlEditor } from '../lib/supa.mjs'
import { openStore, moved, moveStep, Refused } from '../lib/store.mjs'

const MOVE_FAILED = "Couldn't move your Knowledge just now. Jarvis tries again next time you open it."

export default async (req) => {
  const began = Date.now()
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  try {
    if (req.method === 'GET') {
      const there = await moved(user)
      const ready = there || await setUp(req)
      if (new URL(req.url).searchParams.has('quick')) return json({ where: there ? 'supabase' : 'netlify', move: !there && ready === true })
      const k = await openStore(req, user)
      const [notes, docs, chats] = await Promise.all([
        k.notes.list().then(n => n.length),
        k.docs.list().then(d => d.filter(x => x.ready).length),
        k.chats.count(),
      ])
      return json({ where: k.where, setUp: ready, sql: sqlEditor(), counts: { notes, docs, chats } })
    }

    const body = await req.json().catch(() => ({}))
    if (body.action === 'move') {
      try { return json(await moveStep(req, user, began + 20000)) }
      catch (e) { return e instanceof Refused ? json({ error: e.error, why: e.why }, e.status) : json({ error: 'move_failed', why: MOVE_FAILED }, 503) }
    }
    if (body.action === 'forget_chats') {
      await (await openStore(req, user)).chats.clear()
      return json({ ok: true })
    }
    return json({ error: 'bad_request' }, 400)
  } catch {
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
