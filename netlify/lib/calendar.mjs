// Your calendar for Today's "Your day" card, read from its private link (an .ics address).
//   Google Calendar: Settings, your calendar, "Secret address in iCal format".
//   iPhone (iCloud): Calendar, (i) next to the calendar, Public Calendar, Share Link.
// Jarvis only reads the link; it never changes your calendar. India time throughout.
import ICAL from 'ical.js'

const IST = 5.5 * 3600e3
const DAY = 86400e3
// Words that mark a birthday, in English, Hindi and Telugu
const BIRTHDAY = /birthday|b'?day|जन्मदिन|పుట్టినరోజు/i

// The pasted link, made fetchable, or a plain reason it isn't a calendar link
export function checkCalendarLink(raw) {
  let link = String(raw || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/\s+/g, '')
  if (!link) return { why: 'Paste your calendar link first.' }
  link = link.replace(/^webcals?:\/\//i, 'https://')
  let url
  try { url = new URL(link) } catch { return { why: "That isn't a link. Copy the whole address, starting with https://" } }
  if (url.protocol !== 'https:') return { why: 'The link should start with https://' }
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.)/.test(url.hostname) || !url.hostname.includes('.')) return { why: "That link can't be reached from the internet." }
  if (url.hostname === 'calendar.google.com' && !url.pathname.startsWith('/calendar/ical/')) {
    return { why: 'That is the page link. In Google Calendar open Settings, click your calendar, and copy "Secret address in iCal format".' }
  }
  return { link: url.toString() }
}

// Today's and tomorrow's events and birthdays from the calendar at `link`.
// → { events: [{ title, day, start?, end?, allDay, where?, birthday }] } or { error, why }
export async function readCalendar(link, now = Date.now(), within = 9000) {
  let text
  try {
    const res = await fetch(link, { headers: { Accept: 'text/calendar' }, signal: AbortSignal.timeout(within), redirect: 'follow' })
    if (res.status === 404 || res.status === 403 || res.status === 401) {
      return { error: 'not_shared', why: /google/.test(link)
        ? 'Google didn\'t open this calendar. Copy "Secret address in iCal format" (not the public address) from your calendar\'s settings.'
        : "The calendar didn't open with this link. Copy the share link again." }
    }
    if (!res.ok) return { error: 'busy', why: "Couldn't reach your calendar just now. Try again in a minute." }
    text = await res.text()
  } catch {
    return { error: 'busy', why: "Couldn't reach your calendar just now. Try again in a minute." }
  }
  if (!/BEGIN:VCALENDAR/i.test(text.slice(0, 2000))) {
    return { error: 'not_calendar', why: "That link doesn't lead to a calendar. Copy the iCal address of your calendar." }
  }
  try { return { events: eventsIn(text, now) } }
  catch { return { error: 'not_calendar', why: "Jarvis couldn't read this calendar. Copy the iCal address of your calendar again." } }
}

// The events in an .ics file that fall on today or tomorrow (India time), earliest first
export function eventsIn(text, now = Date.now()) {
  const cal = new ICAL.Component(ICAL.parse(text))
  const name = cal.getFirstPropertyValue('x-wr-calname') || ''
  const today = istDate(now), tomorrow = istDate(now + DAY)
  const from = istMidnight(now), to = from + 2 * DAY

  // Changed single dates of a repeating event come as separate entries with the same UID
  const changed = {}
  for (const v of cal.getAllSubcomponents('vevent')) {
    if (v.hasProperty('recurrence-id')) (changed[v.getFirstPropertyValue('uid')] ||= []).push(v)
  }

  const out = []
  const add = (ev, start, end) => {
    if ((ev.component.getFirstPropertyValue('status') || '').toUpperCase() === 'CANCELLED') return
    const title = (ev.summary || '').trim() || 'Busy'
    const birthday = BIRTHDAY.test(title) || BIRTHDAY.test(name)
    if (start.isDate) {
      // All day: on every date from the start up to (not including) the end
      const first = start.toString().slice(0, 10)
      const last = end ? end.toString().slice(0, 10) : null
      for (const day of [today, tomorrow]) {
        if (day === first || (day > first && last && day < last)) out.push({ title, day: day === today ? 'today' : 'tomorrow', allDay: true, birthday, ...where(ev) })
      }
      return
    }
    const s = ms(start), e = end ? ms(end) : s
    if (s >= to || e < from || (e === from && e > s)) return
    const day = s < from + DAY ? 'today' : 'tomorrow'
    out.push({ title, day, start: new Date(s).toISOString(), end: new Date(e).toISOString(), allDay: false, birthday, ...where(ev) })
  }

  for (const v of cal.getAllSubcomponents('vevent')) {
    if (v.hasProperty('recurrence-id') || !v.hasProperty('dtstart')) continue
    const ev = new ICAL.Event(v, { strictExceptions: true, exceptions: changed[v.getFirstPropertyValue('uid')] || [] })
    if (!ev.isRecurring()) { add(ev, ev.startDate, ev.endDate); continue }
    // A repeating event: walk its dates up to the end of tomorrow (birthdays repeat yearly)
    const it = ev.iterator()
    for (let i = 0, next; i < 20000 && (next = it.next()); i++) {
      const at = next.isDate ? Date.parse(next.toString().slice(0, 10)) - IST : ms(next)
      if (at >= to) break
      if (at < from - 31 * DAY) continue
      const d = ev.getOccurrenceDetails(next)
      add(d.item, d.startDate, d.endDate)
    }
  }

  // All-day first (birthdays at the top), then by time
  return out.sort((a, b) => (a.day === b.day ? 0 : a.day === 'today' ? -1 : 1)
    || (b.birthday - a.birthday) || (b.allDay - a.allDay) || String(a.start).localeCompare(String(b.start)))
}

const where = (ev) => { const w = (ev.location || '').trim(); return w ? { where: w.slice(0, 120) } : {} }

// A calendar time as milliseconds. A time with no zone (or one Jarvis doesn't know) is India time.
function ms(t) {
  const known = t.zone && t.zone.tzid && t.zone.tzid !== 'floating' && t.zone !== ICAL.Timezone.localTimezone
  if (known) return t.toUnixTime() * 1000
  return Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute, t.second) - IST
}

// India's date and the moment its day began
const istDate = (at) => new Date(at + IST).toISOString().slice(0, 10)
const istMidnight = (at) => Math.floor((at + IST) / DAY) * DAY - IST
