// Refund Desk (see src/components/RefundTab.jsx). Only your login can use it, and only Claude
// answers: refund documents carry GSTINs and business figures, so they never go to the free
// Gemini key. Nothing sent here is kept: no document, figure or draft is stored on the server.
//   POST { action: 'extract', cat, name, pages: [{ p, t }] }
//        → Claude reads one document's text into the fields and tables of fields.js for that
//          refund category (T1 to T8), each figure with its page
//          → { kind, fields: [{ key, value, page, quote }], rows: { tableKey: [...] } }
//   POST { action: 'polish', facts, ground, reply, verified, finding }
//        → the officer's own finding on one ground, written up as an order paragraph → { para }
// Claude only reads and writes. The arithmetic and the checks are plain code in
// src/lib/refund/compute.js, and the officer decides every figure and every ground.
import { json, owner } from '../lib/common.mjs'
import { askAI, claudeKey } from '../lib/ai.mjs'
import { CATS, fieldsFor, tablesFor } from '../../src/lib/refund/fields.js'

const MAX_CHARS = 150000   // about 40 pages of a statement; more is cut, and the screen says so

// What each category's claim is, and which documents usually come with it
const ABOUT = {
  T1: 'refund of unutilised input tax credit on account of inverted duty structure (section 54(3)(ii) of the CGST Act, rule 89(5)). Documents: RFD-01 with Statement 1 and Annexure-B / Statement 1A, GSTR-1, GSTR-3B, GSTR-2B, the electronic credit ledger, RFD-02, RFD-04',
  T2: 'refund of unutilised input tax credit on export of goods without payment of tax under a Letter of Undertaking (section 54(3)(i), section 16(3) of the IGST Act, rule 89(4)). Documents: RFD-01 with Statement 3 and 3A, shipping bills and EGM details from ICEGATE, export invoices, the LUT, GSTR-1 Table 6A, GSTR-3B, GSTR-2B, the electronic credit ledger, RFD-02, RFD-04',
  T3: 'refund of unutilised input tax credit on export of services without payment of tax under a Letter of Undertaking (section 54(3)(i), section 16(3) of the IGST Act, rule 89(4)). Documents: RFD-01 with Statement 3 and 3A, export invoices, FIRCs / e-BRCs, agreements, the LUT, GSTR-1, GSTR-3B, GSTR-2B, the electronic credit ledger, RFD-02, RFD-04',
  T4: 'refund of unutilised input tax credit on supplies to an SEZ unit or developer without payment of tax under a Letter of Undertaking (section 54(3)(i), sections 16(1)(b) and 16(3) of the IGST Act, rule 89(4)). Documents: RFD-01 with Statement 5 and 5A, invoices endorsed by the specified officer of the SEZ, the Letter of Approval, the LUT, GSTR-1 Table 6B, GSTR-3B, GSTR-2B, the electronic credit ledger, RFD-02, RFD-04',
  T5: 'refund of integrated tax paid on export of services (section 54(1), section 16(4) of the IGST Act). Documents: RFD-01 with Statement 2, export invoices, FIRCs / e-BRCs, GSTR-1 Table 6A, GSTR-3B, RFD-02, RFD-04',
  T6: 'refund of integrated tax paid on supplies to an SEZ unit or developer (section 54(1), sections 16(1)(b) and 16(4) of the IGST Act). Documents: RFD-01 with Statement 4, invoices endorsed by the specified officer of the SEZ, the Letter of Approval, the declaration under rule 89(2)(f), the unjust enrichment declaration or CA / CMA certificate, GSTR-1 Table 6B, GSTR-3B, RFD-02, RFD-04',
  T7: 'refund of excess balance in the electronic cash ledger (section 49(6) and the proviso to section 54(1)). Documents: RFD-01, the electronic cash ledger, challans (CPIN / CIN), TDS / TCS credit statements, GSTR-3B',
  T8: 'refund of pre-deposit or of tax paid, after an order of the Appellate Authority or Tribunal (section 54(1), section 54(8)(e), section 115). Documents: RFD-01, the order-in-original, APL-01, the pre-deposit and DRC-03 payment entries, the Electronic Liability Register Part II, the appellate order, the unjust enrichment declaration or CA / CMA certificate',
}

const describe = (f) => `${f.key}: ${f.read || f.label}${f.options ? ` (one of: ${f.options.join(', ')})` : ''}`

export function readPrompt(cat) {
  const tables = tablesFor(cat)
  return `You read the documents of a GST refund application for a CGST officer in India. The claim is for ${ABOUT[cat]}.
You get the text of ONE document. Copy out what it states. Never calculate, total or infer a figure that is not written in the document: the officer's software does all arithmetic. If a field is not in this document, leave it out.

For each field you find, give:
- key: one of the field keys listed below;
- value: exactly as stated. Amounts in rupees as plain digits with an optional decimal point (no commas, no ₹). Rates in per cent as a number. Dates as YYYY-MM-DD. Months as YYYY-MM. Text as written;
- page: the page number it is on;
- quote: the few words around it in the document, so the officer can find it.

Fields (key: what it is):
${fieldsFor(cat).map(describe).join('\n')}
${tables.length ? `
Where the document lists them line by line, also fill these tables in rows, one row per line of the document, in the same formats (amounts as digits, dates as YYYY-MM-DD; a column the document does not give is null):
${tables.map(t => `- ${t.key} (${t.label}): ${t.cols.map(describe).join('; ')}`).join('\n')}
Copy rows; do not merge or total them. Leave a table empty if the document does not list its lines.` : ''}
kind: what this document is, in a few words (for example "RFD-01 Statement 3", "GSTR-3B July 2026").`
}

const orNull = (t) => ({ anyOf: [{ type: t }, { type: 'null' }] })
const row = (cols) => ({
  type: 'object', additionalProperties: false, required: cols.map(c => c.key),
  properties: Object.fromEntries(cols.map(c => [c.key, c.type === 'choice' ? { anyOf: [{ type: 'string', enum: c.options }, { type: 'null' }] } : orNull('string')])),
})
export function schemaFor(cat) {
  const tables = tablesFor(cat)
  return {
    type: 'object', additionalProperties: false, required: ['kind', 'fields', ...(tables.length ? ['rows'] : [])],
    properties: {
      kind: { type: 'string' },
      fields: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false, required: ['key', 'value', 'page', 'quote'],
          properties: {
            key: { type: 'string', enum: fieldsFor(cat).map(f => f.key) },
            value: { type: 'string' },
            page: orNull('integer'),
            quote: { type: 'string' },
          },
        },
      },
      ...(tables.length && { rows: {
        type: 'object', additionalProperties: false, required: tables.map(t => t.key),
        properties: Object.fromEntries(tables.map(t => [t.key, { type: 'array', items: row(t.cols) }])),
      } }),
    },
  }
}

const POLISH = `You draft one finding paragraph of a refund order (FORM GST RFD-06 speaking order) for an Assistant Commissioner of Central Tax in India, in formal Indian English as written in CGST orders.
The officer has decided the ground. Write up THEIR finding: never change the outcome, the figures or the provision they rely on, and add no new ground, fact or figure. Do not cite a case, notification or circular that the officer did not give, except these, which you may cite where they plainly apply: rules 89, 92(3), 93, 96A and 96B of the CGST Rules; sections 49(6), 54, 16(2), 16(4), 17(5) and 115 of the CGST Act; sections 2(6), 13 and 16 of the IGST Act; Circulars 125/44/2019-GST, 135/05/2020-GST (as substituted by 173/05/2022-GST), 147/03/2021-GST, 159/15/2021-GST, 161/17/2021-GST, 166/22/2021-GST and 197/09/2023-GST.
Structure: what the notice said, what the applicant replied, what was verified and against which record, the finding with the reason and the provision, and the effect on the refund. Answer every point of the reply. Capital goods credit is "not part of Net ITC under rule 89(5)", never "ineligible" (for inverted duty claims). Credit availed in the period on an earlier invoice is admissible if in GSTR-2B of the period or an earlier period. No names of persons; say "the authorised representative". Plain text, one paragraph, no heading, no paragraph number.`

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
    const cat = CATS[body.cat] ? body.cat : 'T1'
    const out = await askAI({
      system: readPrompt(cat), claudeOnly: true, schema: schemaFor(cat), model: 'smart', effort: 'low', maxTokens: 6000,
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
