// Repeating tasks: "every Monday submit report", "pay rent on the 1st of every month",
// "water plants every 3 days". The rule is kept as the first line of the task's notes
// ("↻ Every Monday"), so it needs no database change and you can see it on the task.
// When you tick a repeating task, the next one is added for its next day.
import { format, addDays, parseISO } from 'date-fns'

const WD = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const NUM = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10, fifteen: 15 }
const ymd = (d) => format(d, 'yyyy-MM-dd')
const ord = (n) => n + (n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th')
const WDRE = '(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?s?'

// Finds a repeat in what was said. Returns { rule, text } with the words taken out,
// or null. rule: { kind: 'week', day } | { kind: 'month', date } | { kind: 'days', n }
// (day/date may be null: filled from the task's first date)
export function takeRepeat(text) {
  const tries = [
    [new RegExp(`\\b(?:every|each|on) ${WDRE}\\b(?: every week)?`, 'i'), m => ({ kind: 'week', day: WD.indexOf(m[1].toLowerCase().slice(0, 3)) }), (m) => m[0].toLowerCase().startsWith('on ') && !/s\b/i.test(m[0])],
    [new RegExp(`\\b(?:every|each) week(?: on ${WDRE})?\\b|\\bweekly(?: on ${WDRE})?\\b`, 'i'), m => ({ kind: 'week', day: (m[1] || m[2]) ? WD.indexOf((m[1] || m[2]).toLowerCase().slice(0, 3)) : null })],
    [/\b(?:on )?(?:the )?(\d{1,2})(?:st|nd|rd|th)? of (?:every|each) month\b/i, m => ({ kind: 'month', date: Number(m[1]) })],
    [/\b(?:every|each) month(?: on)?(?: the)?(?: (\d{1,2})(?:st|nd|rd|th)?)?\b|\bmonthly(?: on)?(?: the)?(?: (\d{1,2})(?:st|nd|rd|th)?)?\b/i, m => ({ kind: 'month', date: (m[1] || m[2]) ? Number(m[1] || m[2]) : null })],
    [/\bevery (\d{1,2})(?:st|nd|rd|th)\b/i, m => ({ kind: 'month', date: Number(m[1]) })],
    [/\bevery (\d{1,2}|two|three|four|five|six|seven|ten|fifteen) (day|week)s\b/i, m => ({ kind: 'days', n: (Number(m[1]) || NUM[m[1].toLowerCase()]) * (m[2].toLowerCase() === 'week' ? 7 : 1) })],
  ]
  for (const [re, make, skip] of tries) {
    const m = text.match(re)
    if (!m || (skip && skip(m))) continue
    const rule = make(m)
    if (rule.kind === 'month' && rule.date && (rule.date < 1 || rule.date > 31)) continue
    return { rule, text: text.replace(m[0], ' ') }
  }
  return null
}

export function ruleLabel(r) {
  if (r.kind === 'week') return `Every ${DAY_NAMES[r.day]}`
  if (r.kind === 'month') return `Monthly on the ${ord(r.date)}`
  return r.n % 7 === 0 && r.n > 7 ? `Every ${r.n / 7} weeks` : r.n === 7 ? 'Every week' : `Every ${r.n} days`
}

// Back from the "↻ …" line in a task's notes
export function ruleOf(task) {
  const line = (task?.notes || '').split('\n')[0]
  if (!line.startsWith('↻ ')) return null
  let m
  if ((m = line.match(/^↻ Every (Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/))) return { kind: 'week', day: DAY_NAMES.indexOf(m[1]) }
  if ((m = line.match(/^↻ Monthly on the (\d{1,2})/))) return { kind: 'month', date: Number(m[1]) }
  if ((m = line.match(/^↻ Every (\d+) days$/))) return { kind: 'days', n: Number(m[1]) }
  if ((m = line.match(/^↻ Every (\d+) weeks$/))) return { kind: 'days', n: Number(m[1]) * 7 }
  if (line === '↻ Every week') return { kind: 'days', n: 7 }
  return null
}

export const repeatNote = (rule) => '↻ ' + ruleLabel(rule)

// A day of the month, kept inside short months (31st → 30th / 28th)
function monthDay(y, m, date) {
  const last = new Date(y, m + 1, 0).getDate()
  return new Date(y, m, Math.min(date, last))
}

// First day on or after `from` (a Date) that the rule lands on
export function firstOn(rule, from) {
  if (rule.kind === 'week') return addDays(from, (rule.day - from.getDay() + 7) % 7)
  if (rule.kind === 'month') {
    const d = monthDay(from.getFullYear(), from.getMonth(), rule.date)
    return d >= from ? d : monthDay(from.getFullYear(), from.getMonth() + 1, rule.date)
  }
  return from
}

// The next day after `after` (yyyy-MM-dd)
export function nextAfter(rule, after) {
  const d = parseISO(after)
  if (rule.kind === 'days') return ymd(addDays(d, rule.n))
  return ymd(firstOn(rule, addDays(d, 1)))
}

export { ymd }
