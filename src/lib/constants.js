export const TABS = [
  { key: 'today',      label: 'Today',       icon: '☀️' },
  { key: 'priorities', label: 'Priorities',  icon: '🧭' },
  { key: 'routine',    label: 'Routine',     icon: '🔁' },
  { key: 'scut-work',  label: 'Scut-Work',   icon: '⚙️' },
  { key: 'mission',    label: 'Mission',      icon: '🎯' },
  { key: 'insights',   label: 'Insights',    icon: '📈' },
  { key: 'taskmaster', label: 'Task Master',  icon: '👑' },
]

export const CATEGORIES = {
  work:     { label: 'Work',     icon: '💼', color: '#6366f1', bg: '#eef2ff' },
  personal: { label: 'Personal', icon: '🏠', color: '#ec4899', bg: '#fdf2f8' },
}

export const STATUSES = {
  routine:    { label: 'Routine',   color: '#06b6d4', bg: '#ecfeff' },
  'scut-work':{ label: 'Scut-Work', color: '#f59e0b', bg: '#fffbeb' },
  mission:    { label: 'Mission',   color: '#8b5cf6', bg: '#f5f3ff' },
}

// Eisenhower quadrants, keyed 1-4 (see quadrantOf)
export const QUADRANTS = {
  1: { label: 'Do now',      sub: 'Important and urgent',                       color: '#ef4444' },
  2: { label: 'Schedule',    sub: 'Important, not urgent. Productivity grows here.', color: '#6366f1' },
  3: { label: 'Delegate',    sub: 'Urgent, not important. Hand off or finish fast.', color: '#f59e0b' },
  4: { label: 'Drop / park', sub: 'Neither urgent nor important',               color: '#64748b' },
}

export const quadrantOf = (t) =>
  t.important ? (t.urgent ? 1 : 2) : (t.urgent ? 3 : 4)

export const DAYS = ['S','M','T','W','T','F','S']

export const EMPTY_FORM = {
  title: '', category: 'work', status: 'routine', due_date: '', notes: '',
  important: false, urgent: false, waiting_on: '', follow_up: '',
}
