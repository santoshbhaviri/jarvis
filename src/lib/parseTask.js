// src/lib/parseTask.js
// Turns a spoken or typed note into a task, e.g.
//   "Call DEO about survey on Friday #work !"
//   → { title: 'Call DEO about survey', due_date: <next Fri>, important: true, ... }
//
// Rules:
//   dates      today, tomorrow, day after tomorrow, next week, next month, in 3 days,
//              Mon–Sun, 15/10, 15 Oct, Oct 15, on 21st (this month, or next if it has passed)
//   category   #work / #personal
//   highlight  "!" or the word important → important (★)
//   status     daily / every day → routine (a Tracker habit); anything else → scut-work (a task)
//   repeat     every Monday, weekly, on the 1st of every month, every 3 days → comes back each time
//   follow-up  "Waiting for Collector's reply" → comes back in 3 days unless a day is given

import { format, addDays, addMonths, startOfWeek, startOfMonth } from 'date-fns'
import { takeRepeat, firstOn, repeatNote } from './repeat'

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
    important: false, urgent: false, follow_up: null, waiting_on: null,
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
  const rep = daily ? null : takeRepeat(s)
  if (rep) s = rep.text

  const by = '(?:by |on |before |due |for |this |coming )?'
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

  else if ((m = take(new RegExp('\\b' + by + 'next month\\b', 'i')))) task.due_date = ymd(startOfMonth(addMonths(base, 1)))
  else if ((m = take(/\b(?:in|after) (\d{1,2}|a|one|two|three|four|five|six|seven|ten) (day|week)s?\b/i))) {
    const n = /^\d/.test(m[1]) ? Number(m[1]) : NUMBERS[m[1].toLowerCase()]
    task.due_date = ymd(addDays(base, n * (m[2].toLowerCase() === 'week' ? 7 : 1)))
  }
  // "on 21st", "by the 3rd", "on 21": a day of this month, or next month once it has passed
  else if ((m = take(/\b(?:on|by|before) (?:the )?(\d{1,2})(?:st|nd|rd|th)?\b(?! ?(?:am|pm|o'clock|:|\.\d|hours?|mins?|minutes?|rs|rupees|%))/i)
             || take(/\b(?:the )?(\d{1,2})(?:st|nd|rd|th)\b/i))) {
    const day = Number(m[1])
    if (day >= 1 && day <= 31) {
      let d = new Date(base.getFullYear(), base.getMonth(), day)
      if (d < base || d.getDate() !== day) d = new Date(base.getFullYear(), base.getMonth() + 1, day)
      task.due_date = ymd(d)
    }
  }

  const dated = !!task.due_date
  if (rep) {
    const rule = rep.rule
    if (rule.kind === 'week' && rule.day == null) rule.day = (dated ? new Date(task.due_date) : base).getDay()
    if (rule.kind === 'month' && rule.date == null) rule.date = dated ? Number(task.due_date.slice(8, 10)) : base.getDate()
    if (!dated) task.due_date = ymd(firstOn(rule, base))
    task.notes = repeatNote(rule)
  }
  if (daily) { task.status = 'routine'; task.due_date = '' }
  else if (!task.due_date) task.due_date = todayYmd

  let title = s.replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim().replace(/[,.;:-]+$/, '')
  title = stripFiller(title)
  if (!title) title = text.trim()
  task.title = title.charAt(0).toUpperCase() + title.slice(1)

  // Waiting on someone: it comes back in 3 days to chase, unless a day was given
  const wait = !daily && task.title.match(FOLLOW)
  if (wait) {
    if (!dated && !rep) task.due_date = ymd(addDays(base, 3))
    task.follow_up = task.due_date
    task.waiting_on = (wait[1] || '').replace(/'s$/i, '').trim() || null
  }
  Object.defineProperty(task, 'dated', { value: dated })   // said a day? (not saved)
  return task
}

const FOLLOW = /\b(?:waiting (?:for|on)|awaiting|await|follow ?up (?:with|on)|chase|pending (?:from|with))\s+(?:the\s+|a\s+)?([\w.]+(?:'s)?)/i

const NUMBERS = { a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 }

// "Jarvis, please remind me to call DEO" → "call DEO"
const FILLER = /^(?:(?:hey |ok |okay )?jarvis\b[,.]?\s*)?(?:please\s+)?(?:(?:i|we) (?:need|want|have|got|would like) to(?: do)?|i should|i must|i will|i'll|remind me to|remember to|don't forget to|(?:add|create|make)(?: a| new)? (?:task|reminder|todo|to-do)(?: to| for)?|(?:add|create)(?=\s))\s*[:,-]?\s*/i
function stripFiller(t) {
  let prev
  do { prev = t; t = t.replace(FILLER, '').trim() } while (t !== prev)
  return t.replace(/^(?:to|that)\s+/i, '')
}

// One spoken sentence can hold several tasks:
//   "On 21st call the DEO and send the survey report, also book train tickets for Sunday"
//   → call the DEO (21st) · send the survey report (21st) · book train tickets (Sunday)
// A part without its own day takes the day of the part before it.
const VERBS = 'call|send|book|meet|submit|buy|pay|email|mail|visit|review|check|prepare|attend|go|finish|write|reply|follow|schedule|sign|collect|get|pick|take|file|inspect|print|renew|ask|tell|inform|remind|arrange|order|clean|complete|start|plan|talk|speak|discuss|share|update|forward|approve|verify|draft|fix|repair|return|bring|apply|register|transfer|deposit|withdraw|pay|read|study|practice|cook|drop'
const SPLIT = new RegExp(`\\s*(?:[;\\n]+|,\\s*(?:and\\s+)?(?:then\\s+|also\\s+)?|\\s(?:and then|then|also|after that|and also)\\s|\\sand\\s(?=(?:i (?:need|have|want) to |to |please )?(?:${VERBS})\\b))\\s*`, 'i')

export function parseCommand(text, now = new Date()) {
  const parts = text.split(SPLIT).map(p => p.trim()).filter(p => /\w/.test(p))
  // A day said only at the start ("On 21st I need to call DEO and visit school") covers the parts after it
  let carry = null
  return parts.map(p => {
    const t = parseTask(p, now)
    if (t.dated) carry = t.due_date
    else if (carry && t.status !== 'routine') t.due_date = carry
    return { ...t }
  })
}
