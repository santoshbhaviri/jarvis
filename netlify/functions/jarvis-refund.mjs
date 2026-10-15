// Refund Desk (see src/components/RefundTab.jsx). Only your login can use it, and only Claude
// answers: refund documents carry GSTINs and business figures, so they never go to the free
// Gemini key. Nothing sent here is kept: no document, figure or draft is stored on the server.
//   POST { action: 'extract', name, pages: [{ p, t }] }
//        → Claude reads one document's text into the fields of fields.js, each with its page
//          → { kind, fields: [{ key, value, page, quote }], inputs, outputs }
//   POST { action: 'polish', facts, ground, reply, verified, finding }
//        → the officer's own finding on one ground, written up as an order paragraph → { para }
// Claude only reads and writes. The rule 89(5) arithmetic and the checks are plain code in
// src/lib/refund/compute.js, and the officer decides every figure and every ground.
import { json, owner } from '../lib/common.mjs'
import { askAI, claudeKey } from '../lib/ai.mjs'
import { FIELDS, INPUT_TYPES, OUTPUT_COLS } from '../../src/lib/refund/fields.js'

const MAX_CHARS = 150000   // about 40 pages of a statement; more is cut, and the screen says so

const READ = `You read the documents of a GST refund application for a CGST officer in India. The claim is for refund of unutilised input tax credit on account of inverted duty structure (section 54(3)(ii) of the CGST Act, rule 89(5) of the CGST Rules).
You get the text of ONE document (RFD-01 and its statements, Annexure-B / Statement 1A, GSTR-1, GSTR-3B, GSTR-2B, the electronic credit ledger, RFD-02, RFD-04, invoices, or a letter). Copy out what it states. Never calculate, total or infer a figure that is not written in the document: the officer's software does all arithmetic. If a field is not in this document, leave it out.

For each field you find, give:
- key: one of the field keys listed below;
- value: exactly as stated. Amounts in rupees as plain digits with an optional decimal point (no commas, no ₹). Rates in per cent as a number. Dates as YYYY-MM-DD. Months as YYYY-MM. Text as written;
- page: the page number it is on;
- quote: the few words around it in the document, so the officer can find it.

Fields (key: what it is):
${FIELDS.map(f => `${f.key}: ${f.read}${f.options ? ` (one of: ${f.options.join(', ')})` : ''}`).join('\n')}

Where the document has rate-wise or invoice-wise details, also fill:
- inputs: rows of inward supplies by HSN and rate (kind is one of: ${INPUT_TYPES.join(', ')});
- outputs: rows of outward supplies by HSN and rate (inverted is "yes" if the rate is lower than the input rate, else one of the listed reasons).
Summarise many invoices into rate-wise rows only when the document itself gives the totals; otherwise leave the tables empty.
kind: what this document is, in a few words (for example "RFD-01 Statement 1", "GSTR-3B July 2026").`

const orNull = (t) => ({ anyOf: [{ type: t }, { type: 'null' }] })
const row = (cols) => ({
  type: 'object', additionalProperties: false, required: cols.map(c => c.key),
  properties: Object.fromEntries(cols.map(c => [c.key, c.type === 'choice' ? { anyOf: [{ type: 'string', enum: c.options }, { type: 'null' }] } : orNull('string')])),
})
const SCHEMA = {
  type: 'object', additionalProperties: false, required: ['kind', 'fields', 'inputs', 'outputs'],
  properties: {
    kind: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['key', 'value', 'page', 'quote'],
        properties: {
          key: { type: 'string', enum: FIELDS.map(f => f.key) },
          value: { type: 'string' },
          page: orNull('integer'),
          quote: { type: 'string' },
        },
      },
    },
    inputs: { type: 'array', items: row([{ key: 'hsn' }, { key: 'desc' }, { key: 'rate' }, { key: 'value' }, { key: 'itc' }, { key: 'kind', type: 'choice', options: INPUT_TYPES }]) },
    outputs: { type: 'array', items: row(OUTPUT_COLS) },
  },
}

const POLISH = `You draft one finding paragraph of a refund order (FORM GST RFD-06 speaking order) for an Assistant Commissioner of Central Tax in India, in formal Indian English as written in CGST orders.
The officer has decided the ground. Write up THEIR finding: never change the outcome, the figures or the provision they rely on, and add no new ground, fact or figure. Do not cite a case, notification or circular that the officer did not give, except these, which you may cite where they plainly apply: rule 89(5) and rule 92(3) of the CGST Rules; section 54(3), 16(2), 16(4) and 17(5) of the CGST Act; Circular 125/44/2019-GST; Circular 135/05/2020-GST as substituted by Circular 173/05/2022-GST; para 1.3 of Circular 197/09/2023-GST.
Structure: what the notice said, what the applicant replied, what was verified and against which record, the finding with the reason and the provision, and the effect on the refund. Answer every point of the reply. Capital goods credit is "not part of Net ITC under rule 89(5)", never "ineligible". Credit availed in the period on an earlier invoice is admissible if in GSTR-2B of the period or an earlier period. No names of persons; say "the authorised representative". Plain text, one paragraph, no heading, no paragraph number.`

export default async (req) => {
  const user = await owner(req)
  if (!user) return json({ error: 'not_signed_in' }, 401)
  const url = new URL(req.url)
  if (req.method === 'GET' && url.searchParams.has('ping')) return json({ ready: !!(await claudeKey()).key })
  if (req.method !== 'POST') return json({ error: 'bad_request' }, 400)
  const body = await req.json().catch(() => ({}))

  if (body.action === 'extract') {
    let text = '', cut = false
    for (const pg of Array.isArray(body.pages) ? body.pages : []) {
      const add = `\n\n--- Page ${Number(pg.p) || '?'} ---\n${String(pg.t || '')}`
      if (text.length + add.length > MAX_CHARS) { cut = true; break }
      text += add
    }
    if (!text.trim()) return json({ error: 'empty', why: 'No text was found in this document.' }, 400)
    const out = await askAI({
      system: READ, claudeOnly: true, schema: SCHEMA, model: 'smart', effort: 'low', maxTokens: 6000,
      turns: [{ role: 'user', text: `Document: ${String(body.name || 'Document').slice(0, 120)}${text}` }],
      until: Date.now() + 25000,
    })
    if (out.error) return json({ error: out.error, why: out.error === 'not_configured' ? 'The Refund Desk needs Claude connected (Evolve, Check setup).' : out.why }, out.status || 502)
    return json({ ...out.json, cut: cut || !!out.cut })
  }

  if (body.action === 'polish') {
    const s = (k) => String(body[k] || '').slice(0, 4000)
    if (!s('finding').trim()) return json({ error: 'empty', why: 'Write your finding first.' }, 400)
    const out = await askAI({
      system: POLISH, claudeOnly: true, model: 'smart', effort: 'medium', maxTokens: 1500,
      turns: [{ role: 'user', text: `Case: ${s('facts')}\n\nGround in the notice: ${s('ground')}\n\nApplicant's reply: ${s('reply') || 'none'}\n\nWhat was verified: ${s('verified') || 'not stated'}\n\nThe officer's finding: ${s('finding')}` }],
      until: Date.now() + 24000,
    })
    if (out.error) return json({ error: out.error, why: out.why }, out.status || 502)
    return json({ para: out.text, cut: !!out.cut })
  }

  return json({ error: 'bad_request' }, 400)
}
