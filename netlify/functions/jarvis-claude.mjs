// Connect Claude: the key you paste in Evolve › Check setup. Only your login can use this, and only
// when JARVIS_OWNER_EMAIL is set, so no one else can spend your Claude credit. The key is kept in
// Netlify's own storage and never sent back to the phone.
//   POST { action: 'save', key }  → tries the key with a one-word question, then keeps it
//   POST { action: 'remove' }     → forgets it (Gemini answers again)
import { env, json, owner } from '../lib/common.mjs'
import { claudeKey, checkClaudeKey, saveClaudeKey, removeClaudeKey, testClaude } from '../lib/ai.mjs'
import { STORAGE_DOWN } from '../lib/memory.mjs'

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 405)
  if (!env('JARVIS_OWNER_EMAIL')) return json({ error: 'no_owner', why: 'Add JARVIS_OWNER_EMAIL in Netlify first (your login email), so only you can use your Claude credit.' }, 403)
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)
  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'remove') {
      if ((await claudeKey()).where === 'netlify') return json({ error: 'in_netlify', why: 'This key is in Netlify (ANTHROPIC_API_KEY). Remove it there.' }, 409)
      await removeClaudeKey()
      return json({ ok: true })
    }
    if (body.action !== 'save') return json({ error: 'bad_request' }, 400)
    const { key, why } = checkClaudeKey(body.key)
    if (!key) return json({ error: 'bad_key', why }, 400)
    const test = await testClaude(key)
    if (test.error === 'bad_key') return json({ error: 'bad_key', why: "Claude says this key isn't valid. Copy it again from platform.claude.com (API keys)." }, 400)
    await saveClaudeKey(key)
    if (test.error === 'credit') return json({ ok: true, warn: 'Key saved. Add credit at platform.claude.com (Billing) and Claude starts answering.' })
    if (test.error) return json({ ok: true, warn: "Key saved. Claude didn't answer the test just now; tap Check again in a minute." })
    return json({ ok: true })
  } catch {
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}
