// The AI behind Search, Assist and reading scanned pages.
// Claude answers when it is connected: the key you paste in Evolve › Check setup (kept in Netlify's
// own storage, never sent back to the phone), or ANTHROPIC_API_KEY in Netlify. Claude is paid per
// use from the credit you add at platform.claude.com, so Jarvis keeps a running total for the month.
// Without Claude, the free Gemini key answers. When Claude is busy, out of credit or its key stops
// working, Gemini answers that question instead and the answer says why.
import Anthropic from '@anthropic-ai/sdk'
import { getStore } from '@netlify/blobs'
import { env, looksLike, geminiKey, askGemini, geminiProblem, GEMINI_BUSY, GEMINI_LIMIT } from './common.mjs'

// smart: Search and Assist. quick: reading scanned pages and photos, and the Setup check.
export const MODELS = { smart: 'claude-sonnet-5-5', quick: 'claude-haiku-5-5' }
// US dollars per million tokens: new input, output, read from cache, written to cache
const PRICE = {
  'claude-sonnet-5-5': [2, 10, 0.2, 2.5],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.125],
}
export const RUPEES = 88   // per US dollar, for "about ₹…"
// Claude reads these photo types; anything else goes to Gemini
const CLAUDE_IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export const CLAUDE_BAD_KEY = "Claude didn't accept your key. Open Evolve, tap Check setup and paste a new key from platform.claude.com (API keys)."
export const CLAUDE_CREDIT = 'Your Claude credit has run out. Add more at platform.claude.com (Billing).'
export const CLAUDE_BUSY = 'Claude is busy just now. Try again in a minute.'
const CLAUDE_SLOW = 'Claude took too long on this one. Try again, or ask for a shorter answer.'
const INSTEAD = { bad_key: CLAUDE_BAD_KEY, credit: CLAUDE_CREDIT, busy: 'Claude was busy.' }

const settings = () => getStore({ name: 'jarvis-settings', consistency: 'strong' })

// Your Claude key and where it came from, or {} when Claude isn't connected. A key pasted in
// Jarvis counts only when JARVIS_OWNER_EMAIL is set, so no one else can spend your credit.
// A found key is remembered for a minute. If storage is slow (it retries for up to 25 seconds),
// Jarvis stops waiting after 3 and Gemini answers that question.
let found = null
export async function claudeKey() {
  const fromNetlify = env('ANTHROPIC_API_KEY')
  if (fromNetlify) return { key: fromNetlify, where: 'netlify' }
  if (!env('JARVIS_OWNER_EMAIL')) return {}
  if (found && Date.now() - found.at < 60000) return found.value
  const read = settings().get('claude', { type: 'json' })
    .then(saved => saved?.key ? { key: saved.key, where: 'jarvis' } : {})
    .catch(() => ({}))
  const value = await Promise.race([read, new Promise(resolve => setTimeout(() => resolve({}), 3000))])
  found = value.key ? { at: Date.now(), value } : null
  return value
}
export const saveClaudeKey = (key) => { found = null; return settings().setJSON('claude', { key, at: new Date().toISOString() }) }
export const removeClaudeKey = () => { found = null; return settings().delete('claude') }

// A pasted Claude key, or a plain reason it isn't one
export function checkClaudeKey(raw) {
  const key = String(raw || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/\s+/g, '')
  if (!key) return { why: 'Paste your Claude key first.' }
  const kind = looksLike(key)
  if (kind) return { why: `That looks like your ${kind}, not a Claude key. A Claude key starts with sk-ant-.` }
  if (!/^sk-ant-[\w-]{20,}$/.test(key)) return { why: 'That isn\'t a Claude key. Copy the whole key from platform.claude.com (API keys); it starts with sk-ant-.' }
  return { key }
}

export const aiReady = async () => !!((await claudeKey()).key || geminiKey().key)

// This month's Claude spend (India time), kept beside the key
const month = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 7)
export async function spent() {
  try { return (await settings().get(`usage/${month()}`, { type: 'json' })) || { usd: 0, answers: 0 } }
  catch { return null }
}
async function addSpend(model, u) {
  const p = PRICE[model]
  if (!p) return
  const usd = ((u.input_tokens || 0) * p[0] + (u.output_tokens || 0) * p[1]
    + (u.cache_read_input_tokens || 0) * p[2] + (u.cache_creation_input_tokens || 0) * p[3]) / 1e6
  try {
    const key = `usage/${month()}`
    const was = (await settings().get(key, { type: 'json' })) || { usd: 0, answers: 0 }
    await settings().setJSON(key, { usd: was.usd + usd, answers: was.answers + 1 })
  } catch { /* the total is a guide; the answer matters more */ }
}

// One question to the AI.
//   system  instructions and Memory: the same from one question to the next, so Claude caches it
//   extra   what changes with each question (Library passages, older notes, earlier chats)
//   turns   [{ role: 'user' | 'assistant', text, image?: { type, data } }], ending with theirs
//   schema  JSON schema when the answer should come as fields (null for plain text)
//   model   'smart' or 'quick'; effort 'low' | 'medium' | 'high' (smart only)
//   until   when the answer must be back (Netlify stops a function after 30 seconds)
//   claudeOnly  never send this to Gemini (its free tier may keep what it reads), e.g. your mail
// → { text } or { json }, with cut: true when time ran out partway; or { error, why, status }
export async function askAI({ system, extra = '', turns, schema = null, model = 'smart', effort = 'medium', maxTokens = 8192, until = Date.now() + 24000, claudeOnly = false }) {
  const asked = turns.slice(turns.findIndex(t => t.role === 'user'))
  const ask = { system, extra, turns: asked, schema, model, effort, maxTokens, until }
  const { key } = await claudeKey()
  if (!key) return claudeOnly ? { error: 'not_configured', status: 503 } : gemini(ask)
  const image = asked.find(t => t.image)?.image
  if (image && !CLAUDE_IMAGES.includes(image.type)) {
    return geminiKey().key ? gemini(ask) : { error: 'bad_file', status: 400, why: 'Claude reads photos saved as JPEG or PNG. Take a screenshot of this one and add that instead.' }
  }
  const out = await claude(key, ask)
  if (!out.error || claudeOnly) return out
  // Out of credit, key refused or busy with time to spare: Gemini answers this one if it can
  if (!INSTEAD[out.error] || !geminiKey().key || until - Date.now() < 8000) return out
  const g = await gemini(ask)
  if (g.error) return out
  if (model === 'quick') return g   // a copied-out page stays exactly as written
  const why = `Gemini answered this one. ${INSTEAD[out.error]}`
  return g.json ? { ...g, json: { ...g.json, answer: `${g.json.answer || ''}\n\n(${why})` } } : { ...g, text: `${g.text}\n\n(${why})` }
}

async function claude(key, { system, extra, turns, schema, model, effort, maxTokens, until }) {
  const id = MODELS[model]
  const client = new Anthropic({ apiKey: key, maxRetries: 0 })
  const content = (t) => t.image
    ? [{ type: 'image', source: { type: 'base64', media_type: t.image.type, data: t.image.data } }, { type: 'text', text: t.text }]
    : t.text
  const output = { ...(model === 'smart' && { effort }), ...(schema && { format: { type: 'json_schema', schema } }) }
  const params = {
    model: id,
    max_tokens: maxTokens,
    system: [
      { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
      ...(extra ? [{ type: 'text', text: extra }] : []),
    ],
    messages: turns.map(t => ({ role: t.role === 'assistant' ? 'assistant' : 'user', content: content(t) })),
    // Copying out a page needs no thinking; answers think as much as they need
    ...(model === 'quick' && { thinking: { type: 'disabled' } }),
    ...(Object.keys(output).length && { output_config: output }),
  }

  // The answer streams in, so when time is nearly up Jarvis stops and keeps what has arrived
  const stop = new AbortController()
  const timer = setTimeout(() => stop.abort(), Math.max(1000, until - Date.now()))
  const late = new Promise(resolve => stop.signal.addEventListener('abort', resolve, { once: true }))
  let text = '', usage = {}, reason = '', failed = null
  const read = (async () => {
    for await (const ev of client.messages.stream(params, { signal: stop.signal })) {
      if (ev.type === 'message_start') usage = { ...ev.message.usage }
      else if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') text += ev.delta.text
      else if (ev.type === 'message_delta') { reason = ev.delta.stop_reason || reason; Object.assign(usage, ev.usage || {}) }
    }
  })().catch(e => { failed = e })
  await Promise.race([read, late])
  clearTimeout(timer)
  if (failed && !stop.signal.aborted) return claudeProblem(failed)
  const got = text   // what had arrived when time ran out
  const cut = stop.signal.aborted || reason === 'max_tokens'
  if (stop.signal.aborted) usage.output_tokens = Math.max(usage.output_tokens || 0, Math.ceil(got.length / 3))
  await addSpend(id, usage)
  if (reason === 'refusal') return { error: 'api', status: 422, why: "Claude won't help with that one. Try asking it another way." }
  if (stop.signal.aborted && !got.trim()) return { error: 'busy', status: 503, why: CLAUDE_SLOW }
  if (!schema) return { text: got.trim(), cut }   // can be empty: a blank page
  const json = parseLoose(got)
  return json ? { json, cut } : { error: 'api', status: 502, why: stop.signal.aborted ? CLAUDE_SLOW : "Claude's answer didn't come through. Try again." }
}

// A one-word question with the cheapest model, for the Setup check and a newly pasted key
export async function testClaude(key) {
  try {
    await new Anthropic({ apiKey: key, maxRetries: 0, timeout: 12000 }).messages.create({
      model: MODELS.quick, max_tokens: 16, thinking: { type: 'disabled' },
      messages: [{ role: 'user', content: 'Reply with the word OK.' }],
    })
    return {}
  } catch (e) { return claudeProblem(e) }
}

// Claude's reason for refusing a call, in plain words
export function claudeProblem(e) {
  const status = e instanceof Anthropic.APIError ? e.status : undefined
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { error: 'bad_key', status: 502, why: CLAUDE_BAD_KEY }
  // A 402, or (on older accounts) a 400 saying the credit balance is too low
  if (status === 402 || (e instanceof Anthropic.BadRequestError && /credit balance/i.test(e.message))) return { error: 'credit', status: 402, why: CLAUDE_CREDIT }
  if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || e instanceof Anthropic.APIConnectionError || !status) return { error: 'busy', status: 503, why: CLAUDE_BUSY }
  return { error: 'api', status: 502, why: `Claude answered with error ${status}. Try again in a minute.` }
}

// Fields cut off partway (time ran out): close what is open and keep what came through
export function parseLoose(s) {
  try { return JSON.parse(s) } catch { /* cut short */ }
  let t = s.replace(/\\$/, '')
  for (let tries = 0; tries < 12 && t.trim(); tries++) {
    try { return JSON.parse(close(t)) } catch { /* trim the last unfinished piece */ }
    const before = t
    t = t.replace(/,?\s*"(?:[^"\\]|\\.)*"\s*:\s*$/, '')    // a name with no value yet
      .replace(/[,:]\s*$/, '')
      .replace(/(?:[a-z]+|-?[\d.eE+-]+)$/, '')                // half a true, null or number
    if (t === before) t = t.slice(0, -1)
  }
  return null
}
function close(t) {
  const open = []
  let str = false, esc = false
  for (const ch of t) {
    if (esc) { esc = false; continue }
    if (str) { if (ch === '\\') esc = true; else if (ch === '"') str = false; continue }
    if (ch === '"') str = true
    else if (ch === '{' || ch === '[') open.push(ch === '{' ? '}' : ']')
    else if (ch === '}' || ch === ']') open.pop()
  }
  return t + (str ? '"' : '') + open.reverse().join('')
}

// Gemini: the same question in Google's format
async function gemini({ system, extra, turns, schema, maxTokens, until }) {
  const { key, why } = geminiKey()
  if (why) return { error: 'bad_key', status: 503, why }
  if (!key) return { error: 'not_configured', status: 503 }
  const res = await askGemini(key, {
    systemInstruction: { parts: [{ text: [system, extra].filter(Boolean).join('\n\n') }] },
    contents: turns.map(t => ({
      role: t.role === 'assistant' ? 'model' : 'user',
      parts: [...(t.image ? [{ inlineData: { mimeType: t.image.type, data: t.image.data } }] : []), { text: t.text }],
    })),
    generationConfig: { maxOutputTokens: maxTokens, ...(schema && { responseMimeType: 'application/json', responseSchema: toGemini(schema) }) },
  }, Math.max(2000, until - Date.now()))
  if (!res || res.status >= 500) return { error: 'busy', status: 503, why: GEMINI_BUSY }
  if (res.status === 429) return { error: 'busy', status: 429, why: GEMINI_LIMIT }
  if (!res.ok) {
    const problem = geminiProblem(await res.text())
    return { error: problem ? 'bad_key' : 'api', status: 502, why: problem || `Gemini answered with error ${res.status}. Try again in a minute.` }
  }
  const data = await res.json()
  const raw = (data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? '').trim()
  if (!schema) return { text: raw }
  try { return { json: JSON.parse(raw) } } catch { return { json: { answer: raw || "Sorry, I couldn't answer that one." } } }
}

// A JSON schema as Gemini wants it: upper-case types, "nullable" instead of a null choice
export function toGemini(s) {
  if (s.anyOf) {
    const real = s.anyOf.find(x => x.type !== 'null')
    return { ...toGemini(real), nullable: true, ...(s.description && { description: s.description }) }
  }
  const out = { type: s.type.toUpperCase() }
  if (s.description) out.description = s.description
  if (s.enum) out.enum = s.enum
  if (s.properties) out.properties = Object.fromEntries(Object.entries(s.properties).map(([k, v]) => [k, toGemini(v)]))
  if (s.required) out.required = s.required
  if (s.items) out.items = toGemini(s.items)
  return out
}
