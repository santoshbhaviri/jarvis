// Shared by the Jarvis server functions (Netlify Functions).
// Keys live in Netlify → Site configuration → Environment variables, never in the app:
//   GEMINI_API_KEY      free key from aistudio.google.com (answers inside Jarvis)
//   GITHUB_TOKEN        lets Jarvis send app requests and approve updates
//   JARVIS_OWNER_EMAIL  your login email; only you can use the functions above
//   VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY  already there for the app itself

export const env = (k) => process.env[k] || ''

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

// The signed-in Jarvis user (checked with Supabase), or null.
// When JARVIS_OWNER_EMAIL is set, only that account counts.
export async function owner(req) {
  const auth = req.headers.get('authorization') || ''
  const url = env('VITE_SUPABASE_URL'), key = env('VITE_SUPABASE_ANON_KEY')
  if (!auth.startsWith('Bearer ') || !url || !key) return null
  const res = await fetch(`${url}/auth/v1/user`, { headers: { Authorization: auth, apikey: key } })
  if (!res.ok) return null
  const user = await res.json()
  const allowed = env('JARVIS_OWNER_EMAIL').toLowerCase().trim()
  if (allowed && (user.email || '').toLowerCase() !== allowed) return null
  return user
}
