// Refund Desk: the scrutiny of one claim, for the officer's own analysis. The same lines show on
// the Check screen and go into the scrutiny sheet (a Word file, not an order). Everything here is
// plain code over compute.js: no AI does any arithmetic.
import { CATS, HEADS, HEAD_LABEL, R89_4, PROV_CATS, FIELD, fieldsFor } from './fields.js'
import { inr, ddmmyyyy, monthName, num } from './compute.js'

const money = (x) => x === null || x === undefined ? '—' : inr(x)
const shown = (f, x) => f?.type === 'money' ? `₹${inr(num(x))}` : f?.type === 'date' ? ddmmyyyy(x) || String(x) : f?.type === 'month' ? monthName(x) || String(x) : String(x)

// The working of the formula, one [label, value, red?] per step, for each kind of category
export function workingLines(c, r) {
  const s = r.steps
  const out = []
  const L = (label, value, red) => out.push([label, value, !!red])
  if (c.cat === 'T1') {
    if (!s) return out
    L('(i) A × C ÷ B', inr(s.i, 2)); L('(ii) C ÷ D (not rounded)', s.ratio.toFixed(6)); L('(iii) E × C ÷ D', inr(s.iii, 2))
    L('(iv) Maximum refund', inr(s.maxRefund)); L('(v) Ledger at end of period', money(s.end)); L('(vi) Ledger at filing', money(s.atFiling))
  } else if (R89_4.includes(c.cat)) {
    if (!s) return out
    if ((c.cat === 'T3' || c.cat === 'T4') && s.fromD !== null && s.fromD !== undefined) L('Services: (a) + (b) − (c)', inr(s.fromD))
    if (s.excluded) L('Left out of the numerator (stays in the turnover)', inr(s.excluded), true)
    L('Zero-rated turnover adopted', inr(s.numerator)); L('Adjusted Total Turnover', inr(s.ato)); L('Net ITC', inr(s.net))
    L('Formula (not rounded)', inr(s.formula, 2))
    if (s.asClaimed !== null && s.asClaimed !== undefined) L('The formula on the turnover as claimed', inr(s.asClaimed, 2))
    L('Ledger at end of period', money(s.end)); L('Ledger at filing', money(s.atFiling))
  } else if (c.cat === 'T5' || c.cat === 'T6') {
    if (!s) return out
    L('Tax on the invoices in Table 1', inr(s.rowsTotal))
    for (const x of r.left || []) L(`${x.label}: ${x.why.join('; ')}`, `− ${inr(x.amount)}`, true)
  } else if (c.cat === 'T7') {
    if (!s || !r.heads) return out
    for (const h of HEADS.filter(h => r.heads[h].claimed || s.fromRows[h])) L(`${HEAD_LABEL[h]}: entries in Table 1 / cash balance`, `${inr(s.fromRows[h])} / ${money(s.cash[h])}`)
    for (const x of r.left || []) L(`${x.label}: not refundable`, `− ${inr(x.amount)}`, true)
  } else if (c.cat === 'T8') {
    if (!s || !r.heads) return out
    L('(a) Pre-deposit + (b) other amounts', inr(HEADS.reduce((a, h) => a + r.heads[h].pd + r.heads[h].op, 0)))
    L('(c) Not refundable', inr(HEADS.reduce((a, h) => a + r.heads[h].nr, 0)))
    L('Of the refund: pre-deposit / other amounts', `${inr(r.total.pdRef)} / ${inr(r.total.opRef)}`)
    L('Paid in cash (RFD-05) / re-credit (PMT-03)', `${inr(r.total.cash)} / ${inr(r.total.credit)}`)
    L(`s.115 interest on the pre-deposit, ${s.days ?? '?'} days at ${s.rate}%`, `₹${inr(r.total.interest)}`)
  }
  return out
}

// What to look at, most serious first: the checks that stop the claim, then the warnings, then a
// figure that differs between two documents, then figures the officer corrected
export function points(c, r) {
  const out = []
  const claim = r.flags.filter(f => f.law !== 'rule 92(3)')   // the notice and hearing belong to the draft, not the scrutiny
  for (const f of claim.filter(f => f.level === 'stop')) out.push({ level: 'stop', text: f.text, law: f.law })
  for (const f of claim.filter(f => f.level === 'warn')) out.push({ level: 'warn', text: f.text, law: f.law })
  for (const [key, alts] of Object.entries(c.alt || {})) {
    const f = FIELD[key]
    if (!f || !alts?.length) continue
    out.push({ level: 'warn', key, text: `${f.label}: ${shown(f, c.v[key])} in ${c.src[key] || 'the case'}, but ${alts.map(a => `${shown(f, a.value)} in ${a.src}`).join('; ')}.`, law: 'documents differ' })
  }
  for (const [key, was] of Object.entries(c.edited || {})) {
    const f = FIELD[key]
    if (!f || !was) continue
    out.push({ level: 'ok', text: `${f.label} corrected to ${shown(f, c.v[key])} (${shown(f, was.value)} was read from ${was.src}).`, law: 'your correction' })
  }
  return out
}

// The scrutiny sheet: for the file, never issued to the applicant
export function buildScrutiny(c, r) {
  const v = c.v
  const period = v.from ? `${monthName(v.from)}${v.to && v.to !== v.from ? ` to ${monthName(v.to)}` : ''}` : '—'
  const blocks = [
    { t: 'title', lines: ['SCRUTINY SHEET (for office use only)', `${CATS[c.cat].label} · ${CATS[c.cat].law}`] },
    { t: 'table', head: ['Particulars', 'Details'], rows: [
      ['ARN', v.arn || '—'], ['Filed on', ddmmyyyy(v.filed) || '—'], ['Period', period],
      ['Claimed', `₹${inr(r.total?.claimed)}`], ['Admissible on the working', `₹${inr(r.total?.admissible)}`],
      ['Difference (to be rejected)', `₹${inr(r.total?.rejected)}`],
      ...(r.total?.excess ? [['Provisional refund paid in excess', `₹${inr(r.total.excess)}`]] : []),
      ...(r.sixty ? [['Sixty days end', ddmmyyyy(r.sixty)]] : []),
    ] },
  ]
  const lines = workingLines(c, r)
  if (lines.length) blocks.push({ t: 'h', text: 'Working' }, { t: 'table', head: ['Step', 'Amount'], rows: lines.map(([l, x]) => [l, x]) })
  if (r.heads) {
    const hs = HEADS.filter(h => h !== 'cess' || r.heads.cess.claimed)
    const cols = [['claimed', 'Claimed'], ['admissible', 'Admissible'], ...(PROV_CATS.includes(c.cat) ? [['prov', 'Provisional']] : []), ['rejected', 'Rejected']]
    blocks.push({ t: 'h', text: 'Head-wise' }, { t: 'table', head: ['Head', ...cols.map(x => x[1])], rows: hs.map(h => [HEAD_LABEL[h], ...cols.map(([k]) => inr(r.heads[h][k]))]) })
  }
  if (r.limitation?.length) blocks.push({ t: 'h', text: 'Limitation (two years)' }, { t: 'list', items: r.limitation.map(m => `${m.label}: until ${m.ends ? ddmmyyyy(m.ends) : '?'}${m.inTime === false ? ' (late)' : ''}`) })
  const pts = points(c, r)
  blocks.push({ t: 'h', text: 'Points noticed and corrections' })
  blocks.push(pts.length
    ? { t: 'list', items: pts.map(p => `${p.level === 'stop' ? '**Must be settled:** ' : p.level === 'warn' ? '**Check:** ' : ''}${p.text}${p.law ? ` (${p.law})` : ''}`) }
    : { t: 'p', text: 'No mistakes found on the figures read.' })
  const facts = fieldsFor(c.cat).filter(f => v[f.key] !== undefined && v[f.key] !== null && v[f.key] !== '' && c.src[f.key])
  if (facts.length) blocks.push({ t: 'h', text: 'Figures and where they came from' }, { t: 'table', head: ['Figure', 'Value', 'Source'], rows: facts.map(f => [f.label, shown(f, v[f.key]), c.src[f.key]]) })
  return blocks
}
