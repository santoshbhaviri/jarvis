// src/lib/parseTask.js
// Turns a spoken or typed note into a task, e.g.
//   "Follow up with DEO on survey by Friday #work !"
//   → { title: 'Follow up with DEO on survey', due_date: <next Fri>, waiting_on: 'DEO', important: true, ... }
//
// Rules:
//   dates      today, tomorrow, day after tomorrow, next week, Mon–Sun, 15/10, 15 Oct, Oct 15
//   people     "follow up with X", "waiting on/for X", "chase X", "remind X"
//   category   #work / #personal
//   priority   "!" or the word important → important; urgent / asap / today → urgent
//   status     daily / every day → routine; important → mission; anything else → scut-work

import { format, addDays, startOfWeek } from 'date-fns'

const MONTHS = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec']
const WD3    = ['sun','mon','tue','wed','thu','fri','sat']
const ymd    = (d) => format(d, 'yyyy-MM-dd')

function nextWeekday(idx, base) {
  let n = (idx - base.getDay() + 7) % 7
  if (n === 0) n = 7
  return addDays(base, n)
}

export function parseTask(text, now = new Date()) {
  const base = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayYmd = ymd(base)
  const task = {
    title: '', category: 'work', status: 'scut-work', due_date: '', notes: '',
    important: false, urgent: false, waiting_on: '', follow_up: '',
  }
  let s = ' ' + text.trim() + ' '
  const take = (re) => { const m = s.match(re); if (m) s = s.replace(m[0], ' '); return m }
  let m

  if ((m = take(/#(work|office|personal|home|family)\b/i))) {
    task.category = /work|office/i.test(m[1]) ? 'work' : 'personal'
  }
  if (take(/\s!+(?=\s)/) || take(/\b(important|priority)\b/i)) task.important = true
  if (take(/\b(urgent|asap|immediately)\b/i) || /\btoday\b/i.test(s)) task.urgent = true

  let daily = false
  if (take(/\b(every ?day|daily)\b/i)) daily = true

  const by = '(?:by |on |before |due |this )?'
  if ((m = take(new RegExp('\\b' + by + 'day after tomorrow\\b', 'i')))) task.due_date = ymd(addDays(base, 2))
  else if ((m = take(new RegExp('\\b' + by + 'tomorrow\\b', 'i')))) task.due_date = ymd(addDays(base, 1))
  else if ((m = take(new RegExp('\\b' + by + 'today\\b', 'i')))) task.due_date = todayYmd
  else if ((m = take(new RegExp('\\b' + by + 'next week\\b', 'i')))) task.due_date = ymd(addDays(startOfWeek(base, { weekStartsOn: 1 }), 7))
  else if ((m = take(new RegExp('\\b' + by + '(?:next )?(sun|mon|tue|tues|wed|thu|thur|thurs|fri|sat)(?:day|nesday|sday|urday)?\\b', 'i')))) {
    task.due_date = ymd(nextWeekday(WD3.indexOf(m[1].toLowerCase().slice(0, 3)), base))
  }
  else if ((m = take(new RegExp('\\b' + by + '(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b', 'i')))) {
    const y = m[3] ? Number(m[3].length === 2 ? '20' + m[3] : m[3]) : base.getFullYear()
    const d = new Date(y, Number(m[2]) - 1, Number(m[1]))
    if (!m[3] && d < base) d.setFullYear(y + 1)
    task.due_date = ymd(d)
  }
  else if ((m = take(new RegExp('\\b' + by + '(\\d{1,2})(?:st|nd|rd|th)? (jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\b', 'i'))
             || take(new RegExp('\\b' + by + '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]* (\\d{1,2})(?:st|nd|rd|th)?\\b', 'i')))) {
    const numFirst = /^\d/.test(m[1])
    const day = Number(numFirst ? m[1] : m[2])
    const mon = MONTHS.indexOf((numFirst ? m[2] : m[1]).toLowerCase().slice(0, 3))
    const d = new Date(base.getFullYear(), mon, day)
    if (d < base) d.setFullYear(base.getFullYear() + 1)
    task.due_date = ymd(d)
  }

  // Keyword is any case; a capitalised name runs until the first lowercase word ("DEO on survey" → DEO)
  if ((m = s.match(/\b(?:[Ff]ollow[ -]?[Uu]p [Ww]ith|[Ww]aiting (?:[Oo]n|[Ff]or)|[Cc]hase|[Rr]emind)\s+(?:the\s+)?([A-Z][\w.]*(?:\s+[A-Z][\w.]*)*|[a-z]+)/))) {
    task.waiting_on = m[1].trim()
    task.follow_up  = task.due_date || ymd(addDays(base, 2))
  }

  if (daily)                task.status = 'routine'
  else if (task.important)  task.status = 'mission'
  if (task.status === 'routine') task.due_date = ''
  if (task.status === 'scut-work' && !task.due_date) task.due_date = todayYmd
  if (task.status === 'mission'   && !task.due_date) task.due_date = ymd(addDays(base, 7))

  let title = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.;:-]+$/, '')
  if (!title) title = text.trim()
  task.title = title.charAt(0).toUpperCase() + title.slice(1)
  return task
}
