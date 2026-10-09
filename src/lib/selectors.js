// src/lib/selectors.js
// Shared filters for the Today, Priorities and Insights tabs
import { quadrantOf } from './constants'

// Scut-work and mission tasks that still need doing
export const openTasks = (tasks) =>
  tasks.filter(t => t.status !== 'routine' && !t.completed_at)

// Highest priority first, then nearest due date
export const byPriority = (a, b) =>
  quadrantOf(a) - quadrantOf(b) ||
  (a.due_date || '9999').localeCompare(b.due_date || '9999')

export const followUpsDue = (tasks, today) =>
  tasks.filter(t => !t.completed_at && t.waiting_on && t.follow_up && t.follow_up <= today)
