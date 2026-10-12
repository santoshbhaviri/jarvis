// Your day: today's and tomorrow's events and birthdays from your calendar, and the mail from people
// that needs you, for the card at the top of Today. Only your login can use it (JARVIS_OWNER_EMAIL),
// and the calendar link and Gmail app password stay in Netlify's own storage, never sent back.
//   GET              → { calendar, mail, events, mails, at, problems } (kept for 15 minutes)
//   GET ?fresh       → the same, read again now
//   GET ?ping        → { ready: true } (no login needed; shows the function and its libraries load)
//   POST { action: 'calendar', link }            tries the link, then keeps it
//   POST { action: 'mail', address, password }   tries signing in to Gmail, then keeps it
//   POST { action: 'remove', what }              'calendar' or 'mail'
import { getStore } from '@netlify/blobs'
import { env, json, owner } from '../lib/common.mjs'
import { checkCalendarLink, readCalendar } from '../lib/calendar.mjs'
import { checkMailLogin, testMail, recentMail } from '../lib/mail.mjs'
import { askAI, claudeKey } from '../lib/ai.mjs'
import { STORAGE_DOWN } from '../lib/memory.mjs'

const settings = () => getStore({ name: 'jarvis-settings', consistency: 'strong' })
const KEEP = 15 * 60e3
const istDate = (at = Date.now()) => new Date(at + 5.5 * 3600e3).toISOString().slice(0, 10)

export default async (req) => {
  const began = Date.now()
  if (new URL(req.url).searchParams.has('ping')) return json({ ready: true })
  if (!env('JARVIS_OWNER_EMAIL')) return json({ error: 'no_owner', why: 'Add JARVIS_OWNER_EMAIL in Netlify first (your login email), so only you can see your mail and calendar.' }, 403)
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)
  const store = settings()
  try {
    if (req.method === 'POST') return await change(store, await req.json().catch(() => ({})))
    const [cal, mail] = await Promise.all([store.get('day/calendar', { type: 'json' }), store.get('day/mail', { type: 'json' })])
    const linked = { calendar: !!cal?.link, mail: mail?.address || null }
    if (!cal?.link && !mail?.address) return json({ ...linked, events: [], mails: [] })
    const fresh = new URL(req.url).searchParams.has('fresh')
    const kept = await store.get('day/latest', { type: 'json' }).catch(() => null)
    if (!fresh && kept && kept.day === istDate() && Date.now() - Date.parse(kept.at) < KEEP && kept.calendar === linked.calendar && kept.mail === linked.mail) {
      return json(kept)
    }
    const out = { ...linked, ...(await read(cal, mail, began, kept)), day: istDate(), at: new Date().toISOString() }
    await store.setJSON('day/latest', out).catch(() => {})
    return json(out)
  } catch {
    return json({ error: 'storage', why: STORAGE_DOWN }, 503)
  }
}

async function change(store, body) {
  if (body.action === 'remove') {
    if (!['calendar', 'mail'].includes(body.what)) return json({ error: 'bad_request' }, 400)
    await store.delete(`day/${body.what}`)
    await store.delete('day/latest')
    return json({ ok: true })
  }
  if (body.action === 'calendar') {
    const { link, why } = checkCalendarLink(body.link)
    if (!link) return json({ error: 'bad_link', why }, 400)
    const test = await readCalendar(link)
    if (test.error) return json({ error: test.error, why: test.why }, 400)
    await store.setJSON('day/calendar', { link, at: new Date().toISOString() })
    await store.delete('day/latest')
    return json({ ok: true, today: test.events.filter(e => e.day === 'today').length })
  }
  if (body.action === 'mail') {
    const login = checkMailLogin(body.address, body.password)
    if (!login.password) return json({ error: 'bad_login', why: login.why }, 400)
    const test = await testMail(login)
    if (test.error) return json({ error: test.error, why: test.why }, 400)
    await store.setJSON('day/mail', { ...login, at: new Date().toISOString() })
    await store.delete('day/latest')
    return json({ ok: true, address: login.address })
  }
  return json({ error: 'bad_request' }, 400)
}

// Calendar and mail side by side; whatever isn't back in time is left for next time.
// Claude sorts the mail again only when something new has come in since the last time.
async function read(cal, mail, began, kept) {
  const problems = {}
  const [c, m] = await Promise.all([
    cal?.link ? readCalendar(cal.link, Date.now(), 9000) : { events: [] },
    mail?.address ? recentMail(mail, { within: 12000 }) : { mails: [] },
  ])
  if (c.error) problems.calendar = c.why
  if (m.error) problems.mail = m.why
  const found = m.mails || []
  const ids = found.map(x => x.id).join('|')
  if (ids && kept?.sortedFor === ids && Array.isArray(kept.mails)) return { events: c.events || [], mails: kept.mails, sortedFor: ids, problems }
  const sorted = found.length ? await sortMail(found, began + 26000) : null
  return { events: c.events || [], mails: sorted?.mails || [], ...(sorted?.byClaude && { sortedFor: ids }), problems }
}

// Which mails need you, and what each one wants, in a line. Claude reads them (never the free
// Gemini, which may keep what it reads). Without Claude, the newest mails from people are shown.
const SORT = {
  type: 'object',
  properties: {
    mails: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: 'The number of the mail in the list' },
          line: { type: 'string', description: 'What they want or what you need to do, in under 12 words' },
          reply: { type: 'boolean', description: 'They are waiting for an answer or action from you' },
        },
        required: ['n', 'line', 'reply'],
        additionalProperties: false,
      },
    },
  },
  required: ['mails'],
  additionalProperties: false,
}
async function sortMail(mails, until) {
  const plain = (list) => ({ mails: list.slice(0, 6).map(({ text, ...m }) => ({ ...m, line: m.subject, reply: false })) })
  if (!(await claudeKey()).key || until - Date.now() < 4000) return plain(mails)
  const list = mails.map((m, i) => `#${i}\nFrom: ${m.name} <${m.from}>\nDate: ${m.at}\nSubject: ${m.subject}\n${m.text}`).join('\n\n')
  const out = await askAI({
    system: 'You sort the recent mail of Santosh, a CGST officer in India, for the "Your day" card in his task app. Keep only mail from real people (friends, family, colleagues, officials) that he should see today: anything asking him something, waiting on a reply, a deadline, a meeting, or important news. Leave out receipts, adverts, newsletters, automatic notices and anything only for information. Most important first. Write each line in plain English, naming the action, like "Wants to know if you\'re free for dinner Saturday".',
    turns: [{ role: 'user', text: `Recent mail:\n\n${list}` }],
    schema: SORT, model: 'quick', maxTokens: 1500, until, claudeOnly: true,
  })
  if (out.error || !Array.isArray(out.json?.mails)) return plain(mails)
  const seen = new Set()
  return {
    byClaude: true,
    mails: out.json.mails
      .filter(p => mails[p.n] && !seen.has(p.n) && seen.add(p.n))
      .slice(0, 8)
      .map(p => { const { text, ...m } = mails[p.n]; return { ...m, line: String(p.line || m.subject).slice(0, 140), reply: !!p.reply } }),
  }
}
