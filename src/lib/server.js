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
    return res.ok ? data : { error: data.error || 'failed', why: data.why }
  } catch {
    return { error: 'offline' }
  }
}

// Is a feature switched on (its key added)?
export const isReady = async (name) => (await call(name, { query: '?ping' })).ready === true
// Assist: an AI connected (ready), and whether to offer the Claude paste box (connect)
export const assistStatus = () => call('jarvis-ask', { query: '?ping' })

export const askJarvis    = (turns, context, docs) => call('jarvis-ask', { method: 'POST', body: { turns, context, docs } })
export const listUpdates  = () => call('jarvis-github')
export const checkSetup   = () => call('jarvis-setup')
// Claude: the key is checked and kept on Jarvis's server, never on the phone
export const connectClaude    = (key) => call('jarvis-claude', { method: 'POST', body: { action: 'save', key } })
export const disconnectClaude = () => call('jarvis-claude', { method: 'POST', body: { action: 'remove' } })
export const sendRequest  = (text) => call('jarvis-github', { method: 'POST', body: { action: 'request', text } })
export const approveUpdate = (number) => call('jarvis-github', { method: 'POST', body: { action: 'approve', number } })
export const changeUpdate = (number, text) => call('jarvis-github', { method: 'POST', body: { action: 'change', number, text } })
export const dropUpdate   = (number) => call('jarvis-github', { method: 'POST', body: { action: 'drop', number } })

// Search tab: headlines and Wikipedia (free, no key), then a short answer from Claude (or Gemini).
// turns carries the conversation for a follow-up question.
export const searchWeb    = (q) => call('jarvis-search', { query: `?q=${encodeURIComponent(q)}` })
export const searchAnswer = (q, found, turns) => call('jarvis-search', { method: 'POST', body: { q, news: found.news, wiki: found.wiki, turns } })

// Knowledge: notes, preferences, saved answers and what Jarvis learned, used by Search and Assist
export const listMemory   = () => call('jarvis-memory')
export const addMemory    = (text, from = 'you', title) => call('jarvis-memory', { method: 'POST', body: { text, from, title } })
export const editMemory   = (id, text) => call('jarvis-memory', { method: 'POST', body: { action: 'edit', id, text } })
export const deleteMemory = (id) => call('jarvis-memory', { method: 'POST', body: { action: 'delete', id } })
// Takes one of Claude's replies off Evolve (it stays on GitHub)
export const hideReply    = (id) => call('jarvis-memory', { method: 'POST', body: { action: 'hide', id } })

// Library: documents kept in full, searched for every question in Search and Assist
export const listLibrary = () => call('jarvis-library')
export const startDoc     = (name) => call('jarvis-library', { method: 'POST', body: { action: 'start', name } })
export const appendDoc    = (id, pages) => call('jarvis-library', { method: 'POST', body: { action: 'append', id, pages } })
export const finishDoc    = (id) => call('jarvis-library', { method: 'POST', body: { action: 'finish', id } })
export const deleteDoc    = (id) => call('jarvis-library', { method: 'POST', body: { action: 'delete', id } })
export const readPage     = (type, data) => call('jarvis-library', { method: 'POST', body: { action: 'ocr', type, data } })

// Where your Knowledge is kept (Netlify, or your own Supabase once the setup code has run there)
export const knowledgeStatus = (quick) => call('jarvis-knowledge', { query: quick ? '?quick' : '' })
export const moveKnowledge   = () => call('jarvis-knowledge', { method: 'POST', body: { action: 'move' } })
export const forgetChats     = () => call('jarvis-knowledge', { method: 'POST', body: { action: 'forget_chats' } })

// Your day (Today): your calendar and the mail that needs you. The calendar link and the Gmail app
// password are checked and kept on Jarvis's server, never on the phone.
export const getDay       = (fresh) => call('jarvis-day', { query: fresh ? '?fresh' : '' })
export const linkCalendar = (link) => call('jarvis-day', { method: 'POST', body: { action: 'calendar', link } })
export const linkMail     = (address, password) => call('jarvis-day', { method: 'POST', body: { action: 'mail', address, password } })
export const unlinkDay    = (what) => call('jarvis-day', { method: 'POST', body: { action: 'remove', what } })
