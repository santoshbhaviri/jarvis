// Refund Desk: the speaking order for template T6, refund of integrated tax paid on supplies to an
// SEZ unit or developer (s.54(1) of the CGST Act read with ss.16(1)(b) and 16(4) of the IGST Act),
// invoice by invoice.
import { kit, opening, provisional, PROV_FIRST_ZR, hearing, statutory, conclusionAndOrder, closing, blank, or, date, rs, same, headsText, num, inr, ddmmyyyy, monthName } from './order-kit.js'

const LAW = 'section 54(1) of the CGST Act read with sections 16(1)(b) and 16(4) of the IGST Act and Notification No. 01/2023-Integrated Tax, as amended'

const sNos = (list) => {
  const n = list.map(x => String(x.i + 1))
  return n.length === 1 ? `S. No. ${n[0]}` : `S. Nos. ${n.slice(0, -1).join(', ')} and ${n[n.length - 1]}`
}
const total = (list, key) => list.reduce((a, x) => a + (key ? x[key] || 0 : (x.igst || 0) + (x.cess || 0)), 0)
const late = (x) => x.why.some(w => /beyond two years/.test(w))
const ym = (s) => /^\d{4}-\d{2}/.test(s || '') ? s.slice(0, 7) : ''
const join = (xs) => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`

export function buildT6(c, r, office) {
  const k = kit(c, r, office)
  const cessed = (k.claimedH.cess || 0) > 0
  k.shownHeads = cessed ? ['igst', 'cess'] : ['igst']
  const { v, T, ok, confirmText, name, period } = k
  const { h, p } = k
  const s = r.steps || { rowsTotal: 0, igst: 0, cess: 0 }
  const list = c.rows?.seztax || []
  const rr = r.rows || []
  const left = r.left || []
  const goods = v.goods_or_services === 'goods', services = v.goods_or_services === 'services'
  const cessRows = list.reduce((a, x) => a + (num(x.cess) || 0), 0)
  const amt = (x) => cessed ? `${rs(x.igst + x.cess)} (IGST ${rs(x.igst)}, Cess ${rs(x.cess)})` : rs(x.igst)
  const sumOf = (xs) => ({ igst: total(xs, 'igst'), cess: total(xs, 'cess') })

  opening(k, {
    title: 'REFUND OF INTEGRATED TAX PAID ON SUPPLIES MADE TO A SPECIAL ECONOMIC ZONE UNIT / DEVELOPER [SECTION 54(1) OF THE CGST ACT READ WITH SECTIONS 16(1)(b) AND 16(4) OF THE IGST ACT]',
    category: 'On account of supplies made to SEZ unit / SEZ developer (with payment of tax)',
    claimHeads: `IGST ${rs(k.claimedH.igst)}; Cess ${rs(k.claimedH.cess)}; Total ${rs(T.claimed)}`,
  })

  // 1. Brief facts
  h('1. Brief facts')
  const what = goods ? 'goods' : services ? 'services' : 'goods / services'
  const code = goods ? 'HSN' : services ? 'SAC' : 'HSN / SAC'
  const units = [...new Set(list.map(x => String(x.unit || '').trim()).filter(Boolean))]
  const paid = list.length ? s.rowsTotal : num(v.tax_3b)
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, supplied ${or(v.supply_desc, `description of ${what}`)} under ${code} ${or(v.supply_hsn, code)} to ${units.length ? `${units.length} SEZ unit(s) / developer(s)` : blank('number of SEZ units / developers')} (${or(v.sez_name, 'name of the SEZ unit / developer and of the Zone')}) during ${period || blank('period')}, on payment of integrated tax of ${paid === null ? `₹${blank()}` : rs(paid)}${cessed && cessRows ? ` and compensation cess of ${rs(cessRows)}` : ''}, declared in GSTR-1 Table 6B and paid through GSTR-3B Table 3.1(b).`)
  p(`1.2 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, ['igst', 'cess'])}) of the integrated tax so paid, with Statement 4 listing ${list.length || blank('number of')} invoice${list.length === 1 ? '' : 's'} endorsed by the specified officer of the SEZ, and ${ok('not_collected') ? 'the declaration under rule 89(2)(f)' : blank('the declaration under rule 89(2)(f): filed / not filed')}. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 16(1)(b) of the IGST Act, as amended with effect from 01.10.2023, a supply of goods or services or both **for authorised operations** to an SEZ developer or SEZ unit is a zero-rated supply. Under section 16(4) and Notification No. 01/2023-Integrated Tax dated 31.07.2023, as amended by Notification No. 05/2023-Integrated Tax dated 26.10.2023 (deemed to have effect from 01.10.2023), all suppliers to an SEZ developer or unit undertaking authorised operations may supply goods or services (other than the goods in the Table to that notification, namely pan masala, the listed tobacco products and the listed mint essential oils of heading 3301) for authorised operations on payment of integrated tax, and claim refund of the tax so paid.')
  p('2.2 Under the proviso to rule 89(1) relating to supplies to a Special Economic Zone (which rule 89(2)(d) and (e) still describe as the second proviso), the supplier of goods files the application after the goods have been admitted in full in the SEZ for authorised operations, as endorsed by the specified officer; and the supplier of services files it with evidence of receipt of the services for authorised operations, as endorsed by the specified officer. Rule 89(2)(d) and (e) require the corresponding statements of invoices with that endorsement, and **rule 89(2)(f)** requires a declaration that tax has not been collected from the SEZ unit or developer.')
  p('2.3 Under clause (ba) of Explanation 2 to section 54, the relevant date is the due date for furnishing the return under section 39 in respect of such supplies.')
  p('2.4 This is a refund of tax paid, not of input tax credit. The formula in rule 89(4) does not apply, and the eligibility of the applicant\'s input tax credit is not an issue in this claim.')

  // 3. Limitation: one relevant date for each month of invoices (the GSTR-3B due date)
  h('3. Limitation')
  const byMonth = new Map()
  rr.forEach((x, i) => { const m = ym(list[i]?.inv_date); if (m && x.relevant) { if (!byMonth.has(m)) byMonth.set(m, { month: m, relevant: x.relevant, ends: x.ends, inTime: x.inTime, rows: [] }); byMonth.get(m).rows.push(x) } })
  const months = [...byMonth.values()].sort((a, b) => a.month < b.month ? -1 : 1)
  const undated = rr.filter((x, i) => !x.relevant || !ym(list[i]?.inv_date))
  if (!months.length) p(`3.1 ${blank('limitation: the months of the invoices, the GSTR-3B due date of each (clause (ba) of Explanation 2 to section 54) and the filing date')}`)
  else {
    const first = months[0], lateM = months.filter(m => m.inTime === false), okM = months.filter(m => m.inTime !== false)
    const parts = [`3.1 The invoices in this claim are of ${join(months.map(m => monthName(m.month)))}. The due date for the GSTR-3B of ${monthName(first.month)} was ${ddmmyyyy(first.relevant)}, which is the earliest relevant date under clause (ba); two years from it end on ${ddmmyyyy(first.ends)}.`]
    if (!lateM.length) parts.push(`The application, filed on ${date(v.filed)}, is within time.`)
    else {
      if (okM.length) parts.push(`The application, filed on ${date(v.filed)}, is within time for the invoices of ${join(okM.map(m => monthName(m.month)))}.`)
      const lr = lateM.flatMap(m => m.rows)
      parts.push(`The tax of ${amt(sumOf(lr))} on invoices of ${join(lateM.map(m => monthName(m.month)))} (${sNos(lr)}) is beyond two years and is not refundable.`)
    }
    if (undated.length) parts.push(`For the invoice${undated.length > 1 ? 's' : ''} at ${sNos(undated)}, ${blank('invoice date, which gives the month and its GSTR-3B due date')}.`)
    if (rr.some(x => x.covid)) parts.push('The period from 01.03.2020 to 28.02.2022 has been left out of the two years under Notification No. 13/2022-Central Tax dated 05.07.2022.')
    p(parts.join(' '))
    if (months.length > 1) k.table(['Month of invoices', 'Relevant date (GSTR-3B due date)', 'Two years end on', 'Within time'], months.map(m => [monthName(m.month), ddmmyyyy(m.relevant), ddmmyyyy(m.ends), m.inTime === false ? 'No' : m.inTime ? 'Yes' : blank()]))
  }

  // 4. Other conditions
  h('4. Other conditions for admissibility')
  const ackDays = v.filed && v.ack ? Math.round((Date.parse(v.ack) - Date.parse(v.filed)) / 864e5) : null
  p(`4.1 The application was complete in terms of rule 89(2) and was acknowledged in RFD-02 on ${date(v.ack)}${ackDays !== null && ackDays <= 15 ? ', within fifteen days' : ''} under rule 90(2). ${confirmText('returns', 'The applicant has filed all returns due up to the date of the application (para 6 of Circular No. 125/44/2019-GST).')} ${confirmText('no_overlap', 'The back-office refund history shows no other claim on these invoices, whether in this category or as unutilised ITC under LUT.')} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)

  // 5. Provisional refund
  provisional(k, PROV_FIRST_ZR)

  // 6. Verification
  h('6. Verification')
  p('6.1 **Endorsement, authorised operations and tax paid.**')
  k.caption('Table 1: Invoices to the SEZ')
  const yn = (x) => x === 'yes' ? 'Yes' : x === 'no' ? 'No' : blank('Yes / No')
  const remark = (x, row) => [...x.why.map(w => row.authorised === 'no' && /authorised operations/.test(w) ? 'not for authorised operations (para 8)' : w).map(w => w[0].toUpperCase() + w.slice(1)), ...(String(row.remarks || '').trim() ? [row.remarks.trim()] : [])].join('; ') || 'Admissible'
  const cols = 10 + (cessed ? 1 : 0)
  k.table(['S. No.', 'Invoice No. and date', 'SEZ unit / developer (GSTIN)', 'Goods / services', 'Taxable value (₹)', 'IGST paid (₹)', ...(cessed ? ['Cess paid (₹)'] : []), 'Endorsement (bill of entry / SEZ Online request No. and date)', 'Within authorised operations?', 'Shown in GSTR-1 Table 6B?', 'Remarks'], [
    ...(list.length ? list.map((row, i) => {
      const x = rr[i] || { why: [] }
      return [String(i + 1), `${or(row.inv, 'No.')} dated ${date(row.inv_date)}`, or(row.unit, 'SEZ unit (GSTIN)'), or(row.desc, what), inr(num(row.value)), inr(num(row.igst) || 0), ...(cessed ? [inr(num(row.cess) || 0)] : []),
        String(row.endorsement || '').trim() || 'Not endorsed', yn(row.authorised), yn(row.in_gstr1), remark(x, row)]
    }) : [Array.from({ length: cols }, () => blank())]),
    ['', '**Total**', '', '', `**${inr(list.reduce((a, x) => a + (num(x.value) || 0), 0))}**`, `**${inr(s.rowsTotal)}**`, ...(cessed ? [`**${inr(cessRows)}**`] : []), '', '', '', ''],
  ])

  const unendorsed = rr.filter(x => !String(list[x.i]?.endorsement || '').trim())
  const unauth = rr.filter(x => list[x.i]?.authorised !== 'yes')
  const notAuth = rr.filter(x => list[x.i]?.authorised === 'no')
  const bad = rr.filter(x => unendorsed.includes(x) || unauth.includes(x))
  const good = rr.filter(x => !bad.includes(x))
  const admitted = goods ? 'the goods were admitted in full in the Zone' : services ? 'the services were received' : blank('the goods were admitted in full in the Zone / the services were received')
  const optA = (one = false) => `bear${one ? 's' : ''} the specified officer's endorsement that ${admitted}, for authorised operations, as verified on ${blank('SEZ Online / the endorsed copies')}.`
  if (!list.length) p(`6.2 ${blank('endorsement of the specified officer and authorised operations, invoice by invoice')}`)
  else if (!bad.length) p(`6.2 ${ok('endorsed') ? `All invoices ${optA()}` : blank(`confirm: all invoices ${optA().replace(/[⟦⟧]/g, '')}`)}`)
  else {
    const inv = (xs) => `the invoice${xs.length > 1 ? 's' : ''} at ${sNos(xs)}`
    const why = [
      unendorsed.length ? `${inv(unendorsed)} lack${unendorsed.length > 1 ? '' : 's'} the endorsement` : '',
      unauth.length ? `${inv(unauth)} ${unauth.length > 1 ? 'are' : 'is'} ${notAuth.length === unauth.length ? 'outside' : 'not shown to be within'} the authorised operations in Letter of Approval No. ${blank('No.')} dated ${blank('DD.MM.YYYY')}` : '',
    ].filter(Boolean).join(', and ')
    p(`6.2 ${good.length ? `The invoice${good.length > 1 ? 's' : ''} at ${sNos(good)} ${optA(good.length === 1)} ` : ''}${why[0].toUpperCase()}${why.slice(1)}; the tax of ${amt(sumOf(bad))} on ${bad.length > 1 ? 'them' : 'it'} is not refundable as tax on a zero-rated supply, for the reasons in para 8.`)
  }

  const collected = rr.filter(x => list[x.i]?.collected === 'yes')
  const p63 = [`6.3 **Tax not collected from the SEZ (rule 89(2)(f)).** ${ok('not_collected') ? 'The applicant has declared that the integrated tax was not collected from the SEZ unit / developer.' : blank('confirm: the declaration under rule 89(2)(f) that the integrated tax was not collected from the SEZ unit / developer')} This was checked against ${blank('the invoices, which show the tax as "not charged to the recipient" / the payment received from the SEZ unit, which equals the taxable value without tax / the SEZ unit\'s confirmation dated DD.MM.YYYY')}.`]
  if (collected.length) p63.push(`The invoice${collected.length > 1 ? 's' : ''} at ${sNos(collected)} show${collected.length > 1 ? '' : 's'} tax charged to and paid by the SEZ unit; for ${collected.length > 1 ? 'them' : 'it'} the declaration is not correct. Under Explanation (ii) to rule 89, the incidence of that tax is deemed to have been passed on, and the condition in rule 89(2)(f) is not met, so refund of ${amt(sumOf(collected))} to the applicant is rejected under rule 92(3). Any claim of the SEZ unit itself is not barred by this order.`)
  p(p63.join(' '))

  const [g1, b3] = [num(v.tax_gstr1), num(v.tax_3b)]
  const agrees = g1 !== null && b3 !== null && same(g1, b3) && same(b3, k.claimedH.igst) && (!list.length || same(s.rowsTotal, b3))
  p(`6.4 **Tax actually paid.** The integrated tax shown in GSTR-1 Table 6B for the period (${g1 === null ? `₹${blank()}` : rs(g1)}) ${agrees ? 'agrees' : blank('agrees / does not agree')} with the tax on zero-rated supplies declared and paid in GSTR-3B Table 3.1(b) (${b3 === null ? `₹${blank()}` : rs(b3)}) and with the amount claimed (${rs(k.claimedH.igst)}).${agrees ? '' : ` ${blank('explain the difference')}`} ${confirmText('tax_matches', 'No tax so shown was later reduced by a credit note or amendment.')}`)
  if (goods) p(`6.5 The goods ${blank('are not / are')} subject to export duty (${blank('section 16(5) of the IGST Act, if in force on the date of this order')}).`)
  else if (!services) p(`6.5 ${blank('for goods only: whether the goods are subject to export duty (section 16(5) of the IGST Act, if in force on the date of this order); delete for services')}`)

  // 7. Amount admissible
  h('7. Amount admissible')
  if (!list.length) p(`7.1 ${blank('Table 1 is not filled: the tax on each invoice, and the amount admissible')}`)
  else {
    const LABEL = (key, xs) => ({
      late: 'beyond limitation (para 3)',
      'relevant date not entered': 'whose relevant date is not established (para 3)',
      'no endorsement of the specified officer': 'without the endorsement of the specified officer (para 6.2)',
      'not shown to be for authorised operations': xs.every(x => list[x.i]?.authorised === 'no') ? 'not for authorised operations (paras 6.2 and 8)' : 'not shown to be for authorised operations (para 6.2)',
      'tax collected from the SEZ unit or developer (rule 89(2)(f))': 'on which tax was collected from the SEZ unit (rule 89(2)(f); para 6.3)',
      'not shown in GSTR-1 Table 6B': 'not shown in GSTR-1 Table 6B (para 6.4)',
    })[key] || `(${key})`
    const grouped = new Map()
    for (const x of left) { const key = late(x) ? 'late' : x.why[0]; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(x) }
    const gs = [...grouped].map(([key, xs]) => `${rs(total(xs))} relating to the invoice${xs.length > 1 ? 's' : ''} at ${sNos(xs)} ${LABEL(key, xs)}`)
    const what7 = cessed ? 'integrated tax and cess' : 'integrated tax'
    const shown = s.rowsTotal + (cessed ? cessRows : 0)
    const base = shown - total(left)
    const adm = s.igst + (cessed ? s.cess : 0)
    const cap = adm < base ? ` (limited to ${b3 !== null && s.igst === b3 ? 'the integrated tax paid in GSTR-3B Table 3.1(b)' : 'the amount claimed'})` : ''
    const excl = gs.length ? ` From it, ${join(gs)} ${gs.length > 1 || left.length > 1 ? 'are' : 'is'} excluded.` : ' No invoice is excluded.'
    p(`7.1 The ${what7} shown in Table 1 is ${rs(shown)}.${excl} The amount admissible is therefore ${rs(adm)} (IGST ${rs(s.igst)}${cessed ? `, Cess ${rs(s.cess)}` : ''})${cap}, rounded to the nearest rupee (section 170).`)
    if (left.length) {
      k.caption('Invoices left out')
      k.table(['S. No. in Table 1', 'Invoice', 'IGST (₹)', ...(cessed ? ['Cess (₹)'] : []), 'Why not admissible'], [
        ...left.map(x => [String(x.i + 1), or(list[x.i]?.inv, 'No.'), inr(x.igst), ...(cessed ? [inr(x.cess)] : []), x.why.join('; ')]),
        ['', '**Total**', `**${inr(total(left, 'igst'))}**`, ...(cessed ? [`**${inr(total(left, 'cess'))}**`] : []), ''],
      ])
    }
  }

  // 8. Notice, reply and hearing; 8.4 where supplies are not for authorised operations
  hearing(k, 8, { affCol: 'Amount found not admissible on this ground (₹)' })
  if (notAuth.length) {
    const withPara = k.grounds.map((g, i) => g.para?.trim() ? i : -1).filter(i => i >= 0)
    const n8 = r.rejecting ? 4 + (withPara.length ? Math.max(...withPara) + 1 : 0) : 2
    p(`8.${n8} The supplies at ${sNos(notAuth)} of Table 1 are not for the authorised operations in Letter of Approval No. ${blank('No.')} dated ${blank('DD.MM.YYYY')} and so are not zero-rated supplies under section 16(1)(b) of the IGST Act. Being supplies to an SEZ, they remain inter-State supplies (section 7(5)(b) of the IGST Act), and the integrated tax of ${amt(sumOf(notAuth))} paid on them was correctly payable. It is not refundable.`)
  }

  // 9. Unjust enrichment: clause (e) of s.54(8), with the declaration or the CA / CMA certificate
  const doc = /declaration/.test(v.ue_doc || '') ? 'the declaration under rule 89(2)(l) (claim up to two lakh rupees)'
    : /certificate/.test(v.ue_doc || '') ? 'the certificate of a Chartered Accountant / Cost Accountant under rule 89(2)(m) (claim above two lakh rupees)'
    : blank('the declaration under rule 89(2)(l) (claim up to two lakh rupees) / the certificate of a Chartered Accountant / Cost Accountant under rule 89(2)(m) (claim above two lakh rupees)')
  statutory(k, 9, `The refund is of tax paid on a zero-rated supply to an SEZ, which is not an export, so clause (a) of section 54(8) does not apply; the amount is payable to the applicant under clause (e) only if the incidence of the tax has not been passed on. The applicant has filed ${doc}, and the declaration under rule 89(2)(f) that the tax was not collected from the SEZ unit / developer, verified as stated in para 6.3. Where tax has been recovered from the recipient, the incidence is deemed to have been passed on (Explanation (ii) to rule 89); no such recovery was found${collected.length ? ' except as stated in para 6.3' : ''}.`)
  conclusionAndOrder(k, { kind: 'tax', law: LAW, clause8: 'e', rejParas: '3, 6, 7 and 8', taxDesc: 'integrated tax paid on supplies to the SEZ' })
  closing(k)
  return k.B
}
