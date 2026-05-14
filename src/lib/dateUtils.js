// src/lib/dateUtils.js

import { differenceInCalendarDays, format, parseISO, isValid } from 'date-fns'

export function today() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function daysLeft(dateStr) {
  if (!dateStr) return null
  const d = parseISO(dateStr)
  if (!isValid(d)) return null
  return differenceInCalendarDays(d, new Date())
}

export function formatDisplay(dateStr) {
  if (!dateStr) return '—'
  const d = parseISO(dateStr)
  if (!isValid(d)) return '—'
  return format(d, 'dd MMM yyyy')
}

export function dueBadge(dateStr) {
  const d = daysLeft(dateStr)
  if (d === null) return null
  if (d < 0)  return { text: 'Overdue',    bg: '#fee2e2', color: '#dc2626' }
  if (d === 0) return { text: 'Today',     bg: '#fef3c7', color: '#d97706' }
  if (d <= 3)  return { text: `${d}d left`, bg: '#fef3c7', color: '#d97706' }
  return           { text: `${d}d left`, bg: '#f1f5f9', color: '#64748b' }
}
