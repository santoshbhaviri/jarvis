// Refund Desk: the speaking order for template T2, refund of unutilised credit on export of goods
// without payment of tax under LUT (s.54(3)(i) of the CGST Act, s.16(3) of the IGST Act, rule 89(4)).
import { kit, opening, provisional, hearing, statutory, conclusionAndOrder, closing, PROV_FIRST_ZR, blank, or, date, rs, same, headsText, num, inr } from './order-kit.js'
import { UE_ZR, LAW_EXPORT, REJ_PARAS, conditions, rowsLimitation, creditPara, riskPara, computation, yesNo, remarks, plural } from './order-zr.js'

export function buildT2(c, r, office) {
  const k = kit(c, r, office)
  const { v, T, B, confirmText, name, period } = k
  const s = r.steps
  const { h, p } = k
  const list = c.rows?.exports || []

  opening(k, {
    title: 'REFUND OF UNUTILISED INPUT TAX CREDIT ON EXPORT OF GOODS WITHOUT PAYMENT OF TAX UNDER LETTER OF UNDERTAKING [SECTION 54(3)(i) OF THE CGST ACT READ WITH SECTION 16(3) OF THE IGST ACT]',
    category: 'Export of goods / services without payment of tax (accumulated ITC)',
  })

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, is a ${or(v.exporter, 'manufacturer-exporter / merchant exporter')} of ${or(v.supply_desc, 'description of goods')} falling under HSN ${or(v.supply_hsn, 'HSN')}. During ${period || blank('period')} it exported goods without payment of integrated tax under Letter of Undertaking (LUT) ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)}, furnished for financial year ${or(v.lut_fy, 'YYYY-YY')}.`)
  p(`1.2 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, k.shownHeads)}) of input tax credit accumulated on account of these zero-rated supplies, with Statement 3 listing ${list.length ? `${list.length} ${plural(list.length, 'shipping bill / bill of export', 'shipping bills / bills of export')}` : `${blank('number of')} shipping bills / bills of export`}. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 16(1)(a) of the IGST Act, export of goods is a zero-rated supply. Under section 16(3) (as substituted with effect from 01.10.2023), a registered person making zero-rated supply is eligible to claim refund of unutilised input tax credit on supply of goods without payment of integrated tax under bond or LUT, in accordance with section 54 of the CGST Act and the rules, subject to the conditions prescribed. Rule 96A of the CGST Rules prescribes the LUT. Under clause (i) of the first proviso to section 54(3) of the CGST Act, refund of unutilised input tax credit is allowed in the case of zero-rated supplies made without payment of tax.')
  p('2.2 The refund is computed under rule 89(4):')
  k.quote('**Refund Amount = (Turnover of zero-rated supply of goods + Turnover of zero-rated supply of services) × Net ITC ÷ Adjusted Total Turnover**')
  p('where "Net ITC" is the input tax credit availed on inputs and input services during the relevant period; "Turnover of zero-rated supply of goods" is the value of zero-rated supply of goods made during the relevant period without payment of tax under bond or LUT, or the value which is 1.5 times the value of like goods domestically supplied by the same or a similarly placed supplier, as declared by the supplier, whichever is less; and "Adjusted Total Turnover" is the sum of the turnover in the State as defined in section 2(112), excluding the turnover of services, and the turnover of zero-rated and non-zero-rated supply of services, excluding the value of exempt supplies other than zero-rated supplies, during the relevant period. Under the Explanation to rule 89(4), the value of goods exported is the Free on Board (FOB) value declared in the shipping bill or bill of export, or the value declared in the tax invoice, **whichever is less**.')
  p('2.3 Under the last proviso to section 54(3) ("Provided also that…"), no refund of input tax credit is allowed if the supplier avails of drawback in respect of central tax or claims refund of the integrated tax paid on such supplies. Drawback of customs duties alone does not bar the refund (para 40 of Circular No. 125/44/2019-GST). Under the second proviso to section 54(3), no refund of unutilised input tax credit is allowed where the goods exported out of India are subjected to export duty.')
  p('2.4 Under rule 89(2)(b), the application is accompanied by a statement containing the number and date of the shipping bills or bills of export and the number and date of the relevant export invoices. Realisation of export proceeds is **not** a condition for refund of ITC on export of goods (para 48 of Circular No. 125/44/2019-GST). If the proceeds are not realised within the period allowed under FEMA, the refund is to be deposited with interest under the proviso to section 16(3) of the IGST Act and rule 96B, after the event, unless the Reserve Bank of India writes off the requirement of realisation.')
  p('2.5 Under clause (a) of Explanation 2 to section 54, the relevant date for goods exported by sea or air is the date on which the ship or aircraft in which the goods are loaded leaves India; for goods exported by land, the date on which the goods pass the frontier; and for goods exported by post, the date of dispatch by the Post Office.')

  // 3. Limitation
  h('3. Limitation')
  p(`3.1 The relevant date has been checked for each shipping bill, from the export general manifest (EGM) date shown on ICEGATE, in Table 1 below.${rowsLimitation(k, r.rows, {
    noun: ['shipping bill', 'shipping bills'],
    lateTail: (nos, value, n) => `${plural(n, 'Its', 'Their')} value (lower of FOB and invoice, para 6.3) of ${rs(value)} is excluded from the turnover of zero-rated supply (but remains in Adjusted Total Turnover, as it is part of the turnover of the period).`,
  })}`)

  // 4. Other conditions
  conditions(k, 'none of the shipping bills in Statement 3 was included in an earlier claim')

  // 5. Provisional refund
  provisional(k, PROV_FIRST_ZR)

  // 6. Verification
  h('6. Verification of the exports')
  p(`6.1 **LUT.** ${confirmText('lut', `The LUT ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)} was valid for the financial year covering all invoices in this claim (rule 96A; Notification No. 37/2017-Central Tax).`)}`)
  p(`6.2 **Shipping bills, EGM and values.** ${confirmText('icegate', 'Each shipping bill in Statement 3 was checked on ICEGATE (through the back-office "ICEGATE shipping bill" view) for the shipping bill number and date, port code, EGM number and date, FOB value and the GSTIN and invoice reference, and matched with GSTR-1 Table 6A for the period (para 18 of Circular 125):')}`)
  k.caption('Table 1: Export details')
  const tot = (key) => `**${inr(r.rows.reduce((a, m) => a + (m[key] || 0), 0))}**`
  k.table(['S. No.', 'Invoice No. and date', 'Invoice value (₹)', 'Shipping bill / bill of export No. and date', 'Port code', 'EGM date (relevant date)', 'FOB value (₹)', 'Lower of FOB and invoice (₹)', 'Within two years?', 'Remarks'], [
    ...(r.rows.length ? r.rows.map((m, i) => {
      const x = list[m.i] || {}
      return [String(i + 1), or(x.inv, ''), m.inv === null ? blank() : inr(m.inv), or(x.sb, ''), or(x.port, 'port code'), date(x.egm), m.fob === null ? blank() : inr(m.fob), inr(m.value), yesNo(m), remarks(x, m)]
    }) : [Array(10).fill(blank())]),
    ['', '**Total**', tot('inv'), '', '', '', tot('fob'), tot('value'), '', ''],
  ])
  const all = r.rows.reduce((a, m) => a + (m.value || 0), 0)
  const claimedGoods = num(v.zr_goods)
  const diff = claimedGoods === null ? ''
    : same(claimedGoods, all) ? ` The turnover of zero-rated supply of goods shown in the application, ${rs(claimedGoods)}, agrees with the total of the lower values of all the shipping bills.`
      : ` The application shows ${rs(claimedGoods)} as the turnover of zero-rated supply of goods, against ${rs(all)}, the total of the lower values of all the shipping bills; the lower value is adopted, as the Explanation to rule 89(4) requires. ${blank('explain the difference, for example exchange rate differences between the invoice and the shipping bill')}`
  p(`6.3 The total of the lower values${s?.excluded ? ` of the shipping bills within limitation (leaving out ${rs(s.excluded)}, para 3.1)` : ''}, ${s ? rs(s.goods) : blank('amount')}, is taken as the turnover of zero-rated supply of goods, and the **same value** is used for the exports within the Adjusted Total Turnover, so that the numerator and the denominator are consistent (Circular No. 147/03/2021-GST; para 3 of Circular No. 197/09/2023-GST).${s?.excluded ? ` The shipping bills left out for limitation remain in the Adjusted Total Turnover at their lower value of ${rs(s.excluded)}.` : ''}${diff}`)
  p(`6.4 **1.5 times the domestic value.** ${confirmText('domestic', 'The applicant has declared that neither it nor, to its knowledge, a similarly placed supplier made domestic supplies of like goods for which a value can be determined, and nothing on record shows otherwise, so the export value is adopted.')}`)
  const dbk = {
    none: 'The applicant has not claimed drawback of central tax, nor refund of integrated tax on these exports.',
    'customs portion only': 'The applicant has not claimed drawback of central tax, nor refund of integrated tax on these exports. Drawback of customs duties alone, claimed on these exports, does not bar the refund (para 40 of Circular 125).',
    'including central tax': `Drawback including the central tax portion was claimed on shipping bills ${blank('S. Nos.')}. Under the last proviso to section 54(3), refund of central tax and integrated tax credit attributable to those exports is not admissible; refund of State tax credit attributable to them remains admissible (para 40 of Circular 125), and para 7 is computed head-wise accordingly: ${blank('working')}.`,
  }[v.drawback] || blank('drawback and IGST refund claimed on these exports, if any')
  p(`6.5 **Drawback and IGST refund.** The shipping bills were filed under scheme code ${blank('scheme code')}. ${dbk}`)
  p(`6.6 **Export duty.** ${v.export_duty === 'no' ? 'The goods exported are not subject to export duty.' : v.export_duty === 'yes' ? `The goods exported are subject to export duty under ${blank('entry')}, so no refund is admissible for shipping bills ${blank('S. Nos.')} under ${blank('the second proviso to section 54(3) of the CGST Act / section 54(15) of the CGST Act and section 16(5) of the IGST Act, whichever is in force on the date of this order')}.` : blank('whether the goods exported are subject to export duty')}`)
  creditPara(k, '6.7')
  riskPara(k, '6.8')

  // 7. Computation
  computation(k, {
    comp: [
      ['zr_goods', 'Turnover of zero-rated supply of goods (A)', s ? s.goods : undefined, 'Table 1, lower of FOB and invoice, within limitation', '3.1 and 6.3'],
      ['zr_services', 'Turnover of zero-rated supply of services (B)', s ? s.services || 0 : undefined, num(v.zr_services) ? 'Statement 3 for services' : 'Nil'],
      ['ato', 'Adjusted Total Turnover (C)', s ? s.ato : undefined, 'GSTR-3B Table 3.1(a) and (b) only (rows (c) nil-rated / exempt, (d) inward reverse charge and (e) non-GST excluded: sections 2(112) and 2(47), rule 89(4)(E)), with all exports of the period (including any excluded for limitation in para 3.1) at the value determined under rule 89(4)(C) and its Explanation'],
      ['net_itc', 'Net ITC (D)', s ? s.net : undefined, 'GSTR-3B Table 4A(1) to 4A(5) less capital goods and ineligible credit (para 6.7)'],
    ],
    A: s?.goods, B: s?.services, leftNoun: 'Shipping bill',
    splitText: '7.3 Head-wise split. The admissible amount (other than cess) is taken from the credit ledger in the order in which it was debited: integrated tax first, then central tax and State tax equally (para 37 of Circular 125):',
  })

  hearing(k, 8)
  statutory(k, 9, UE_ZR)
  p('9.6 **Realisation of export proceeds.** As stated in para 2.4, realisation of export proceeds is not a condition for this refund. The applicant is reminded that under the proviso to section 16(3) of the IGST Act and rule 96B, if the proceeds of these exports are not realised within the period allowed under the Foreign Exchange Management Act, 1999 (including any extension), the refund relating to the unrealised exports is to be deposited with interest under section 50 within thirty days of the expiry of that period, failing which it will be recovered.')
  conclusionAndOrder(k, { kind: 'itc', law: LAW_EXPORT, clause8: 'a', rejParas: REJ_PARAS })
  closing(k)
  return B
}
