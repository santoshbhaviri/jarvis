// Keeps your free Supabase project awake: once a day, Netlify runs this and asks Supabase for
// one tiny thing, so it never pauses for being unused. No login needed and nothing is changed;
// the answer is usually an empty list (each account only sees its own tasks), which is fine.
import { env } from '../lib/common.mjs'

export default async () => {
  const url = env('VITE_SUPABASE_URL'), key = env('VITE_SUPABASE_ANON_KEY')
  if (!url || !key) {
    console.log('Keep awake: Supabase address or key not set in Netlify, skipped')
    return
  }
  try {
    const res = await fetch(`${url}/rest/v1/tasks?select=id&limit=1`, { headers: { apikey: key } })
    console.log(`Keep awake: Supabase answered ${res.status}`)
  } catch (e) {
    console.log(`Keep awake: Supabase could not be reached (${e.message})`)
  }
}

export const config = { schedule: '@daily' }
