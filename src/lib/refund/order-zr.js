// Refund Desk: what templates T2, T3 and T4 share (refund of unutilised credit on zero-rated
// supplies under LUT, rule 89(4)): the variables of their front matter, para 4.1, the limitation
// text for rows checked one by one, the credit and risk paras of para 6, and para 7 (sources,
// computation, rows left out, head-wise split). Each template's own paragraphs are in order-t2.js,
// order-t3.js and order-t4.js.
import { sourcesTable, blank, or, date, rs, exact, same, num, inr, ddmmyyyy, HEAD_LABEL } from './order-kit.js'

export const UE_ZR = 'The refund is of unutilised input tax credit on zero-rated supplies, payable to the applicant under clause (a) of section 54(8). The question of unjust enrichment does not arise, and no certificate or declaration under rule 89(2)(l) or (m) is required (provisos to rule 89(2)(l) and (m)).'
export const LAW_EXPORT = 'clause (i) of the first proviso to section 54(3) of the CGST Act and section 16(3) of the IGST Act, read with rule 89(4)'
export const REJ_PARAS = '3, 6, 7 and 8'

const plural = (n, one, many) => n === 1 ? one : many
const listAnd = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`
export const yesNo = (m) => m.inTime === false ? 'No' : m.inTime ? 'Yes' : blank('Yes / No')
export const remarks = (row, m) => [String(row?.remarks || '').trim(), ...(m.why || [])].filter(Boolean).join('; ') || 'Nil'
export { plural, listAnd }

const dayDiff = (a, b) => {
  const d = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null }
  return d(a) !== null && d(b) !== null ? Math.round((d(b) - d(a)) / 86400e3) : null
}

// 4.1 Other conditions for admissibility. overlap: what the refund history adds for this template.
export function conditions(k, overlap) {
  const { v, ok, confirmText } = k
  const days = dayDiff(v.filed, v.ack)
  k.h('4. Other conditions for admissibility')
  k.p(`4.1 The application was complete in terms of rule 89(2) and was acknowledged in RFD-02 on ${date(v.ack)}${days !== null && days >= 0 && days <= 15 ? ', within fifteen days,' : ''} under rule 90(2). ${confirmText('returns', 'The applicant has filed all returns due up to the date of the application (para 6 of Circular No. 125/44/2019-GST).')} The amount claimed was debited from the electronic credit ledger by debit entry No. ${or(v.debit_no, 'debit entry No.')} dated ${date(v.debit_date)} (rule 89(3)). ${confirmText('undertaking', 'The undertaking in relation to section 16(2)(c) has been filed online (para 2.4 of Circular No. 197/09/2023-GST).')} ${confirmText('no_overlap', `The back-office refund history shows no other claim for this period in this or any other category, and ${overlap}.`)} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)
}

// The days left out of the two years: the Covid period and an earlier application returned by RFD-03
export function extraTime(k, rows) {
  const { v } = k
  const covid = rows.find(m => m.covid)
  const extra = num(v.excluded_days)
  return [
    covid ? ` The period from 01.03.2020 to 28.02.2022 is left out in computing the two years where they had not run out by then (Notification No. 13/2022-Central Tax dated 05.07.2022).` : '',
    extra ? ` A period of ${extra} days, from the filing of the earlier application for this period to its return in FORM GST RFD-03, is excluded under the proviso to rule 90(3).` : '',
  ].join('')
}

// Rows checked one by one (shipping bills, remittances): which are within two years and which are not.
// noun: ['shipping bill', 'shipping bills']; lateTail(sNos, value): what follows for the late ones.
export function rowsLimitation(k, rows, { noun, lateTail }) {
  const { v } = k
  const [one, many] = noun
  const late = rows.map((m, i) => ({ ...m, sno: i + 1 })).filter(m => m.inTime === false)
  const unknown = rows.map((m, i) => ({ ...m, sno: i + 1 })).filter(m => m.inTime !== false && !m.inTime)
  const good = rows.filter(m => m.inTime)
  const earliest = good.map(m => m.relevant).sort()[0]
  let text = ''
  if (!rows.length) return ` ${blank(`the ${many} and their relevant dates (Table 1)`)}`
  if (!late.length && !unknown.length) text = ` All ${many} have relevant dates on or after ${ddmmyyyy(earliest)}, and the application filed on ${date(v.filed)} is within two years of each.`
  else {
    if (late.length) {
      const nos = late.map(m => String(m.sno))
      const value = late.reduce((a, m) => a + (m.value || 0), 0)
      text += ` ${plural(late.length, `The ${one} at serial number`, `The ${many} at serial numbers`)} ${listAnd(nos)} ${plural(late.length, 'has a relevant date', 'have relevant dates')} of ${listAnd(late.map(m => ddmmyyyy(m.relevant)))}, two years from which ended on ${listAnd(late.map(m => ddmmyyyy(m.ends)))}, and ${plural(late.length, 'is', 'are')} beyond two years on the date of filing, ${date(v.filed)}. ${lateTail(nos, value, late.length)}`
    }
    if (unknown.length) text += ` ${blank(`relevant date of the ${plural(unknown.length, one, many)} at serial number${plural(unknown.length, '', 's')} ${unknown.map(m => m.sno).join(', ')}`)}`
    if (good.length) text += ` The other ${plural(good.length, one, many)} ${plural(good.length, 'has a relevant date', 'have relevant dates')} on or after ${ddmmyyyy(earliest)} and ${plural(good.length, 'is', 'are')} within two years.`
  }
  return text + extraTime(k, rows)
}

// Para 6, credit: Net ITC, its reconciliation with GSTR-3B, and credit that is not a supplier invoice
export function creditPara(k, N) {
  const { v, confirmText } = k
  const net = num(v.net_itc), t4a = num(v.itc_4a), cg = num(v.itc_capital), bl = num(v.itc_blocked)
  let recon = ''
  if (t4a !== null && net !== null) {
    const calc = t4a - (cg || 0) - (bl || 0)
    recon = ` The Net ITC reconciles with GSTR-3B as follows: credit availed in Table 4A(1) to 4A(5) ${rs(t4a)} − capital goods ${rs(cg || 0)} − blocked or ineligible credit ${rs(bl || 0)} = ${rs(calc)}${same(calc, net) ? '.' : `, against Net ITC of ${rs(net)} adopted: ${blank('reason for the difference')}.`}`
  }
  k.p(`${N} **Credit.** Net ITC of ${net === null ? blank('Net ITC') : rs(net)} consists of credit on inputs and input services availed during the period. ${confirmText('gstr2b', 'It is reflected in GSTR-2B of the period or an earlier period (para 1.3 of Circular No. 197/09/2023-GST), and no credit blocked by section 17(5) or barred by section 16(4) has been included.')} Credit on capital goods (${cg === null ? blank('amount') : rs(cg)}) is excluded by the definition of Net ITC.${bl ? ` Credit of ${rs(bl)} blocked by section 17(5) or barred by section 16(4) has been kept out of Net ITC.` : ''}${recon} Credit on imports of goods (bills of entry), on Input Service Distributor documents and on inward supplies taxed under reverse charge is not excluded merely because it does not appear as a supplier invoice in GSTR-2B (para 4 of Circular No. 139/09/2020-GST).`)
}

// Para 6, risk checks
export function riskPara(k, N) {
  k.p(`${N} **Risk checks.** ${k.confirmText('suppliers', 'The supplier chain was checked for risk (suppliers accounting for a large share of the credit, cancelled or non-filing suppliers, and alerts in the DIGIT and other risk or intelligence reports), and nothing was found that affects the claim.')}`)
}

// Para 7. m: { comp: sources table entries, A, B (adopted figures), aLabel, bLabel, leftNoun }
export function computation(k, m) {
  const { r, v, T } = k
  const s = r.steps
  k.h('7. Computation of the admissible refund')
  k.p('7.1 Sources of the figures. For each figure, one source is used, and the same source is used wherever the figure appears in the formula.')
  sourcesTable(k, m.comp)
  if (r.left.length) {
    k.p(`The following ${plural(r.left.length, 'is', 'are')} left out of the turnover of zero-rated supply (${m.aKey || 'A'}), for the reasons shown. ${plural(r.left.length, 'It remains', 'They remain')} in the Adjusted Total Turnover (C), as ${plural(r.left.length, 'it is', 'they are')} part of the turnover of the period, so that the numerator and the denominator are worked out on the same basis (rule 89(4)(E); para 3 of Circular No. 197/09/2023-GST):`)
    k.table([m.leftNoun || 'Document', 'Value (₹)', 'Why left out of the zero-rated turnover', 'In Adjusted Total Turnover?'], [
      ...r.left.map(x => [x.label, inr(x.amount), x.why.join('; '), 'Yes']),
      ['**Total**', `**${inr(r.left.reduce((a, x) => a + (x.amount || 0), 0))}**`, '', ''],
    ])
  }
  k.p('7.2 Computation:')
  if (!s) { k.table(['Step', 'Working', 'Amount (₹)'], [['(i)', `(A + B) × D ÷ C = ${blank('figures')}`, blank()]]); return }
  const [A, Bv] = [m.A || 0, m.B || 0]
  const claimedZR = s.asClaimed !== null ? s.asClaimed * s.ato / s.net : null
  k.table(['Step', 'Working', 'Amount (₹)'], [
    ['(i)', `(A + B) × D ÷ C = (${inr(A)} + ${inr(Bv)}) × ${inr(s.net)} ÷ ${inr(s.ato)} (not rounded)`, exact(s.formula)],
    ['(ii)', 'Balance in the electronic credit ledger at the end of the period', s.end === null ? blank() : inr(s.end)],
    ['(iii)', 'Balance in the electronic credit ledger at the time of filing', s.atFiling === null ? blank() : inr(s.atFiling)],
    ['(iv)', 'Admissible refund: least of (i), (ii) and (iii), rounded to the nearest rupee (section 170), and not more than claimed', `**${inr(s.admissible)}**`],
    ['(v)', 'Amount claimed', inr(s.claimed)],
    ['(vi)', 'Inadmissible: (v) − (iv)', inr(s.rejected)],
    ...(claimedZR !== null ? [['(note)', `As claimed in the application, on a zero-rated turnover of ${inr(claimedZR)}: ${inr(claimedZR)} × ${inr(s.net)} ÷ ${inr(s.ato)}. The difference arises from the turnover adopted in para 7.1.`, exact(s.asClaimed)]] : []),
    ...(r.cess ? [['(cess)', `The same formula applied to cess credit alone, debited entirely from the cess balance (para 39 of Circular No. 125/44/2019-GST): ${inr(s.numerator)} × ${inr(num(v.cess_C))} ÷ ${inr(s.ato)} = ${exact(r.cess.formula)}, within the cess balances in the ledger`, inr(r.cess.admissible)]] : []),
  ])
  k.p(m.splitText || '7.3 Head-wise split (cess separately, as in para 7.2), in the order of debit (integrated tax first, then central and State tax equally: para 37 of Circular 125):')
  const bal = (key, x) => { const b = num(v[`${key}_${x}`]); return b === null ? blank() : inr(b) }
  k.table(['Head', 'Debited in RFD-01 (₹)', 'Ledger balance at end of period (₹)', 'Ledger balance at filing (₹)', 'Admissible (₹)', 'Inadmissible (₹)'], [
    ...k.shownHeads.map(x => [HEAD_LABEL[x], inr(k.claimedH[x]), bal('end', x), bal('at_filing', x), inr(k.admH[x]), inr(k.rejH[x])]),
    ['**Total**', `**${inr(T.claimed)}**`, '', '', `**${inr(T.admissible)}**`, `**${inr(T.rejected)}**`],
  ])
}

// The rule 89(4)(D) working for services, as a table
export function servicesD(k) {
  const { v, r } = k
  const [a, b, c] = ['d_a', 'd_b', 'd_c'].map(x => num(v[x]))
  const cell = (x) => x === null ? blank() : inr(x)
  const fromD = r.steps?.fromD ?? (a !== null || b !== null || c !== null ? (a || 0) + (b || 0) - (c || 0) : null)
  k.table(['Component of rule 89(4)(D)', 'Amount (₹)'], [
    ['(a) All payments received during the period for zero-rated supply of services (including advances)', cell(a)],
    ['(b) Services completed during the period for which advance was received in an earlier period', cell(b)],
    ['(c) Less: advances received during the period for services not completed during the period', cell(c)],
    ['Turnover of zero-rated supply of services = (a) + (b) − (c)', `**${fromD === null ? blank() : inr(fromD)}**`],
  ])
  return fromD
}
