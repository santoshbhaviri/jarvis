// Your Memory: notes, preferences, saved answers and documents that Search and Assist read
// before they answer. Kept in Netlify Blobs (storage that comes with the Netlify site, no setup),
// one record per login:
//   { items: [{ id, text, at, from, title? }], hidden: [ids of Claude's replies you deleted in Evolve] }
import { getStore } from '@netlify/blobs'

export const LIMIT = 300         // notes kept
export const MAX_TEXT = 8000     // characters in one note
export const FROM = ['you', 'assist', 'search', 'claude', 'document']
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

// What the AI reads: newest first, up to about 15,000 words
export function memoryText(items, budget = 60000) {
  const lines = []
  let used = 0
  for (const m of [...items].sort((a, b) => b.at.localeCompare(a.at))) {
    const line = `- (${m.at.slice(0, 10)}${m.title ? `, ${m.title}` : ''}) ${m.text.trim().replace(/\n+/g, '\n  ')}`
    if (used + line.length > budget) break
    lines.push(line)
    used += line.length
  }
  if (!lines.length) return ''
  return 'Their Memory: notes, preferences, saved answers and documents they asked you to keep (newest first). ' +
    'Use them whenever they are relevant and follow their preferences. ' +
    'If a note disagrees with the law or with facts you are sure of, say so politely.\n' + lines.join('\n')
}

// Memory is extra: if it can't be read, Search and Assist still answer
export async function memoryFor(user) {
  try { return memoryText((await readMemory(user.id)).items) } catch { return '' }
}
