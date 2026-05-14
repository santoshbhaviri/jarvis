// src/lib/constants.js
// Edit labels, colors, and options here — changes propagate everywhere

export const PRIORITIES = {
  high:   { label: 'High',   color: '#ef4444', bg: '#fef2f2', dot: '#ef4444' },
  medium: { label: 'Medium', color: '#f59e0b', bg: '#fffbeb', dot: '#f59e0b' },
  low:    { label: 'Low',    color: '#22c55e', bg: '#f0fdf4', dot: '#22c55e' },
}

export const CATEGORIES = {
  work:     { label: 'Work',     icon: '💼', color: '#4f46e5' },
  personal: { label: 'Personal', icon: '🏠', color: '#ec4899' },
}

export const STATUSES = {
  todo:       { label: 'To Do',       icon: '○', color: '#94a3b8' },
  inprogress: { label: 'In Progress', icon: '◑', color: '#3b82f6' },
  followup:   { label: 'Follow Up',   icon: '↻', color: '#f59e0b' },
  done:       { label: 'Done',        icon: '✓', color: '#22c55e' },
}

export const EMPTY_TASK = {
  title: '', category: 'work', priority: 'medium',
  status: 'todo', due_date: '', followup_date: '', notes: '',
}
