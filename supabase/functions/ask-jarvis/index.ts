// supabase/functions/ask-jarvis/index.ts
// "Ask Jarvis": the app sends what you said (plus today's tasks) and an AI answers,
// suggesting tasks to add or a message to send when that helps.
//   Free:  Google Gemini. Secret GEMINI_API_KEY (free key from aistudio.google.com).
//          Optional GEMINI_MODEL to pick a model (default gemini-flash-latest).
//   Paid:  Claude with web search. Secret ANTHROPIC_API_KEY. Used only when there is no Gemini key.
// Deploy:  supabase functions deploy ask-jarvis
// Only signed-in Jarvis users can call it (Supabase checks the login token).
import Anthropic from 'npm:@anthropic-ai/sdk@0.133.0'
import { createClient } from 'npm:@supabase/supabase-js@2.43.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') })

const SYSTEM = `You are Jarvis, a personal assistant inside a phone app used by a senior government officer in Telangana, India.
They speak to you by voice, so their words may contain small transcription mistakes; read for meaning.
Answer the way a capable personal secretary would: direct, warm, and short. Lead with the answer. Plain text only: no headings, tables or markdown symbols; a short list with "-" is fine.
Use web search when the question needs current or factual information you are not sure of, and mention the source name briefly.
When they ask you to write or polish a message, write the finished message in their voice (polite, clear, Indian English) and also pass it to the suggest tool so they can copy or send it.
When they mention things they need to do, pass clean, short task titles to the suggest tool (with a date only if they gave one).
When they ask you to call someone and give a number, pass it to the suggest tool.
You cannot operate their phone, change settings or send anything yourself; the app shows buttons they tap.`

// Optional, at most once per answer: things the app turns into buttons
const suggestTool: Anthropic.Beta.BetaTool = {
  name: 'suggest',
  description: 'Offer tasks to add, a message draft to send, or a phone number to call. The app shows these as buttons under your answer. Write your spoken answer as text before calling this.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['tasks', 'message', 'call'],
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['title', 'date', 'important'],
          properties: {
            title: { type: 'string' },
            date: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
            important: { type: 'boolean' },
          },
        },
      },
      message: {
        anyOf: [{ type: 'null' }, {
          type: 'object', additionalProperties: false, required: ['text', 'channel', 'to', 'subject'],
          properties: {
            text: { type: 'string' },
            channel: { type: 'string', enum: ['whatsapp', 'sms', 'email', 'any'] },
            to: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Phone number or email if the user gave one' },
            subject: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
        }],
      },
      call: { anyOf: [{ type: 'string' }, { type: 'null' }], description: 'Phone number to call, only if the user gave one' },
    },
  },
}

type Turn = { role: 'user' | 'assistant'; text: string }

// ── Google Gemini (free tier) ──────────────────────────────────
const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY')
const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

const geminiSchema = {
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
          date: { type: 'STRING', format: 'date', nullable: true, description: 'YYYY-MM-DD, only if a day was given' },
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

async function askGemini(recent: Turn[], context: string) {
  const contents = recent.map((t, i) => ({
    role: t.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: i === recent.length - 1 ? `${context}\n\n${t.text}` : t.text }],
  }))
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM.replace(/Use web search[^\n]*\n/, '').replace(/the suggest tool/g, 'its own field') +
        '\nYou cannot search the web. For live news, prices or weather, give what you know and say the "Search Google" link under your answer has the latest.' }] },
      contents,
      generationConfig: { responseMimeType: 'application/json', responseSchema: geminiSchema, maxOutputTokens: 2048 },
    }),
  })
  if (res.status === 429) return json({ error: 'busy' }, 429)
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    const detail = await res.text()
    return json({ error: /API key|PERMISSION|UNAUTHENTICATED/i.test(detail) ? 'bad_key' : 'api', detail }, 502)
  }
  if (!res.ok) return json({ error: 'api', detail: await res.text() }, 502)
  const data = await res.json()
  const raw = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? '').join('') ?? ''
  try {
    const out = JSON.parse(raw)
    const actions = { tasks: out.tasks ?? [], message: out.message ?? null, call: out.call ?? null }
    return json({ text: out.answer || 'Here you go.', actions })
  } catch {
    return json({ text: raw || "Sorry, I couldn't answer that one.", actions: null })
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!GEMINI_KEY && !Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'not_configured' }, 503)

  // Must be a signed-in Jarvis user
  const auth = req.headers.get('Authorization') ?? ''
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return json({ error: 'not_signed_in' }, 401)

  const { turns = [], context = '' } = await req.json() as { turns: Turn[]; context?: string }
  const recent = turns.slice(-10).filter(t => t.text?.trim())
  if (!recent.length || recent[recent.length - 1].role !== 'user') return json({ error: 'empty' }, 400)

  if (GEMINI_KEY) {
    try { return await askGemini(recent, context) } catch (err) { return json({ error: 'failed', detail: String(err) }, 500) }
  }

  const messages: Anthropic.Beta.BetaMessageParam[] = recent.map(t => ({ role: t.role, content: t.text }))
  // Today's date and task list go in with the latest question only
  const last = messages[messages.length - 1]
  last.content = `${context}\n\n${recent[recent.length - 1].text}`

  try {
    let response: Anthropic.Beta.BetaMessage | null = null
    for (let i = 0; i < 4; i++) {
      response = await client.beta.messages.create({
        model: 'claude-opus-5-5',
        max_tokens: 16000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        system: SYSTEM,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', country: 'IN', region: 'Telangana', timezone: 'Asia/Kolkata' } }, suggestTool],
        messages,
      })
      // A long web search can pause; send the turn back to let it finish
      if (response.stop_reason !== 'pause_turn') break
      messages.push({ role: 'assistant', content: response.content })
    }
    if (!response) return json({ error: 'no_answer' }, 502)
    if (response.stop_reason === 'refusal') {
      return json({ text: "Sorry, I can't help with that one.", actions: null })
    }

    const text = response.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
      .map(b => b.text).join('').trim()
    const suggest = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === 'suggest',
    )
    return json({ text: text || (suggest ? 'Here you go.' : ''), actions: suggest?.input ?? null })
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) return json({ error: 'busy' }, 429)
    if (err instanceof Anthropic.AuthenticationError) return json({ error: 'bad_key' }, 503)
    if (err instanceof Anthropic.APIError) return json({ error: 'api', detail: err.message }, 502)
    return json({ error: 'failed', detail: String(err) }, 500)
  }
})
