// Refund Desk: the speaking order for template T5, refund of integrated tax paid on export of
// services (s.54(1) of the CGST Act read with s.16(4) of the IGST Act), invoice by invoice.
import { kit, opening, provisional, PROV_FIRST_ZR, hearing, statutory, conclusionAndOrder, closing, blank, or, date, rs, same, num, inr, ddmmyyyy, monthName } from './order-kit.js'

const UE_TEXT = 'The refund is of tax paid on zero-rated supplies, payable to the applicant under clause (a) of section 54(8). The question of unjust enrichment does not arise, and no certificate or declaration under rule 89(2)(l) or (m) is required (provisos to rule 89(2)(l) and (m)).'
const LAW = 'section 54(1) of the CGST Act read with section 16(4) of the IGST Act and Notification No. 01/2023-Integrated Tax'

// "S. No. 3" / "S. Nos. 1, 2 and 4"
export const sNos = (list) => {
  const n = list.map(x => String(x.i + 1))
  return n.length === 1 ? `S. No. ${n[0]}` : `S. Nos. ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}
const total = (list, key = 'igst') => list.reduce((a, x) => a + (x[key] || 0), 0)
const late = (x) => x.why.some(w => /beyond two years/.test(w))

// Rows left out, grouped by their first reason, so no amount is counted twice
function groups(left, label) {
  const out = new Map()
  for (const x of left) {
    const key = late(x) ? 'late' : x.why[0]
    if (!out.has(key)) out.set(key, [])
    out.get(key).push(x)
  }
  return [...out].map(([key, list]) => ({ key, list, text: label(key, list) }))
}

export function buildT5(c, r, office) {
  const k = kit(c, r, office)
  k.shownHeads = ['igst']
  const { v, T, ok, confirmText, name, period } = k
  const { h, p } = k
  const s = r.steps || { rowsTotal: 0, igst: 0 }
  const list = c.rows?.taxinv || []
  const rr = r.rows || []
  const left = r.left || []

  opening(k, {
    title: 'REFUND OF INTEGRATED TAX PAID ON EXPORT OF SERVICES [SECTION 54(1) OF THE CGST ACT READ WITH SECTION 16(4) OF THE IGST ACT]',
    category: 'Export of services with payment of tax',
    claimHeads: `IGST ${rs(k.claimedH.igst)} (compensation cess is not levied on services)`,
  })

  // 1. Brief facts
  h('1. Brief facts')
  const paid = list.length ? s.rowsTotal : num(v.tax_3b)
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, supplies ${or(v.supply_desc, 'description of services')} under SAC ${or(v.supply_hsn, 'SAC')} to ${or(v.recipients, 'number of recipients and the country / countries in which they are located')}, under ${or(v.agreement, 'agreement(s) and their dates')}. During ${period || blank('period')} it supplied these services on payment of integrated tax of ${paid === null ? `₹${blank()}` : rs(paid)}, declared in GSTR-1 Table 6A and paid through GSTR-3B Table 3.1(b).`)
  p(`1.2 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of IGST of ${rs(k.claimedH.igst)} so paid, with Statement 2 listing ${list.length || blank('number of')} invoice${list.length === 1 ? '' : 's'} and the related FIRCs / BRCs / e-BRCs. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 16(1)(a) of the IGST Act, export of services is a zero-rated supply. Under section 16(4) of the IGST Act (as substituted with effect from 01.10.2023) and Notification No. 01/2023-Integrated Tax dated 31.07.2023, as amended by Notification No. 05/2023-Integrated Tax dated 26.10.2023, all services may be exported on payment of integrated tax, and the supplier may claim refund of the tax so paid. The refund is claimed under section 54(1) of the CGST Act, read with section 20 of the IGST Act.')
  p(`2.2 Under section 2(6) of the IGST Act, "export of services" means the supply of a service when (i) the supplier is located in India; (ii) the recipient is located outside India; (iii) the place of supply is outside India; (iv) the payment for the service has been received by the supplier in convertible foreign exchange or in Indian rupees wherever permitted by the Reserve Bank of India; and (v) the supplier and the recipient are not merely establishments of a distinct person in accordance with Explanation 1 to section 8. The place of supply is decided under section 13 of the IGST Act: the general rule in section 13(2) (location of the recipient) applies unless the service falls in sub-sections (3) to (13). Clause (b) of section 13(8), which made the location of the supplier the place of supply of intermediary services, was omitted by section 157 of the Finance Act, 2026, with effect from ${blank('date of commencement of section 157: the law text records only the date of the Act, 30.03.2026, and no separate notification has been seen; confirm before use')}. The omission is prospective: for supplies before that date, the place of supply of intermediary services remains the location of the supplier (section 13(8)(b)), and whether a supply is an intermediary service is decided on the tests in Circular No. 159/15/2021-GST.`)
  p('2.3 Under rule 89(2)(c), the application is accompanied by a statement containing the number and date of invoices and the relevant BRCs or FIRCs. Under clause (c) of Explanation 2 to section 54, the relevant date is the date of receipt of payment in convertible foreign exchange (or permitted Indian rupees), where the supply had been completed before the payment; or the date of issue of the invoice, where payment had been received in advance of the invoice. Under rule 96(9), refund of integrated tax paid on services exported is claimed in FORM GST RFD-01 and dealt with under rule 89; the shipping-bill route in rule 96 applies only to goods.')
  p('2.4 This is a refund of tax paid, not of input tax credit. The formula in rule 89(4) does not apply, and the eligibility of the applicant\'s input tax credit is not an issue in this claim.')

  // 3. Limitation
  h('3. Limitation')
  const dated = rr.filter(x => x.relevant)
  const lateRows = rr.filter(x => x.inTime === false)
  const inTime = dated.filter(x => x.inTime)
  const undated = rr.filter(x => !x.relevant)
  if (!rr.length) p(`3.1 ${blank('limitation: the relevant date of each invoice under clause (c) of Explanation 2 to section 54, and the filing date')}`)
  else {
    const earliest = (xs) => xs.map(x => x.relevant).sort()[0]
    const parts = ['3.1 The relevant date under clause (c) has been checked for each invoice in Table 1.']
    if (!lateRows.length && !undated.length) parts.push(`All relevant dates fall on or after ${ddmmyyyy(earliest(dated))}, and the application filed on ${date(v.filed)} is within two years of each.`)
    else {
      if (inTime.length) parts.push(`The relevant dates of the invoices at ${sNos(inTime)} fall on or after ${ddmmyyyy(earliest(inTime))}, and the application filed on ${date(v.filed)} is within two years of each.`)
      if (lateRows.length) parts.push(`The relevant date${lateRows.length > 1 ? 's' : ''} for the invoice${lateRows.length > 1 ? 's' : ''} at ${sNos(lateRows)} (${lateRows.map(x => ddmmyyyy(x.relevant)).join(', ')}) ${lateRows.length > 1 ? 'are' : 'is'} more than two years before the filing on ${date(v.filed)} (two years ended on ${lateRows.map(x => ddmmyyyy(x.ends)).join(', ')}); the tax of ${rs(total(lateRows))} on ${lateRows.length > 1 ? 'them' : 'it'} is beyond two years and is not refundable.`)
      if (undated.length) parts.push(`For the invoice${undated.length > 1 ? 's' : ''} at ${sNos(undated)}, ${blank('date of the remittance (or of the invoice, where paid in advance), which gives the relevant date')}.`)
    }
    if (rr.some(x => x.covid)) parts.push('The period from 01.03.2020 to 28.02.2022 has been left out of the two years under Notification No. 13/2022-Central Tax dated 05.07.2022.')
    p(parts.join(' '))
  }

  // 4. Other conditions
  h('4. Other conditions for admissibility')
  const ackDays = v.filed && v.ack ? Math.round((Date.parse(v.ack) - Date.parse(v.filed)) / 864e5) : null
  p(`4.1 The application was complete in terms of rule 89(2) and was acknowledged in RFD-02 on ${date(v.ack)}${ackDays !== null && ackDays <= 15 ? ', within fifteen days' : ''} under rule 90(2). ${confirmText('returns', 'The applicant has filed all returns due up to the date of the application (para 6 of Circular No. 125/44/2019-GST).')} ${confirmText('no_overlap', 'The back-office refund history shows no other claim on these invoices, whether in this category or as unutilised ITC under LUT.')} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)

  // 5. Provisional refund
  provisional(k, PROV_FIRST_ZR)

  // 6. Verification
  h('6. Verification')
  const notExport = rr.filter(x => list[x.i]?.export === 'no')
  const exported = ok('export_2_6')
  const finding = (yes = 'Satisfied') => notExport.length ? blank(`Satisfied / not satisfied for ${sNos(notExport)}`) : exported ? yes : blank('Satisfied / ...')
  const fircs = list.map(x => x.firc).filter(x => String(x || '').trim())
  p(`6.1 **Export of services.** The ${or(v.agreement, 'agreement(s)')}, invoices and FIRCs / e-BRCs were examined against each condition of section 2(6):`)
  k.caption('Table A: Conditions of section 2(6) of the IGST Act')
  k.table(['Condition', 'Evidence examined', 'Finding'], [
    ['(i) Supplier located in India', 'Registration certificate', 'Satisfied'],
    ['(ii) Recipient located outside India', `Agreement; address of the recipient(s): ${or(v.recipients, 'country')}`, finding()],
    ['(iii) Place of supply outside India', 'Nature of service and section 13 analysis below', finding()],
    ['(iv) Payment in convertible foreign exchange or permitted INR', `FIRCs / e-BRCs Nos. ${fircs.length ? fircs.join(', ') : blank('Nos.')}`, finding()],
    ['(v) Not merely establishments of a distinct person', blank('unrelated entity / separately incorporated related entity (Circular No. 161/17/2021-GST)'), finding()],
  ])
  const pos = exported
    ? `It is not covered by sub-sections (3) to (13) of section 13, so under section 13(2) the place of supply is the location of the recipient (${or(v.recipients, 'country')}), outside India.`
    : blank('place of supply: section 13(2), the location of the recipient / intermediary under section 13(8)(b) for supplies before its omission (Circular No. 159/15/2021-GST) / related recipient, value examined under rule 28')
  p(`6.2 **Place of supply.** The service consists of ${or(v.supply_desc, 'what the applicant actually does, for whom, and how it is delivered')}. ${pos}${notExport.length ? ` The supplies at ${sNos(notExport)} are not exports of services, for the reasons in para 8.` : ''}`)

  p('6.3 **Tax actually paid.** Each invoice, the integrated tax on it and the remittance were matched:')
  k.caption('Table 1: Invoices, tax paid and remittances')
  const remark = (x, row) => [...x.why.map(w => w[0].toUpperCase() + w.slice(1)), ...(String(row.remarks || '').trim() ? [row.remarks.trim()] : [])].join('; ') || 'Admissible'
  const gstr1 = (row) => row.in_gstr1 === 'no' ? 'No' : row.in_gstr1 === 'yes' ? `Yes${monthName((row.inv_date || '').slice(0, 7)) ? `, ${monthName(row.inv_date.slice(0, 7))}` : ''}` : blank('Yes / No')
  const basis = (row) => row.advance === 'advance' ? ' (invoice: advance received)' : ' (remittance)'
  k.table(['S. No.', 'Invoice No. and date', 'Taxable value (₹)', 'IGST paid (₹)', 'Shown in GSTR-1 Table 6A', 'FIRC / e-BRC No. and date', 'Relevant date', 'Within two years?', 'Remarks'], [
    ...(list.length ? list.map((row, i) => {
      const x = rr[i] || { why: [] }
      return [String(i + 1), `${or(row.inv, 'No.')} dated ${date(row.inv_date)}`, inr(num(row.value)), inr(num(row.igst)), gstr1(row),
        row.firc || row.firc_date ? `${or(row.firc, 'No.')} dated ${date(row.firc_date)}` : blank(),
        x.relevant ? `${ddmmyyyy(x.relevant)}${basis(row)}` : blank(), x.inTime === false ? 'No' : x.inTime ? 'Yes' : blank('Yes / No'), remark(x, row)]
    }) : [Array.from({ length: 9 }, () => blank())]),
    ['', '**Total**', `**${inr(list.reduce((a, x) => a + (num(x.value) || 0), 0))}**`, `**${inr(s.rowsTotal)}**`, '', '', '', '', ''],
  ])
  const [g1, b3] = [num(v.tax_gstr1), num(v.tax_3b)]
  const agrees = g1 !== null && b3 !== null && same(g1, b3) && same(b3, k.claimedH.igst) && (!list.length || same(s.rowsTotal, b3))
  p(`6.4 The integrated tax shown in GSTR-1 Table 6A for the period (${g1 === null ? `₹${blank()}` : rs(g1)}) ${agrees ? 'agrees' : blank('agrees / does not agree')} with the tax on zero-rated supplies declared and paid in GSTR-3B Table 3.1(b) (${b3 === null ? `₹${blank()}` : rs(b3)}), and with the amount claimed (${rs(k.claimedH.igst)}).${agrees ? '' : ` ${blank('explain the difference')}`} ${confirmText('tax_matches', 'No tax so shown was later reduced by a credit note or amendment.')}`)

  // 7. Amount admissible
  h('7. Amount admissible')
  if (!list.length) p(`7.1 ${blank('Table 1 is not filled: the integrated tax on each invoice, and the amount admissible')}`)
  else {
    const LABEL = { late: 'beyond limitation (para 3)', 'not an export of services under s.2(6) of the IGST Act': 'not exports of services under section 2(6) of the IGST Act (paras 6.1 and 8)', 'not shown in GSTR-1 Table 6A': 'not shown in GSTR-1 Table 6A (para 6.3)', 'relevant date not entered': 'whose relevant date is not established (para 3)' }
    const gs = groups(left, (key, xs) => `${rs(total(xs))} relating to the invoice${xs.length > 1 ? 's' : ''} at ${sNos(xs)} ${LABEL[key] || `(${key})`}`)
    const base = s.rowsTotal - total(left)
    const cap = s.igst < base ? ` (limited to ${b3 !== null && s.igst === b3 ? 'the integrated tax paid in GSTR-3B Table 3.1(b)' : 'the amount claimed'})` : ''
    const excl = gs.length ? ` From it, ${gs.map(g => g.text).join(' and ')} ${gs.length > 1 || gs[0].list.length > 1 ? 'are' : 'is'} excluded.` : ' No invoice is excluded.'
    p(`7.1 The integrated tax shown in Table 1 is ${rs(s.rowsTotal)}.${excl} The amount admissible is therefore IGST ${rs(s.igst)}${cap}, rounded to the nearest rupee (section 170).`)
    if (left.length) {
      k.caption('Invoices left out')
      k.table(['S. No. in Table 1', 'Invoice', 'IGST (₹)', 'Why not admissible'], [
        ...left.map(x => [String(x.i + 1), or(list[x.i]?.inv, 'No.'), inr(x.igst), x.why.join('; ')]),
        ['', '**Total**', `**${inr(total(left))}**`, ''],
      ])
    }
  }

  // 8. Notice, reply and hearing; 8.4 where a supply is not an export
  hearing(k, 8, { affCol: 'Amount found not admissible on this ground (₹)' })
  if (notExport.length) {
    const withPara = k.grounds.map((g, i) => g.para?.trim() ? i : -1).filter(i => i >= 0)
    const n8 = r.rejecting ? 4 + (withPara.length ? Math.max(...withPara) + 1 : 0) : 2
    p(`8.${n8} As the supplies at ${sNos(notExport)} are held not to be exports of services, the integrated tax of ${rs(total(notExport))} paid on them is not refundable under section 54(1) read with section 16(4) of the IGST Act. ${blank('choose: "Being an intra-State supply, central tax and State tax of ₹… appear payable, and the matter is referred to the Range / Adjudication for action under section 73 / 74 / 74A. The applicant\'s remedy for the integrated tax paid under the wrong head lies under section 19 of the IGST Act (Circular No. 162/18/2021-GST), and is not decided in this order." or "Being an inter-State supply in India, the integrated tax paid was correctly payable."')}`)
  }

  statutory(k, 9, UE_TEXT)
  conclusionAndOrder(k, { kind: 'tax', law: LAW, clause8: 'a', rejParas: '3, 6, 7 and 8', taxDesc: 'integrated tax paid on export of services' })
  closing(k)
  return k.B
}
