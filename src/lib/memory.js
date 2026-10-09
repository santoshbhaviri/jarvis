// What Jarvis learns from how you use it. Kept on this phone.
//  - When you correct Jarvis (tap Task / Ask / Improve app yourself), it remembers how
//    that kind of sentence starts and gets it right next time.
//  - Tasks you add again and again become one-tap suggestions.
const KEY = 'jarvis-memory'

const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { kinds: {} } } catch { return { kinds: {} } } }
const save = (m) => { try { localStorage.setItem(KEY, JSON.stringify(m)) } catch { /* private mode */ } }

// "Jarvis, please check the weather in Delhi" → "check the"
const opening = (text) => text.toLowerCase()
  .replace(/^(?:(?:hey |ok )?jarvis[,.]?\s*)?(?:please\s+)?/, '')
  .replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).slice(0, 2).join(' ')

export function rememberKind(text, kind) {
  const key = opening(text)
  if (!key) return
  const m = load()
  m.kinds[key] = kind
  save(m)
}

export function recallKind(text) {
  return load().kinds[opening(text)] || null
}

// Tasks you've added on at least two different days and don't have open right now
export function usualTasks(tasks, limit = 4) {
  const seen = {}
  for (const t of tasks) {
    if (t.status === 'routine') continue
    const k = t.title.trim().toLowerCase()
    const day = (t.created_at || '').slice(0, 10)
    seen[k] ||= { title: t.title.trim(), days: new Set(), open: false }
    seen[k].days.add(day)
    if (!t.completed_at) seen[k].open = true
  }
  return Object.values(seen)
    .filter(s => s.days.size >= 2 && !s.open)
    .sort((a, b) => b.days.size - a.days.size)
    .slice(0, limit)
    .map(s => s.title)
}
