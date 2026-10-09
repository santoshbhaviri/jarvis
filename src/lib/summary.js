// src/lib/summary.js
// One-line morning summary, used by in-app reminders (the edge function has its own copy)
import { openTasks, followUpsDue } from './selectors'

export function daySummary(tasks, today) {
  const open     = openTasks(tasks)
  const overdue  = open.filter(t => t.due_date && t.due_date < today).length
  const dueToday = open.filter(t => t.due_date === today).length
  const chase    = followUpsDue(tasks, today).length
  const parts = []
  if (overdue)  parts.push(`${overdue} overdue`)
  if (dueToday) parts.push(`${dueToday} due today`)
  if (chase)    parts.push(`${chase} follow-up${chase > 1 ? 's' : ''} to make`)
  return { count: overdue + dueToday + chase, text: parts.length ? parts.join(' · ') : 'Nothing due today. Pick your Top 3.' }
}
