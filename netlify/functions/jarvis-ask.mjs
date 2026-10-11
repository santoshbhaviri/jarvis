// The Assist tab: chat with Google Gemini (free tier) inside Jarvis.
// Needs GEMINI_API_KEY in Netlify. Optional GEMINI_MODEL (tried before Flash-Lite and Flash).
// The app sends what you said plus today's tasks; your Memory and the best-matching passages from
// your Library (documents kept in full) go in too. The answer can carry
// tasks to add, a message or draft to send, a number to call or something to remember, which the
// app shows as buttons.
import { env, json, owner, geminiKey, askGemini, geminiProblem, GEMINI_BUSY, GEMINI_LIMIT } from '../lib/common.mjs'
import { memoryFor } from '../lib/memory.mjs'
import { libraryFor } from '../lib/library.mjs'

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
Memory: when they tell you a lasting preference or fact about themselves, their work or the people they deal with, put a short note of it in the remember field so the app can offer to save it. Leave it empty for one-off questions.
You cannot search the web. For live news, prices or weather, give what you know and say the Search tab has the latest.
You cannot operate their phone, change settings or send anything yourself; the app shows buttons they tap.
If they ask what you can do: chat and answer anything, GST law and drafting, write and polish messages (send by WhatsApp, SMS or email), turn what they say into tasks, plan the day from their tasks, keep notes and preferences in Memory (say "remember ..." or tap Memory), keep whole documents in their Library (the paperclip in Assist adds a PDF, photo or text file: the bare Act and Rules, notices, orders, circulars) and quote them with document and page, and use both in every answer. The Search tab has the latest news; the Evolve tab takes ideas for Jarvis itself.`

const SCHEMA = {
  type: 'OBJECT',
  required: ['answer', 'tasks'],
  properties: {
    answer: { type: 'STRING', description: 'What you say back, plain text' },
    tasks: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT', required: ['title', 'important'],
        properties: {
          title: { type: 'STRING' },
          date: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD, only if a day was given' },
          important: { type: 'BOOLEAN' },
        },
      },
    },
    message: {
      type: 'OBJECT', nullable: true, required: ['text'],
      properties: {
        text: { type: 'STRING' },
        to: { type: 'STRING', nullable: true, description: 'Phone number or email if the user gave one' },
        subject: { type: 'STRING', nullable: true },
      },
    },
    call: { type: 'STRING', nullable: true, description: 'Phone number to call, only if the user gave one' },
    remember: { type: 'STRING', nullable: true, description: 'A lasting preference or fact worth saving to Memory, in one short sentence' },
  },
}

export default async (req) => {
  const { key, why } = geminiKey()
  if (req.method === 'GET') return json({ ready: !!env('GEMINI_API_KEY') })
  if (why) return json({ error: 'bad_key', why }, 503)
  if (!key) return json({ error: 'not_configured' }, 503)
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)

  // docs: Library documents added in this chat, which count first
  const { turns = [], context = '', docs = [] } = await req.json()
  const recent = turns.slice(-10).filter(t => t.text?.trim())
  if (!recent.length || recent.at(-1).role !== 'user') return json({ error: 'empty' }, 400)

  // Today's date and tasks go in with the latest question only
  const contents = recent.map((t, i) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === recent.length - 1 ? `${context}\n\n${t.text}` : t.text }],
  }))
  // The Library is searched with the question and the one before it, for "and what about…"
  const asked = recent.filter(t => t.role === 'user').slice(-2).map(t => t.text).join('\n')
  const [memory, library] = await Promise.all([memoryFor(user), libraryFor(user, asked, { docs: docs.slice(0, 5) })])
  const res = await askGemini(key, {
    systemInstruction: { parts: [{ text: [SYSTEM, memory, library].filter(Boolean).join('\n\n') }] },
    contents,
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 8192 },
  })
  if (!res || res.status >= 500) return json({ error: 'busy', why: GEMINI_BUSY }, 503)
  if (res.status === 429) return json({ error: 'busy', why: GEMINI_LIMIT }, 429)
  if (!res.ok) {
    const problem = geminiProblem(await res.text())
    return json({ error: problem ? 'bad_key' : 'api', why: problem || `Gemini answered with error ${res.status}. Try again in a minute.` }, 502)
  }
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  try {
    const out = JSON.parse(raw)
    return json({ text: out.answer || 'Here you go.', actions: {
      tasks: out.tasks ?? [], message: out.message ?? null, call: out.call ?? null, remember: out.remember || null,
    } })
  } catch {
    return json({ text: raw || "Sorry, I couldn't answer that one.", actions: null })
  }
}
