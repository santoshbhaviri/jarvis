// Refund Desk: the show cause notice for rejection of a refund, FORM GST RFD-08 (rule 92(3)), ported
// from template N1 (gst-orders/templates/source/src/N1-rfd08-notice.md). The notice itself is
// generated on the portal; this is the annexure that states the grounds, for any category T1 to T8.
// Para 4 carries Variant A (rejection) whenever anything is proposed for rejection, and Variant C
// (recovery of an excess provisional refund, with a DRC-01 summary) when the provisional refund paid
// is more than the amount now found admissible. Variant B (demand of ineligible ITC under section
// 73 / 74 / 74A) needs a finding the case does not record, so it is not drafted here.
// The blocks are the same as an order's (order-kit.js); word.js makes the Word file, called with
// { title: 'Notice (RFD-08)' }.
import { kit, blank, or, date, rs, headsText, num, inr, OFFICE, HEADS, HEAD_LABEL } from './order-kit.js'
import { CATS, R89_4, PROV_CATS } from './fields.js'
import { ddmmyyyy } from './compute.js'

export { OFFICE }

// Date arithmetic on YYYY-MM-DD, as plain calendar days
const plusDays = (s, n) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10) : ''
}
export const replyDue = (noticeDate) => plusDays(noticeDate, 15)

// The provision under which the refund is claimed (para 1.1) and the one read with rule 92(3) (para 4.1)
const CLAIMED_UNDER = {
  T1: 'section 54(3)(ii)', T2: 'section 54(3)(i)', T3: 'section 54(3)(i)', T4: 'section 54(3)(i)',
  T5: 'section 54(1)', T6: 'section 54(1)', T7: 'section 49(6)', T8: 'section 54(1)',
}
const READ_WITH = {
  T1: 'section 54(3) and rule 89(5)', T2: 'section 54(3) and rule 89(4)', T3: 'section 54(3) and rule 89(4)', T4: 'section 54(3) and rule 89(4)',
  T5: 'section 54(1)', T6: 'section 54(1)', T7: 'section 54(1) and section 49(6)', T8: 'section 54(1)',
}
// Recovery provisions by the section chosen for the excess provisional refund
const SEC = { '73': { show: '73(1)', pen: '73(9)', pay: '73(8)' }, '74': { show: '74(1)', pen: '74(9)', pay: '74(8)' }, '74A': { show: '74A(1)', pen: '74A(5)', pay: '74A(8) or 74A(9)' } }

// compute() gives no heads when the figures are not yet complete: the notice is still drafted
function withHeads(c, r) {
  if (r.heads) return r
  const v = c.v || {}
  const heads = Object.fromEntries(HEADS.map(h => {
    const claimed = num(v[`claimed_${h}`]) || 0, prov = PROV_CATS.includes(c.cat) ? num(v[`prov_${h}`]) || 0 : 0
    return [h, { claimed, admissible: 0, rejected: 0, prov, adj: 0, net: 0, excess: 0, notPaid: 0 }]
  }))
  const total = Object.fromEntries(['claimed', 'admissible', 'rejected', 'prov', 'adj', 'net', 'excess', 'notPaid'].map(k => [k, HEADS.reduce((a, h) => a + heads[h][k], 0)]))
  return { ...r, heads, total, unknown: true }
}

const amountOf = (g) => num(g.amount) || 0

export function buildNotice(c, r0, office = OFFICE) {
  const r = withHeads(c, r0)
  const k = kit(c, r, office)
  const { v, T, H, n, B, name } = k
  const cat = CATS[c.cat] ? c.cat : 'T1'
  const shown = k.shownHeads
  const grounds = k.grounds
  const proposed = grounds.reduce((a, g) => a + amountOf(g), 0)
  const rejecting = proposed > 0 || T.rejected > 0
  const excess = T.excess > 0
  const recovery = excess || !!String(n.drc01 || '').trim()
  const secKey = String(n.recovery_sec || '').trim().replace(/\(.*$/, '').toUpperCase()
  const sec = SEC[secKey]
  const recSec = sec ? sec.show : or(n.recovery_sec, '73(1) / 74(1) / 74A(1)')
  const recSecShort = or(n.recovery_sec, '73 / 74 / 74A')
  const matches = proposed > 0 && Math.abs(proposed - T.rejected) < 1
  const period = cat === 'T7' ? `balance as on ${date(v.balance_on)}`
    : cat === 'T8' ? `refund consequent on ${or(v.ao, 'appellate order No. and date')}`
    : (k.period || blank('period'))

  // Head-wise effect of one ground, where it can be known: the claim is under one head only, or a
  // single ground carries the whole of the amount found inadmissible
  const claimedHeads = HEADS.filter(h => H[h].claimed > 0)
  const splitOf = (amount) => {
    if (claimedHeads.length === 1) return Object.fromEntries(HEADS.map(h => [h, h === claimedHeads[0] ? amount : 0]))
    if (grounds.length === 1 && Math.abs(amount - T.rejected) < 1 && T.rejected > 0) return k.rejH
    return null
  }
  const totalSplit = claimedHeads.length === 1 ? splitOf(proposed) : matches ? k.rejH : null
  const headsOrBlanks = (o) => o ? headsText(o, shown) : shown.map(h => `${HEAD_LABEL[h]} ₹${blank()}`).join(', ')

  // ── Letterhead, title and particulars ──
  B.push({ t: 'letterhead' })
  B.push({ t: 'title', lines: ['FORM GST RFD-08 [See rule 92(3)]', 'NOTICE FOR REJECTION OF APPLICATION FOR REFUND: ANNEXURE STATING THE GROUNDS'] })
  const due = replyDue(n.date)
  k.table(['Particulars', 'Details'], [
    ['Notice No. and date', `${or(n.no, 'Notice No.')} dated ${date(n.date)}`],
    ['Reference No. (RFN)', `${or(n.rfn, 'RFN generated on the portal')} (a DIN is not required on a portal communication bearing an RFN: Circular No. 249/06/2025-GST)`],
    ['To', `${name}${v.trade_name ? ` (${v.trade_name})` : ''}, GSTIN ${or(v.gstin, 'GSTIN')}, ${or(v.address, 'address')}`],
    ['ARN and date of the refund application', `${or(v.arn, 'ARN')} dated ${date(v.filed)}`],
    ['Category and period', `${CATS[cat].label}; ${period}`],
    ['Amount claimed', `${shown.map(h => `${HEAD_LABEL[h]} ${rs(H[h].claimed)}`).join('; ')}; Total ${rs(T.claimed)}`],
    ['Amount proposed for rejection', proposed > 0
      ? `${rs(proposed)}${totalSplit ? ` (${headsText(totalSplit, shown, true)})` : ''} (head-wise in para 3)`
      : `₹${blank('amount proposed for rejection')} (head-wise in para 3)`],
    ...(recovery ? [['Amount proposed for recovery', `${excess ? rs(T.excess) : `₹${blank('amount proposed for recovery')}`} under section 54 read with section ${recSecShort}; DRC-01 summary reference ${or(n.drc01, 'DRC-01 reference')}`]] : []),
    ['Provisional refund already paid (RFD-04 / RFD-05)', k.prov
      ? `${rs(T.prov)}, RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)}, RFD-05 dated ${date(v.rfd05_date)}`
      : 'Nil'],
    ['Date by which the reply is due', `Within fifteen days of receipt of this notice${due ? ` (by ${ddmmyyyy(due)}, where it is received on the date of issue)` : ''}`],
    ['Personal hearing', `${date(n.hearing)} at ${or(n.time, 'time')}, at ${blank(`this office, ${office.address} / by video conference, link to be sent to the registered e-mail`)}`],
  ])

  // ── 1. The application ──
  k.h('1. The application')
  let prov = ''
  if (k.prov) prov = ` Provisional refund of ${rs(T.prov)} was sanctioned by RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)} and paid by RFD-05 dated ${date(v.rfd05_date)}.`
  else if (PROV_CATS.includes(cat)) {
    if (v.risk === 'not low-risk') prov = ' Provisional refund was not sanctioned because the system did not categorise the claim as "low-risk".'
    else prov = ` Provisional refund was not sanctioned because ${blank('reason')}.`
  }
  k.p(`1.1 You filed the above application for refund of ${rs(T.claimed)} (${headsText(k.claimedH, shown)}) under ${CLAIMED_UNDER[cat]} for ${period}. It was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.${prov}`)

  // ── 2. Grounds ──
  k.h('2. Grounds on which part of the claim appears inadmissible')
  k.p('2.1 On scrutiny of the application, the documents filed and the records available to this office, the following have been noticed:')
  const list = grounds.length ? grounds : [{ title: '', text: '' }]
  list.forEach((g, i) => {
    k.p(`**Ground ${i + 1}: ${or(g.title, 'short title')}**`)
    k.p(`2.${i + 2} ${or(g.text, 'facts found, with the documents and figures, the amount, and the provision of law that makes this inadmissible')}`)
  })

  // ── 3. Amount proposed for rejection ──
  k.h('3. Amount proposed for rejection')
  const affectedOf = (g) => {
    if (num(g.affected) !== null) return inr(num(g.affected))
    if (!['T1', ...R89_4].includes(cat)) return amountOf(g) ? inr(amountOf(g)) : blank()
    if (R89_4.includes(cat) && grounds.length === 1 && r.steps?.excluded > 0) return inr(r.steps.excluded)
    return blank('ITC / turnover affected')
  }
  const cells = (o) => shown.map(h => o ? inr(o[h] || 0) : blank())
  k.table(['Ground', 'ITC / turnover / tax affected (₹)', ...shown.map(h => `Effect on refund: ${HEAD_LABEL[h]} (₹)`), 'Total (₹)'], [
    ...list.map((g, i) => [String(i + 1), affectedOf(g), ...cells(amountOf(g) ? splitOf(amountOf(g)) : null), amountOf(g) ? inr(amountOf(g)) : blank()]),
    ['**Total**', '', ...shown.map(h => totalSplit ? `**${inr(totalSplit[h] || 0)}**` : blank()), proposed ? `**${inr(proposed)}**` : blank()],
  ])

  // ── 4. Show cause ──
  k.h('4. You are required to show cause')
  if (rejecting) {
    k.p(`4.1 You are required to show cause, by a reply in FORM GST RFD-09 on the common portal within fifteen days of receipt of this notice, why refund of **${proposed ? rs(proposed) : `₹${blank()}`}** (${headsOrBlanks(totalSplit)}) out of the amount claimed should not be rejected under rule 92(3) of the CGST Rules, read with ${READ_WITH[cat]}, for the grounds stated in para 2.`)
  }
  if (excess) {
    const pen = String(n.penalty || '').trim() ? ` and penalty under section ${sec ? sec.pen : blank('73(9) / 74(9) / 74A(5)')}` : ''
    k.p(`${rejecting ? '4.1A You are also required to show cause' : '4.1 You are required to show cause, by a reply in FORM GST RFD-09 on the common portal within fifteen days of receipt of this notice,'} why refund of **${rs(T.excess)}** (${headsText(k.excessH, shown)}), being the amount by which the provisional refund sanctioned by RFD-04 dated ${date(v.rfd04_date)} exceeds the amount now found admissible, should not be recovered from you as refund erroneously made, under section 54 read with section ${recSec}, with interest under section 50${pen}.`)
  }
  if (recovery) {
    const payPen = String(n.penalty || '').trim() ? ` and the penalty payable under section ${sec ? sec.pay : blank('73(8) / 74(8) / 74A(8) or 74A(9)')}` : ''
    k.p(`4.2 A summary of this notice in FORM GST DRC-01${String(n.drc01 || '').trim() ? ` (reference ${n.drc01.trim()})` : ''} is issued with it under rule 142(1)(a). You may pay the amount demanded (the excess provisional refund), with interest${payPen}, through FORM GST DRC-03 within the time allowed in that section, and inform this office; in that case the proceedings for that amount will be concluded as provided in that section.`)
  }
  if (!rejecting && !excess) k.p(`4.1 ${blank('amount proposed for rejection: add the grounds with their amounts')}`)

  // ── 5. Documents relied on ──
  k.h('5. Documents relied on')
  const relied = String(n.relied || '').split(/\n|;\s*/).map(s => s.trim().replace(/^\(?[ivx]+\)\s*/i, '')).filter(Boolean)
  const roman = ['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii']
  k.p(`5.1 This notice relies on the following, copies of which are available on the common portal or may be inspected at this office on any working day: ${relied.length ? relied.map((d, i) => `(${roman[i] || i + 1}) ${d}`).join('; ') : `(i) ${blank('document')}; (ii) ${blank('document')}`}.`)

  // ── 6. Personal hearing and consequences ──
  k.h('6. Personal hearing and consequences')
  k.p(`6.1 A personal hearing is fixed on ${date(n.hearing)} at ${or(n.time, 'time')} ${blank('at this office / by video conference')}. You may appear in person or through an authorised representative under section 116, with any further documents. If you need another date, ask for it in writing before that date, giving the reason.`)
  k.p('6.2 If no reply is received within fifteen days, or you do not appear for the hearing, a further date will be given and, if you still do not appear, the application will be decided on the records available. No application will be rejected without an opportunity of being heard (proviso to rule 92(3)).')
  k.p('6.3 Under rule 94(2)(a), any time beyond fifteen days from receipt of this notice taken by you to reply or to submit documents will be excluded when computing interest on delayed refund under section 56.')
  k.p(`6.4 The part of the claim not covered by this notice, ${rs(Math.max(0, T.claimed - proposed))}, is not proposed for rejection. This notice is without prejudice to any other action that may be taken under the Act.`)

  // ── Signature and copies ──
  B.push({ t: 'sign', officer: office.officer, desig: office.desig, office: `${office.division}, ${office.commrte}` })
  k.p('Copy to:')
  k.list([
    `The Superintendent, ${or(c.order?.range, 'Range')} Range, ${office.division}.`,
    ...(recovery ? [`The Adjudication cell, ${office.commrte}.`] : []),
    'Guard file.',
  ])

  if (rejecting) annexure(k, cat, r, grounds)
  return B
}

// ── Annexure: the recomputation (credit refunds), or the invoices / payments affected (tax refunds) ──
function annexure(k, cat, r, grounds) {
  const { c, v, T } = k
  const s = r.steps
  const g = grounds.length > 1 ? `Grounds 1 to ${grounds.length}` : 'Ground 1'
  const fig = (x) => x === null || x === undefined || !Number.isFinite(x) ? blank() : inr(Math.round(x))
  const asRead = (key) => num(c.edited?.[key]?.value) ?? num(v[key])
  const row = (label, claimed, proposed) => {
    const known = Number.isFinite(claimed) && Number.isFinite(proposed) && claimed !== null && proposed !== null
    const diff = known ? Math.round(claimed) - Math.round(proposed) : null
    return [label, fig(claimed), fig(proposed), !known ? blank() : diff === 0 ? 'No change' : `${inr(diff)}: ${g}`]
  }
  const head = ['Component', 'As claimed (₹)', 'As proposed (₹)', 'Difference and ground']

  if (cat === 'T1') {
    k.h('Annexure: recomputation of the refund')
    k.table(head, [
      row('Turnover of inverted rated supply', asRead('A'), num(v.A)),
      row('Adjusted Total Turnover', asRead('B'), num(v.B)),
      row('Net ITC', asRead('C'), num(v.C)),
      row('ITC on inputs and input services', asRead('D'), num(v.D)),
      row('Tax payable on inverted rated supply', asRead('E'), num(v.E)),
      row('Refund by formula', s ? asClaimedT1(c, v, s) : null, s?.maxRefund ?? null),
      row('Least of formula amount and ledger balances (para 37 of Circular 125)', s?.claimed ?? null, s?.admissible ?? null),
    ])
  } else if (R89_4.includes(cat)) {
    const zr = (cat === 'T3' ? 0 : num(v.zr_goods) || 0) + (num(v.zr_services) || 0)
    k.h('Annexure: recomputation of the refund')
    k.table(head, [
      row('Turnover of zero-rated supply', zr || null, s?.numerator ?? null),
      row('Adjusted Total Turnover', asRead('ato'), s?.ato ?? num(v.ato)),
      row('Net ITC', asRead('net_itc'), s?.net ?? num(v.net_itc)),
      row('Refund by formula', s ? (s.asClaimed ?? s.formula) : null, s?.formula ?? null),
      row('Least of formula amount and ledger balances (para 37 of Circular 125)', s?.claimed ?? null, s?.admissible ?? null),
    ])
  } else if (cat === 'T5' || cat === 'T6') {
    k.h('Annexure: invoices affected')
    const left = r.left || []
    k.table(['No.', 'Invoice', 'Why not admissible', 'Tax (₹)'], [
      ...(left.length ? left.map((x, i) => [String(i + 1), x.label, x.why.join('; '), inr(x.amount)]) : [[blank(), blank(), blank(), blank()]]),
      ['', '**Total**', '', left.length ? `**${inr(left.reduce((a, x) => a + x.amount, 0))}**` : blank()],
    ])
  } else if (cat === 'T7') {
    k.h('Annexure: credits in the electronic cash ledger affected')
    const out = (c.rows?.cashrows || []).filter(x => x.refundable === 'no')
    k.table(['No.', 'Challan (CPIN / CIN) or TDS / TCS credit', 'Head', 'Amount claimed (₹)'], [
      ...(out.length ? out.map((x, i) => [String(i + 1), or(x.entry, 'entry'), HEAD_LABEL[x.head] || blank('head'), inr(num(x.claimed) || 0)]) : [[blank(), blank(), blank(), blank()]]),
      ['', '**Total**', '', out.length ? `**${inr(out.reduce((a, x) => a + (num(x.claimed) || 0), 0))}**` : blank()],
    ])
  } else {
    k.h('Annexure: payments affected')
    const H = r.heads
    k.table(['Head', 'Pre-deposit and other amounts paid (₹)', 'Not refundable (₹)', 'Claimed (₹)', 'Proposed as admissible (₹)'], [
      ...k.shownHeads.filter(h => H[h].claimed || H[h].pd || H[h].op).map(h => [HEAD_LABEL[h], H[h].pd !== undefined ? inr((H[h].pd || 0) + (H[h].op || 0)) : blank(), H[h].nr !== undefined ? inr(H[h].nr || 0) : blank(), inr(H[h].claimed), inr(H[h].admissible)]),
      ['**Total**', '', '', `**${inr(T.claimed)}**`, `**${inr(T.admissible)}**`],
    ])
  }
}

// T1: the formula on the figures as filed, where the officer corrected any of them; else the same
// figures, so only the ledger cap and the amount claimed differ
function asClaimedT1(c, v, s) {
  const f = (key) => num(c.edited?.[key]?.value) ?? num(v[key])
  const [A, B, C, D, E] = ['A', 'B', 'C', 'D', 'E'].map(f)
  if ([A, B, C, D, E].some(x => x === null) || !B || !D) return s.maxRefund
  return A * C / B - E * C / D
}

// What is still missing before the notice can go out, for the screen
export function noticeReady(c, r) {
  const n = c.notice || {}
  const out = []
  if (!String(n.no || '').trim()) out.push('Notice No.')
  if (!String(n.date || '').trim()) out.push('Notice date')
  const ok = (c.grounds || []).filter(g => String(g.text || '').trim() && (num(g.amount) || 0) > 0)
  if (!ok.length) out.push('At least one ground with its text and amount')
  ;(c.grounds || []).forEach((g, i) => {
    const t = String(g.text || '').trim(), a = (num(g.amount) || 0) > 0
    if (t && !a) out.push(`Amount of ground ${i + 1}`)
    if (!t && a) out.push(`Text of ground ${i + 1}`)
  })
  if (!String(n.hearing || '').trim()) out.push('Hearing date')
  else if (n.date && n.hearing < plusDays(n.date, 16)) out.push(`Hearing date not earlier than the sixteenth day after the notice (${ddmmyyyy(plusDays(n.date, 16))} or later)`)
  if (r?.total?.excess > 0) {
    if (!String(n.drc01 || '').trim()) out.push('DRC-01 summary reference (excess provisional refund to be recovered)')
    if (!String(n.recovery_sec || '').trim()) out.push('Section for recovery of the excess provisional refund (73 / 74 / 74A)')
  }
  return out
}
