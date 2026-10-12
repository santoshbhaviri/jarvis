// Your Gmail for Today's "Your day" card. Jarvis signs in with a Google app password (made at
// myaccount.google.com/apppasswords, which needs 2-Step Verification) and only reads: the inbox is
// opened read-only, so nothing is marked read, moved or sent. Only mail from the last few days in
// the Primary tab is looked at, and newsletters and automatic mail are left out before the AI sees it.
import { ImapFlow } from 'imapflow'
import { env, looksLike } from './common.mjs'

// JARVIS_IMAP_HOST / JARVIS_IMAP_PORT are only for testing against another mail server
const GMAIL = { host: env('JARVIS_IMAP_HOST') || 'imap.gmail.com', port: Number(env('JARVIS_IMAP_PORT')) || 993, secure: true }
const NOT_PEOPLE = /no-?reply|do-?not-?reply|notifications?@|alerts?@|mailer-daemon|newsletter|updates?@|info@|news@|bounce/i

// The pasted address and app password, or a plain reason they won't work
export function checkMailLogin(rawAddress, rawPassword) {
  const address = String(rawAddress || '').trim().toLowerCase()
  const password = String(rawPassword || '').trim().replace(/^(['"])([\s\S]*)\1$/, '$2').replace(/[\s-]+/g, '')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) return { why: 'Type your Gmail address first.' }
  if (!password) return { why: 'Paste the app password first.' }
  const kind = looksLike(password)
  if (kind) return { why: `That looks like your ${kind}. Paste the 16-letter app password from Google.` }
  if (!/^[a-z]{16}$/i.test(password)) return { why: 'An app password is 16 letters, shown in four groups. Copy it again from Google.' }
  return { address, password: password.toLowerCase() }
}

// Google's reason for refusing to sign in, in plain words
function signInProblem(e) {
  const said = `${e?.responseText || ''} ${e?.response || ''} ${e?.message || ''}`
  if (/Application-specific password required/i.test(said)) return { error: 'bad_login', why: 'Google wants an app password here, not your Google password. Make one at myaccount.google.com/apppasswords.' }
  if (e?.authenticationFailed || /AUTHENTICATIONFAILED|Invalid credentials/i.test(said)) {
    return { error: 'bad_login', why: "Google didn't accept this address and app password. Check the address, or make a new app password." }
  }
  if (/web ?browser|WEBALERT/i.test(said)) return { error: 'bad_login', why: 'Google wants you to sign in once in a browser first. Open gmail.com, sign in, then try again.' }
  return { error: 'busy', why: "Couldn't reach Gmail just now. Try again in a minute." }
}

function client({ address, password }, within) {
  return new ImapFlow({
    ...GMAIL,
    auth: { user: address, pass: password },
    logger: false,
    disableAutoIdle: true,
    connectionTimeout: Math.min(within, 9000),
    greetingTimeout: Math.min(within, 6000),
    socketTimeout: within,
  })
}

// Signs in and out again: {} when the address and app password work, else { error, why }
export async function testMail(login, within = 12000) {
  const c = client(login, within)
  try { await c.connect(); await c.logout().catch(() => {}); return {} }
  catch (e) { c.close(); return signInProblem(e) }
}

// Recent mail from people: [{ id, from, name, subject, at, text, unread, link }], newest first
//   days   how far back to look; max  how many messages at most
export async function recentMail(login, { days = 3, max = 25, within = 14000 } = {}) {
  const c = client(login, within)
  const stop = setTimeout(() => c.close(), within)   // never hold the answer past the deadline
  try {
    await c.connect()
  } catch (e) { clearTimeout(stop); c.close(); return signInProblem(e) }
  try {
    const lock = await c.getMailboxLock('INBOX', { readOnly: true })
    try {
      const gmail = c.capabilities.has('X-GM-EXT-1')
      const query = gmail
        ? { gmraw: `category:primary newer_than:${days}d -from:me` }
        : { since: new Date(Date.now() - days * 86400e3) }
      const uids = ((await c.search(query, { uid: true })) || []).slice(-max)
      if (!uids.length) return { mails: [] }
      const found = await c.fetchAll(uids, {
        uid: true, envelope: true, flags: true, bodyStructure: true, internalDate: true,
        headers: ['list-unsubscribe', 'list-id', 'precedence', 'auto-submitted', 'x-auto-response-suppress'],
      }, { uid: true })
      const mails = []
      for (const m of found.reverse()) {
        const from = m.envelope?.from?.[0] || {}
        const head = (m.headers || Buffer.alloc(0)).toString()
        if (/^(list-unsubscribe|list-id):/im.test(head) || /^precedence:\s*(bulk|list|junk)/im.test(head)
          || /^auto-submitted:\s*auto-/im.test(head) || NOT_PEOPLE.test(from.address || '')) continue
        const id = m.envelope?.messageId || ''
        mails.push({
          id: id || String(m.uid),
          uid: m.uid,
          from: (from.address || '').toLowerCase(),
          name: from.name || (from.address || '').split('@')[0],
          subject: (m.envelope?.subject || '').trim() || '(no subject)',
          at: new Date(m.envelope?.date || m.internalDate || Date.now()).toISOString(),
          unread: !m.flags?.has('\\Seen'),
          link: id ? `https://mail.google.com/mail/u/${encodeURIComponent(login.address)}/#search/rfc822msgid:${encodeURIComponent(id.replace(/^<|>$/g, ''))}` : 'https://mail.google.com/',
          part: textPart(m.bodyStructure),
        })
      }
      // The start of each message's text, for the AI to judge what it needs
      for (const mail of mails) {
        mail.text = mail.part ? await readPart(c, mail.uid, mail.part) : ''
        delete mail.part; delete mail.uid
      }
      return { mails }
    } finally { lock.release() }
  } catch (e) {
    return c.usable === false && /closed|timeout/i.test(String(e?.message)) ? { error: 'busy', why: 'Gmail was slow just now. Try again in a minute.' } : signInProblem(e)
  } finally {
    clearTimeout(stop)
    await c.logout().catch(() => c.close())
  }
}

// The plain-text part of a message (or its HTML part when there is no plain text)
function textPart(node, html = { part: null }) {
  if (!node) return null
  const type = `${node.type || ''}`.toLowerCase()
  if (type === 'text/plain' && node.disposition !== 'attachment') return node.part || '1'
  if (type === 'text/html' && node.disposition !== 'attachment' && !html.part) html.part = { html: node.part || '1' }
  for (const child of node.childNodes || []) {
    const found = textPart(child, html)
    if (found && typeof found === 'string') return found
  }
  return html.part
}

async function readPart(c, uid, part) {
  const which = typeof part === 'string' ? part : part.html
  try {
    const { content } = await c.download(String(uid), which, { uid: true, maxBytes: 4000 })
    if (!content) return ''
    let text = ''
    for await (const chunk of content) text += chunk.toString()
    if (typeof part !== 'string') text = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    // Drop quoted earlier messages and signatures' tails
    text = text.split(/\n\s*On .{5,80} wrote:\s*\n|\n-- \n|\n>/)[0]
    return text.replace(/\s+/g, ' ').trim().slice(0, 700)
  } catch { return '' }
}
