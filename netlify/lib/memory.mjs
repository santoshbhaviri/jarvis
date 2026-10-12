// Your Memory on Netlify: notes, preferences, saved answers and documents that Search and Assist
// read before they answer. Kept in Netlify Blobs (storage that comes with the Netlify site, no
// setup), one record per login, until it moves to your Supabase (see store.mjs); after that this
// copy stays as a backup, and only the list of Claude's replies you deleted in Evolve is kept here:
//   { items: [{ id, text, at, from, title? }], hidden: [ids of Claude's replies you deleted in Evolve] }
import { getStore } from '@netlify/blobs'
import { terms } from './library.mjs'

export const LIMIT = 300         // notes kept
export const MAX_TEXT = 8000     // characters in one note
export const FROM = ['you', 'assist', 'search', 'claude', 'learned', 'document']
export const STORAGE_DOWN = "Jarvis couldn't reach its memory just now. Try again in a minute."

const store = () => getStore({ name: 'jarvis-memory', consistency: 'strong' })

export async function readMemory(userId) {
  const doc = await store().get(userId, { type: 'json' })
  return {
    items: Array.isArray(doc?.items) ? doc.items : [],
    hidden: Array.isArray(doc?.hidden) ? doc.hidden : [],
  }
}

export const writeMemory = (userId, doc) => store().setJSON(userId, doc)

// What the AI reads: the newest notes, up to about 10,000 words, in the instructions (the same
// for every question, so Claude can reuse them cheaply), and older notes that share words with
// the question (q), up to about 5,000 more, beside the question → { text, extra }
export function memoryText(items, q = '', budget = 60000) {
  const line = (m) => `- (${m.at.slice(0, 10)}${m.title ? `, ${m.title}` : ''}) ${m.text.trim().replace(/\n+/g, '\n  ')}`
  const newest = [], older = []
  let used = 0
  for (const m of [...items].sort((a, b) => b.at.localeCompare(a.at))) {
    const l = line(m)
    if (!older.length && used + l.length <= budget * 2 / 3) { newest.push(l); used += l.length }
    else older.push(m)
  }
  const words = terms(q)
  const matching = words.length ? older
    .map(m => ({ m, n: words.filter(w => `${m.title || ''} ${m.text}`.toLowerCase().includes(w)).length }))
    .filter(x => x.n >= Math.min(2, words.length))
    .sort((a, b) => b.n - a.n) : []
  const extra = []
  for (const { m } of matching) {
    const l = line(m)
    if (used + l.length > budget) continue
    extra.push(l); used += l.length
  }
  return {
    text: newest.length
      ? 'Their Knowledge: notes, preferences, saved answers and things they asked you to keep, or that you learned from them (newest first). ' +
        'Use them whenever they are relevant and follow their preferences. ' +
        'If a note disagrees with the law or with facts you are sure of, say so politely.\n' + newest.join('\n')
      : '',
    extra: extra.length ? 'Older notes from their Knowledge that match this question:\n' + extra.join('\n') : '',
  }
}
