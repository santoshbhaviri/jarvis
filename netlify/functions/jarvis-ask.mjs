// The Assist tab: chat with Google Gemini (free tier) inside Jarvis.
// Needs GEMINI_API_KEY in Netlify. Optional GEMINI_MODEL (default gemini-flash-latest).
// The app sends what you said plus today's tasks; the answer can carry tasks to add,
// a message to send or a number to call, which the app shows as buttons.
import { env, json, owner } from '../lib/common.mjs'

const SYSTEM = `You are Jarvis, a personal assistant inside a phone app used by a senior government officer in Telangana, India.
They speak to you by voice, so their words may contain small transcription mistakes; read for meaning.
Answer the way a capable personal secretary would: direct, warm, and short. Lead with the answer. Plain text only: no headings, tables or markdown symbols; a short list with "-" is fine.
When they ask you to write or polish a message, write the finished message in their voice (polite, clear, Indian English) in the answer and also in the message field so they can copy or send it.
When they mention things they need to do, put clean, short task titles in the tasks field (with a date only if they gave one).
When they ask you to call someone and give a number, put it in the call field.
You cannot search the web. For live news, prices or weather, give what you know and say the Search tab has the latest.
You cannot operate their phone, change settings or send anything yourself; the app shows buttons they tap.`

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
  },
}

export default async (req) => {
  const key = env('GEMINI_API_KEY')
  if (req.method === 'GET') return json({ ready: !!key })
  if (!key) return json({ error: 'not_configured' }, 503)
  if (!(await owner(req))) return json({ error: 'not_signed_in' }, 401)

  const { turns = [], context = '' } = await req.json()
  const recent = turns.slice(-10).filter(t => t.text?.trim())
  if (!recent.length || recent.at(-1).role !== 'user') return json({ error: 'empty' }, 400)

  // Today's date and tasks go in with the latest question only
  const contents = recent.map((t, i) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === recent.length - 1 ? `${context}\n\n${t.text}` : t.text }],
  }))
  const model = env('GEMINI_MODEL') || 'gemini-flash-latest'
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 2048 },
    }),
  })
  if (res.status === 429) return json({ error: 'busy' }, 429)
  if (!res.ok) {
    const detail = await res.text()
    return json({ error: /API key|PERMISSION|UNAUTHENTICATED/i.test(detail) ? 'bad_key' : 'api', detail }, 502)
  }
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('') ?? ''
  try {
    const out = JSON.parse(raw)
    return json({ text: out.answer || 'Here you go.', actions: { tasks: out.tasks ?? [], message: out.message ?? null, call: out.call ?? null } })
  } catch {
    return json({ text: raw || "Sorry, I couldn't answer that one.", actions: null })
  }
}
