// src/lib/summary.js
// One-line summary for reminders (the edge function has its own copy)
export function daySummary(tasks, today) {
  const todo    = tasks.filter(t => t.status !== 'routine' && !t.completed_at && t.due_date <= today)
  const carried = todo.filter(t => t.is_unfinished).length
  const starred = todo.filter(t => t.important).length
  if (!todo.length) return { count: 0, text: 'Nothing planned yet. Add what you want to get done today.' }
  const parts = [`${todo.length} task${todo.length > 1 ? 's' : ''} for today`]
  if (starred) parts.push(`${starred} important`)
  if (carried) parts.push(`${carried} carried over`)
  return { count: todo.length, text: parts.join(' · ') }
}
