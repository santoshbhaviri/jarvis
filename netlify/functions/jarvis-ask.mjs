// The Assist tab: chat inside Jarvis with Claude (Sonnet), or with the free Gemini key until Claude
// is connected (see netlify/lib/ai.mjs).
// The app sends what you said plus today's tasks; your Knowledge goes in too: your notes, the
// best-matching passages from your Library (documents kept in full) and, once your Knowledge is in
// Supabase, earlier chats on the same subject. Each question and answer is kept there too.
// The answer can carry tasks to add, a message or draft to send and a number to call, which the
// app shows as buttons. A lasting preference or fact you mention is saved to your Knowledge by
// itself (learned), and the app offers Undo.
import { env, json, owner, geminiKey } from '../lib/common.mjs'
import { askAI, aiReady, claudeKey } from '../lib/ai.mjs'
import { knowledgeFor } from '../lib/store.mjs'

const SYSTEM = `You are Jarvis, a personal assistant inside a phone app used by a senior government officer in Telangana, India, who works in GST (CGST) administration.
They often speak by keyboard dictation, so their words may contain small mistakes; read for meaning.
Answer the way a capable personal secretary would: direct, warm, and short. Lead with the answer. Plain text only: no headings, tables or markdown symbols; a short list with "-" is fine.

GST and tax: you are also their expert tax assistant. Answer GST questions like an experienced officer and practitioner of the CGST Act 2017, IGST Act 2017, the CGST Rules 2017, notifications, circulars, show cause notices, adjudication, appeals, refunds, registration, returns, ITC, audit and investigation.
- Name the exact section, rule, notification or circular where you are sure of it, and explain what it means in practice: who does what, by when, and what happens next.
- Say plainly when a point may have changed after your knowledge (Finance Act amendments, new notifications) and that the bare Act or rule on cbic-gst.gov.in is the final word.
- Never invent a section, rule, notification or circular number, a case name or a date. If you are not sure, say so.
- Jarvis keeps their Library (documents in full) and gives you the passages that match each question, so never say you can't read or store an Act or a document. Work from the passages you are given.
- When they ask for a draft (show cause notice, order, reply, letter, note), write it complete in the formal style of CGST offices, with [placeholders] for facts not given.

Writing: when they ask you to write or polish a message, letter or draft, put the finished text in the message field only (not in the answer), in their voice (polite, clear, Indian English); in the answer say in one line what you wrote.
Tasks: when they mention things they need to do, put clean, short task titles in the tasks field (with a date only if they gave one).
Calls: when they ask you to call someone and give a number, put it in the call field.
Learning: when they tell you a lasting preference or fact about themselves, their work or the people they deal with, put a short note of it in the remember field; Jarvis saves it to their Knowledge so you know it next time. Leave it empty for one-off questions and for anything their Knowledge already says.
You cannot search the web. For live news, prices or weather, give what you know and say the Search tab has the latest.
You cannot operate their phone, change settings or send anything yourself; the app shows buttons they tap.
If they ask what you can do: chat and answer anything, GST law and drafting, write and polish messages (send by WhatsApp, SMS or email), turn what they say into tasks, plan the day from their tasks, keep notes and preferences in their Knowledge and learn from what they say (say "remember ..." or tap Knowledge), recall earlier conversations, keep whole documents in their Library (the paperclip in Assist adds a PDF, photo or text file: the bare Act and Rules, notices, orders, circulars) and quote them with document and page, and use both in every answer. The Search tab has the latest news; the Evolve tab takes ideas for Jarvis itself.`

// The answer comes as fields, in this order (so if time runs out, the answer and draft come first)
const orNull = (description) => ({ anyOf: [{ type: 'string' }, { type: 'null' }], ...(description && { description }) })
const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['answer', 'message', 'tasks', 'call', 'remember'],
  properties: {
    answer: { type: 'string', description: 'What you say back, plain text' },
    message: {
      anyOf: [{
        type: 'object', additionalProperties: false, required: ['text', 'to', 'subject'],
        properties: {
          text: { type: 'string' },
          to: orNull('Phone number or email if the user gave one'),
          subject: orNull(),
        },
      }, { type: 'null' }],
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['title', 'date', 'important'],
        properties: {
          title: { type: 'string' },
          date: orNull('YYYY-MM-DD, only if a day was given'),
          important: { type: 'boolean' },
        },
      },
    },
    call: orNull('Phone number to call, only if the user gave one'),
    remember: orNull('A lasting preference or fact worth saving to their Knowledge, in one short sentence'),
  },
}
const MORE = '(I ran out of time here. Say "continue" for the rest.)'

export default async (req) => {
  const began = Date.now()
  // connect: no Claude key yet and Jarvis can keep one, so Assist shows the box for pasting it
  if (req.method === 'GET') {
    const { key } = await claudeKey()
    return json({ ready: !!(key || geminiKey().key), connect: !key && !!env('JARVIS_OWNER_EMAIL') })
  }
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)
  if (!(await aiReady())) {
    const { why } = geminiKey()
    return why ? json({ error: 'bad_key', why }, 503) : json({ error: 'not_configured' }, 503)
  }

  // docs: Library documents added in this chat, which count first
  const { turns = [], context = '', docs = [] } = await req.json()
  const recent = turns.slice(-10).filter(t => t.text?.trim())
  if (!recent.length || recent.at(-1).role !== 'user') return json({ error: 'empty' }, 400)

  // Today's date and tasks go in with the latest question only
  const said = recent.map((t, i) => ({ role: t.role, text: i === recent.length - 1 ? `${context}\n\n${t.text}` : t.text }))
  // Knowledge is searched with the question and the one before it, for "and what about…"
  const yours = recent.filter(t => t.role === 'user').map(t => t.text)
  const know = await knowledgeFor(req, user, yours.slice(-2).join('\n'), { docs: docs.slice(0, 5), chats: true, skip: yours })
  const out = await askAI({
    system: [SYSTEM, know.text].filter(Boolean).join('\n\n'), extra: know.extra,
    turns: said, schema: SCHEMA, effort: 'medium', maxTokens: 8192, until: began + 26000,
  })
  if (out.error) return json({ error: out.error, why: out.why }, out.status || 502)
  const a = out.json
  const draft = a.message?.text ? a.message : null
  const text = (a.answer || 'Here you go.') + (out.cut ? `\n\n${MORE}` : '')
  // Saving waits until 28.5 seconds in at most, so a slow Supabase never costs you the answer
  let timer
  const [learned] = await Promise.race([
    Promise.all([
      learn(know, a.remember),
      know.k?.chats.add(yours.at(-1), draft ? `${text}\n\n${draft.text}` : text).catch(() => {}),
    ]),
    new Promise(done => { timer = setTimeout(() => done([null]), Math.max(500, began + 28500 - Date.now())) }),
  ])
  clearTimeout(timer)
  return json({ text, actions: {
    tasks: out.cut ? [] : a.tasks ?? [], message: draft, call: a.call || null,
    learned: learned?.item || null, remember: learned ? null : a.remember || null,
  } })
}

// Saves what Claude noticed to your Knowledge, unless it is there already
// → { item } (saved), { known: true }, or null (couldn't save: the app offers a Save button)
async function learn(know, note) {
  if (!note?.trim() || !know.k) return null
  const plain = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  if (know.items.some(m => plain(m.text) === plain(note))) return { known: true }
  try {
    const item = await know.k.notes.add({ text: note.trim(), from: 'learned' })
    return { item: { id: item.id, text: item.text } }
  } catch { return null }
}
