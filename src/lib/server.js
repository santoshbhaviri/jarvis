// Calls to Jarvis's own server functions (netlify/functions), signed with your login.
import { supabase } from './supabase'

async function call(name, { method = 'GET', body, query = '' } = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  try {
    const res = await fetch(`/.netlify/functions/${name}${query}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
      body: body && JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({ error: 'failed' }))
    return res.ok ? data : { error: data.error || 'failed' }
  } catch {
    return { error: 'offline' }
  }
}

// Is a feature switched on (its key added in Netlify)?
export const isReady = async (name) => (await call(name, { query: '?ping' })).ready === true

export const askJarvis    = (turns, context) => call('jarvis-ask', { method: 'POST', body: { turns, context } })
export const listUpdates  = () => call('jarvis-github')
export const sendRequest  = (text) => call('jarvis-github', { method: 'POST', body: { action: 'request', text } })
export const approveUpdate = (number) => call('jarvis-github', { method: 'POST', body: { action: 'approve', number } })
export const changeUpdate = (number, text) => call('jarvis-github', { method: 'POST', body: { action: 'change', number, text } })
export const dropUpdate   = (number) => call('jarvis-github', { method: 'POST', body: { action: 'drop', number } })

// Search tab: headlines and Wikipedia (free, no key), then a short answer if Gemini is set up
export const searchWeb    = (q) => call('jarvis-search', { query: `?q=${encodeURIComponent(q)}` })
export const searchAnswer = (q, found) => call('jarvis-search', { method: 'POST', body: { q, news: found.news, wiki: found.wiki } })
