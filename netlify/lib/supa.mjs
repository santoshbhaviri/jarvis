// Your own Supabase database, for the Knowledge store (supabase-knowledge.sql). Jarvis's server
// calls it with your login, so Supabase's row rules apply: each login reads only its own rows.
// No Supabase secret key is needed or kept anywhere.
import { env } from './common.mjs'

export const SETUP_VERSION = 1   // supabase-knowledge.sql's jarvis_store_version()

export class DbError extends Error {
  constructor(status, data) {
    super(data?.message || `Supabase answered ${status}`)
    this.status = status
    this.code = data?.code || ''
  }
}

// db(req).get('jarvis_notes?select=*'), .post(table, rows, prefer), .upsert, .patch, .del, .rpc(fn, args), .count(table)
export function db(req) {
  const url = env('VITE_SUPABASE_URL'), key = env('VITE_SUPABASE_ANON_KEY')
  const auth = req.headers.get('authorization') || ''
  const call = async (path, { method = 'GET', body, prefer, wait = 10000, counting = false } = {}) => {
    const res = await fetch(`${url}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: key, Authorization: auth, 'Content-Type': 'application/json',
        ...(prefer && { Prefer: prefer }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(wait),
    })
    const text = await res.text()
    let data = null
    try { data = text ? JSON.parse(text) : null } catch { /* not JSON */ }
    if (!res.ok) throw new DbError(res.status, data)
    // "0-0/42": 42 rows in all
    return counting ? Number(res.headers.get('content-range')?.split('/')[1]) || 0 : data
  }
  return {
    get: (path, opts) => call(path, opts),
    post: (path, body, prefer = 'return=representation') => call(path, { method: 'POST', body, prefer }),
    upsert: (path, rows) => call(path, { method: 'POST', body: rows, prefer: 'resolution=merge-duplicates,return=minimal', wait: 20000 }),
    patch: (path, body) => call(path, { method: 'PATCH', body, prefer: 'return=representation' }),
    del: (path) => call(path, { method: 'DELETE', prefer: 'return=minimal' }),
    rpc: (fn, args = {}) => call(`rpc/${fn}`, { method: 'POST', body: args }),
    count: (table) => call(`${table}?select=id&limit=1`, { prefer: 'count=exact', counting: true }),
  }
}

// Has the setup code run in Supabase? true, false (not yet), or null (Supabase didn't answer)
export async function setUp(req) {
  try { return (await db(req).rpc('jarvis_store_version')) >= SETUP_VERSION }
  catch (e) { return e instanceof DbError && (e.status === 404 || e.code === 'PGRST202' || e.code === '42883') ? false : null }
}

// Where to paste the setup code: the SQL Editor of this Supabase project
export function sqlEditor() {
  const ref = env('VITE_SUPABASE_URL').match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1]
  return ref ? `https://supabase.com/dashboard/project/${ref}/sql/new` : 'https://supabase.com/dashboard'
}
