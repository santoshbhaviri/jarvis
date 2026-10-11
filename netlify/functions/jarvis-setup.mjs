// Setup check: says in plain words whether each key works, and how to fix it.
// It never shows a key. GET → { checks: [{ name, ok, fix, note? }] }; the Claude row also says
// whether to show the box for pasting a key (paste) and where the key is kept (where).
import { env, json, signedIn, looksLike, geminiKey, askGemini, geminiProblem, GEMINI_BUSY, GEMINI_LIMIT, GITHUB_BAD, GITHUB_NO_ACCESS } from '../lib/common.mjs'
import { readMemory, STORAGE_DOWN } from '../lib/memory.mjs'
import { claudeKey, testClaude, spent, RUPEES } from '../lib/ai.mjs'

const REPO = env('JARVIS_REPO') || 'santoshbhaviri/jarvis'
const REACH = (who) => `Couldn't reach ${who} just now. Try again in a minute.`

function login(user) {
  const allowed = env('JARVIS_OWNER_EMAIL').toLowerCase()
  if (!allowed) return { name: 'Your email', ok: false, fix: `Add JARVIS_OWNER_EMAIL in Netlify with ${user.email}, the email you sign in with.` }
  if (allowed !== (user.email || '').toLowerCase()) {
    const kind = looksLike(allowed)
    return { name: 'Your email', ok: false, fix: kind && kind !== 'email address'
      ? `JARVIS_OWNER_EMAIL holds your ${kind}. Put ${user.email} there instead.`
      : `JARVIS_OWNER_EMAIL doesn't match ${user.email}, the email you sign in with. Put that exact email there.` }
  }
  return { name: 'Your email', ok: true }
}

// Claude: works, and what it has cost this month
async function claude() {
  const name = 'Claude (Search, Assist, reading pages)'
  const { key, where } = await claudeKey()
  if (!key) return { id: 'claude', name, ok: false, paste: true, fix: 'Paste your Claude key here and Claude answers in Search and Assist.' }
  const [test, month] = await Promise.all([testClaude(key), spent()])
  const note = month && `This month so far: about ₹${Math.round(month.usd * RUPEES)} ($${month.usd.toFixed(2)}), ${month.answers} answer${month.answers === 1 ? '' : 's'}.`
  if (!test.error) return { id: 'claude', name, ok: true, note, where }
  return { id: 'claude', name, ok: false, fix: test.why, note, where, paste: test.error === 'bad_key' && where === 'jarvis' }
}

// With Claude connected, Gemini is only the stand-in for when Claude can't answer
async function gemini(backup) {
  const name = backup ? 'Gemini key (stand-in when Claude is busy)' : 'Gemini key (Search and Assist)'
  const { key, why } = geminiKey()
  if (why) return { name, ok: false, fix: why + ' Paste the Gemini key there instead.' }
  if (!key) return { name, ok: false, fix: 'Add GEMINI_API_KEY in Netlify: a free key from aistudio.google.com/apikey.' }
  // Ask a one-word question the way Assist does, so "works" here means Assist can answer
  const res = await askGemini(key, { contents: [{ role: 'user', parts: [{ text: 'Reply with the word OK.' }] }] }, 15000)
  if (res?.ok) return { name, ok: true }
  if (!res || res.status >= 500) return { name, ok: false, fix: 'The key is fine. ' + GEMINI_BUSY }
  if (res.status === 429) return { name, ok: false, fix: 'The key is fine. ' + GEMINI_LIMIT }
  if (res.status === 404) return { name, ok: false, fix: "Google doesn't offer its Flash models to this key just now. Try again later." }
  return { name, ok: false, fix: geminiProblem(await res.text()) || `Google answered with error ${res.status}. Try again in a minute.` }
}

async function github() {
  const name = 'GitHub key (Evolve)'
  const token = env('GITHUB_TOKEN')
  if (!token) return { name, ok: false, fix: 'Add GITHUB_TOKEN in Netlify (Step 1 of your guide).' }
  const kind = looksLike(token)
  if (kind && kind !== 'GitHub key') return { name, ok: false, fix: `GITHUB_TOKEN in Netlify holds your ${kind}. Paste the GitHub key there instead.` }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'jarvis-app' },
      signal: AbortSignal.timeout(6000),
    })
    if (res.status === 401) return { name, ok: false, fix: GITHUB_BAD }
    if (!res.ok) return { name, ok: false, fix: GITHUB_NO_ACCESS }
    // Evolve's Send makes an issue. An empty one is refused as incomplete (422) when the key may
    // write issues and as forbidden (403) when it may not, so nothing is ever created here.
    const probe = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
      method: 'POST', body: '{}',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'jarvis-app' },
      signal: AbortSignal.timeout(6000),
    })
    if (probe.status === 410) return { name, ok: false, fix: 'Issues are switched off for the jarvis repository. On GitHub open jarvis, Settings, and tick Issues.' }
    if (probe.status === 403 || probe.status === 404) return { name, ok: false, fix: GITHUB_NO_ACCESS }
    return { name, ok: true }
  } catch { return { name, ok: false, fix: REACH('GitHub') } }
}

// Memory needs no key: Netlify's own storage
async function memory(user) {
  try { await readMemory(user.id); return { name: 'Memory', ok: true } }
  catch { return { name: 'Memory', ok: false, fix: STORAGE_DOWN } }
}

export default async (req) => {
  const user = await signedIn(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)
  const you = login(user)
  // Someone else signed in: only say the email doesn't match, test nothing
  if (!you.ok && env('JARVIS_OWNER_EMAIL')) return json({ checks: [you] })
  const withClaude = !!(await claudeKey()).key
  const rows = await Promise.all([claude(), withClaude && !env('GEMINI_API_KEY') ? null : gemini(withClaude), github(), memory(user)])
  return json({ checks: [you, ...rows.filter(Boolean)] })
}
