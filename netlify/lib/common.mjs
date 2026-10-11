// Shared by the Jarvis server functions (Netlify Functions).
// Keys live in Netlify → Site configuration → Environment variables, never in the app:
//   GEMINI_API_KEY      free key from aistudio.google.com (answers inside Jarvis)
//   GITHUB_TOKEN        lets Jarvis send app requests and approve updates
//   JARVIS_OWNER_EMAIL  your login email; only you can use the functions above
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  already there for the app itself

// Values pasted on a phone can carry spaces, line breaks or quotes; drop them
export const env = (k) => (process.env[k] || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').trim()

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// The signed-in Jarvis user (checked with Supabase), or null
export async function signedIn(req) {
  const auth = req.headers.get('authorization') || ''
  const url = env('VITE_SUPABASE_URL'), key = env('VITE_SUPABASE_ANON_KEY')
  if (!auth.startsWith('Bearer ') || !url || !key) return null
  const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: key } })
  return res.ok ? res.json() : null
}

// The signed-in user, if allowed. When JARVIS_OWNER_EMAIL is set, only that account counts.
export async function owner(req) {
  const user = await signedIn(req)
  const allowed = env('JARVIS_OWNER_EMAIL').toLowerCase()
  if (!user || (allowed && (user.email || '').toLowerCase() !== allowed)) return null
  return user
}

// What a pasted value looks like, so a key in the wrong box can be named without showing it
export function looksLike(v) {
  if (/^(github_pat_|ghp_|gho_)/.test(v)) return 'GitHub key'
  if (/^sb_(publishable|secret)_/.test(v) || /^eyJ/.test(v)) return 'Supabase key'
  if (/^AIza/.test(v)) return 'Gemini key'
  if (/^\S+@\S+\.\S+$/.test(v)) return 'email address'
  return ''
}

// The Gemini key, or a plain reason it can't be used
export function geminiKey() {
  const key = env('GEMINI_API_KEY')
  const kind = key && looksLike(key)
  if (kind && kind !== 'Gemini key') return { why: `GEMINI_API_KEY in Netlify holds your ${kind}, not the Gemini key.` }
  return { key }
}

// Search, Assist and the Setup check all ask the same model
export const geminiModel = () => env('GEMINI_MODEL') || 'gemini-flash-latest'

// Google's reason for refusing a Gemini call, in plain words ('' when it isn't about the key)
export function geminiProblem(detail) {
  const d = String(detail || '')
  const NEW = 'Create a new one at aistudio.google.com/apikey and paste it into GEMINI_API_KEY in Netlify.'
  if (/API_KEY_INVALID|API key not valid/i.test(d)) return `Google says the Gemini key is not valid. ${NEW}`
  if (/expired/i.test(d)) return `The Gemini key has expired. ${NEW}`
  if (/leaked/i.test(d)) return `Google blocked the Gemini key because it was exposed. ${NEW}`
  if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(d)) return `The Gemini service is off for this key's Google project. ${NEW}`
  if (/location is not supported/i.test(d)) return "Google doesn't offer Gemini to this server's region."
  if (/PERMISSION_DENIED|UNAUTHENTICATED|API key/i.test(d)) return `Google refused the Gemini key. ${NEW}`
  return ''
}

// Why GitHub refused the key, in plain words
export const GITHUB_BAD = 'GitHub says the key in GITHUB_TOKEN is wrong or has expired. Make a new one (Step 1 of your guide).'
export const GITHUB_NO_ACCESS = "The GitHub key can't change the jarvis repository. Make a new one with access to jarvis only, and Contents, Issues and Pull requests set to Read and write."
