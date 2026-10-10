// What Jarvis learns from how you use it: tasks you add again and again become
// one-tap suggestions under the Add a task box.

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
