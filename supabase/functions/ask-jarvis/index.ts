// supabase/functions/ask-jarvis/index.ts
// "Ask Jarvis": the app sends what you said (plus today's tasks) and Claude answers.
// Claude can search the web, and can suggest tasks to add or a message to send.
// Deploy:  supabase functions deploy ask-jarvis
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (!Deno.env.get('ANTHROPIC_API_KEY')) return json({ error: 'not_configured' }, 503)

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
