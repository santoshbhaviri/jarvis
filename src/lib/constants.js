export const TABS = [
  { key: 'routine',    label: 'Routine',     icon: '🔁' },
  { key: 'scut-work',  label: 'Scut-Work',   icon: '⚙️' },
  { key: 'mission',    label: 'Mission',      icon: '🎯' },
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

export const DAYS = ['S','M','T','W','T','F','S']

export const EMPTY_FORM = {
  title: '', category: 'work', status: 'routine', due_date: '', notes: ''
}
