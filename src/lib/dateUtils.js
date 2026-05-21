// src/lib/dateUtils.js
import {
  format, parseISO, isValid,
  differenceInCalendarDays, startOfDay,
  startOfMonth, getDaysInMonth, addDays,
  subDays,
} from 'date-fns'

export const todayStr = () => format(new Date(), 'yyyy-MM-dd')

// First day of the current month as yyyy-MM-dd string
export const getMonthStart = () => format(startOfMonth(new Date()), 'yyyy-MM-dd')

// Returns all date strings for the current month up to today
// e.g. ['2026-05-01', '2026-05-02', ... '2026-05-17']
export const getMonthDates = () => {
  const today    = new Date()
  const first    = startOfMonth(today)
  const daysInMonth = getDaysInMonth(today)
  const todayNum = today.getDate()
  // Only go up to today (not future days in the month)
  return Array.from({ length: todayNum }, (_, i) =>
    format(addDays(first, i), 'yyyy-MM-dd')
  )
}

// Returns all days of the month for the calendar grid (including future, for layout)
export const getAllMonthDates = () => {
  const today   = new Date()
  const first   = startOfMonth(today)
  const total   = getDaysInMonth(today)
  return Array.from({ length: total }, (_, i) =>
    format(addDays(first, i), 'yyyy-MM-dd')
  )
}

// Day-of-week (0=Sun … 6=Sat) for the first day of current month
export const getMonthStartDow = () => startOfMonth(new Date()).getDay()

export const formatDisplay = (d) => {
  if (!d) return '—'
  const parsed = typeof d === 'string' ? parseISO(d) : d
  return isValid(parsed) ? format(parsed, 'dd MMM yyyy') : '—'
}

// FIX: use startOfDay so near-midnight comparisons don't produce off-by-one
export const daysLeft = (d) => {
  if (!d) return null
  const parsed = parseISO(d)
  if (!isValid(parsed)) return null
  return differenceInCalendarDays(parsed, startOfDay(new Date()))
}

export const dueBadge = (d) => {
  const n = daysLeft(d)
  if (n === null) return null
  if (n < 0)   return { text: 'Overdue',    bg: '#fee2e2', color: '#dc2626' }
  if (n === 0) return { text: 'Due Today',  bg: '#fef3c7', color: '#d97706' }
  if (n <= 3)  return { text: `${n}d left`, bg: '#fef3c7', color: '#d97706' }
  return             { text: `${n}d left`,  bg: '#f0fdf4', color: '#16a34a' }
}
