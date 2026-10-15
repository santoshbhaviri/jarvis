// Refund Desk: the speaking order for template T3, refund of unutilised credit on export of services
// without payment of tax under LUT (s.54(3)(i) of the CGST Act, s.16(3) of the IGST Act, rule 89(4)).
import { kit, opening, provisional, hearing, statutory, conclusionAndOrder, closing, PROV_FIRST_ZR, blank, or, date, rs, same, headsText, num, inr } from './order-kit.js'
import { UE_ZR, LAW_EXPORT, REJ_PARAS, conditions, rowsLimitation, creditPara, riskPara, computation, servicesD, yesNo, remarks, plural, listAnd } from './order-zr.js'

export function buildT3(c, r, office) {
  const k = kit(c, r, office)
  const { v, T, B, ok, confirmText, name, period } = k
  const s = r.steps
  const { h, p } = k
  const list = c.rows?.remits || []

  opening(k, {
    title: 'REFUND OF UNUTILISED INPUT TAX CREDIT ON EXPORT OF SERVICES WITHOUT PAYMENT OF TAX UNDER LETTER OF UNDERTAKING [SECTION 54(3)(i) OF THE CGST ACT READ WITH SECTION 16(3) OF THE IGST ACT]',
    category: 'Export of goods / services without payment of tax (accumulated ITC)',
  })

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, supplies ${or(v.supply_desc, 'description of services')} under SAC ${or(v.supply_hsn, 'SAC')} to ${or(v.recipients, 'number of recipients and the country or countries where they are located')}, under ${or(v.agreement, 'agreement(s) with dates')}. During ${period || blank('period')} it supplied these services without payment of integrated tax under Letter of Undertaking (LUT) ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)}, furnished for financial year ${or(v.lut_fy, 'YYYY-YY')}.`)
  p(`1.2 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, k.shownHeads)}) of input tax credit accumulated on account of these supplies, with Statement 3 listing ${list.length ? `${list.length} ${plural(list.length, 'invoice', 'invoices')}` : `${blank('number of')} invoices`} and the related foreign inward remittance certificates (FIRCs) / bank realisation certificates (BRCs) / e-BRCs. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 2(6) of the IGST Act, "export of services" means the supply of a service when (i) the supplier is located in India; (ii) the recipient is located outside India; (iii) the place of supply is outside India; (iv) the payment for the service has been received by the supplier in convertible foreign exchange or in Indian rupees wherever permitted by the Reserve Bank of India; and (v) the supplier and the recipient are not merely establishments of a distinct person in accordance with Explanation 1 to section 8.')
  p(`2.2 Where the supplier or the recipient is located outside India, the place of supply is decided under section 13 of the IGST Act. The general rule in section 13(2) is the location of the recipient. Sub-sections (3) to (7) and (10) to (12) of section 13 contain specific rules (for example, services performed on goods physically made available by the recipient, or services that need the physical presence of the recipient, under section 13(3)); section 13(8) makes the location of the supplier the place of supply for the services listed there; and section 13(13) allows the Government to notify the place of effective use and enjoyment. Clause (b) of section 13(8), which covered intermediary services, was omitted by section 157 of the Finance Act, 2026, with effect from ${blank('date of commencement of section 157: the law text records only the date of the Act, 30.03.2026, and no separate notification has been seen; confirm before use')}. The omission is prospective: for supplies made before that date, the place of supply of intermediary services remains the location of the supplier, and whether a supply is an intermediary service is decided on the tests in Circular No. 159/15/2021-GST.`)
  p('2.3 Under section 16(1)(a) of the IGST Act, export of services is a zero-rated supply, and under section 16(3) (as substituted with effect from 01.10.2023) the supplier may make it under LUT without payment of integrated tax and claim refund of unutilised input tax credit. The refund is computed under rule 89(4):')
  k.quote('**Refund Amount = (Turnover of zero-rated supply of goods + Turnover of zero-rated supply of services) × Net ITC ÷ Adjusted Total Turnover**')
  p('where "Turnover of zero-rated supply of services" is the aggregate of the payments received during the relevant period for zero-rated supply of services and zero-rated supply of services completed during the period for which payment had been received in advance in an earlier period, reduced by advances received for zero-rated supply of services not completed during the period (rule 89(4)(D)); "Net ITC" is credit availed on inputs and input services during the period; and "Adjusted Total Turnover" includes the turnover of zero-rated supply of services **determined in the same manner under clause (D)** and of non-zero-rated supply of services, excluding the value of exempt supplies other than zero-rated supplies (rule 89(4)(E)).')
  p('2.4 Under rule 89(2)(c), the application is accompanied by a statement containing the number and date of invoices and the relevant BRCs or FIRCs. Under clause (c) of Explanation 2 to section 54, the relevant date for services exported is the date of receipt of payment in convertible foreign exchange or in Indian rupees wherever permitted by the RBI, where the supply had been completed before the payment; or the date of issue of the invoice, where payment had been received in advance of the invoice.')
  p('2.5 Circular No. 161/17/2021-GST clarifies when a supplier in India and a recipient outside India are establishments of a distinct person. Circular No. 202/14/2023-GST clarifies that payment received in Indian rupees through a Special Rupee Vostro Account, as permitted by the RBI, satisfies section 2(6)(iv).')

  // 3. Limitation
  h('3. Limitation')
  p(`3.1 The relevant date under clause (c) of Explanation 2 has been checked for each invoice, from the date of the related remittance (or the invoice date for advances), in Table 1.${rowsLimitation(k, r.rows, {
    noun: ['remittance', 'remittances'],
    lateTail: (nos, value, n) => `${plural(n, 'Its', 'Their')} value of ${rs(value)} is excluded from the turnover of zero-rated supply of services, but, being ${plural(n, 'a payment', 'payments')} received in the relevant period, remains in the zero-rated services value within Adjusted Total Turnover.`,
  })}`)

  // 4. Other conditions
  conditions(k, 'no remittance in Statement 3 was used in an earlier claim')

  // 5. Provisional refund
  provisional(k, PROV_FIRST_ZR)

  // 6. Verification
  h('6. Verification that the supplies are exports of services')
  let n6 = 1
  const N = () => `6.${n6++}`
  p(`${N()} The ${or(v.agreement, 'agreement(s) with dates')}, the invoices and the FIRCs / e-BRCs were examined against each condition of section 2(6):`)
  k.caption('Table A: Conditions of section 2(6) of the IGST Act')
  const sat = (x = 'Satisfied') => ok('export_2_6') ? x : blank('Satisfied / Not satisfied because …')
  const fircs = list.map(x => String(x.firc || '').trim()).filter(Boolean)
  k.table(['Condition', 'Evidence examined', 'Finding'], [
    ['(i) Supplier located in India', `Registration certificate; place of business at ${or(v.address, 'principal place of business')}`, 'Satisfied'],
    ['(ii) Recipient located outside India', `Agreement(s); recipients: ${or(v.recipients, 'number of recipients and the country or countries where they are located')}`, sat()],
    ['(iii) Place of supply outside India', 'Nature of service and section 13 analysis in para 6.2', sat()],
    ['(iv) Payment in convertible foreign exchange or permitted INR', `FIRCs / e-BRCs Nos. ${fircs.length ? listAnd(fircs) : blank('Nos.')}`, sat()],
    ['(v) Not merely establishments of a distinct person', `Recipient is ${blank('an unrelated entity / a related but separately incorporated entity (a subsidiary or holding company is a separate person: Circular 161/17/2021)')}`, sat()],
  ])
  p(`${N()} **Place of supply.** The service consists of ${or(v.supply_desc, 'description of the service')}: ${blank('in two or three lines, what the applicant actually does, for whom, and how it is delivered')}. ${blank('Option A: it is not a service covered by sub-sections (3) to (13) of section 13, so under section 13(2) the place of supply is the location of the recipient, outside India / Option B: more than one kind of service, each examined separately / Option C: intermediary, for supplies before the omission of section 13(8)(b), applying the tests in Circular 159/15/2021')}`)

  const n63 = N()
  p(`${n63} **Payments received.** The turnover of zero-rated supply of services under rule 89(4)(D) for the period is worked out from the FIRCs / e-BRCs, matched to invoices and GSTR-1 Table 6A:`)
  k.caption('Table 1: Invoices and remittances')
  const tot = (key) => `**${inr(list.reduce((a, x) => a + (num(x[key]) || 0), 0))}**`
  k.table(['S. No.', 'Invoice No. and date', 'Invoice value (₹)', 'FIRC / e-BRC No. and date (relevant date)', 'Amount realised (₹)', 'Advance or after supply?', 'Within two years?', 'Remarks'], [
    ...(r.rows.length ? r.rows.map((m, i) => {
      const x = list[m.i] || {}
      return [String(i + 1), `${or(x.inv, 'Invoice No.')} dated ${date(x.inv_date)}`, num(x.inv_value) === null ? blank() : inr(num(x.inv_value)), `${or(x.firc, 'FIRC / e-BRC No.')} dated ${date(x.firc_date)}`, num(x.realised) === null ? blank() : inr(num(x.realised)), or(x.advance, 'advance / after supply'), yesNo(m), remarks(x, m)]
    }) : [Array(8).fill(blank())]),
    ['', '**Total**', tot('inv_value'), '', tot('realised'), '', '', ''],
  ])
  const fromD = servicesD(k)
  const claimedSv = num(v.zr_services)
  if (fromD !== null && claimedSv !== null && !same(fromD, claimedSv)) p(`The application shows ${rs(claimedSv)} as the turnover of zero-rated supply of services; the value worked out under rule 89(4)(D), ${rs(fromD)}, is adopted.`)

  const short = r.rows.map((m, i) => ({ i, x: list[m.i] || {} })).filter(({ x }) => num(x.realised) !== null && num(x.inv_value) !== null && num(x.realised) + 1 < num(x.inv_value))
  if (short.length) p(`${N()} ${short.map(({ i, x }) => `The amount realised against invoice ${or(x.inv, 'No.')} (S. No. ${i + 1}) is less than the invoice by ${rs(num(x.inv_value) - num(x.realised))}`).join('; ')}. ${blank('withheld as tax by the recipient\'s country, or other reason; that amount is treated as received / not received, because …')}`)

  p(`${N()} **LUT.** ${confirmText('lut', `The LUT ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)} covers the period of all invoices (rule 96A).`)}`)
  creditPara(k, N())
  riskPara(k, N())

  // 7. Computation
  computation(k, {
    comp: [
      ['zr_services', 'Turnover of zero-rated supply of services (A)', s ? s.numerator : undefined, `Para ${n63}, rule 89(4)(D), within limitation`, `3.1 and ${n63}`],
      ['zr_goods', 'Turnover of zero-rated supply of goods (B)', 0, 'Nil'],
      ['ato', 'Adjusted Total Turnover (C)', s ? s.ato : undefined, 'GSTR-3B Table 3.1(a) and (b) only (rows (c) nil-rated / exempt, (d) inward reverse charge and (e) non-GST excluded: sections 2(112) and 2(47), rule 89(4)(E)): turnover of goods + zero-rated services at the full rule 89(4)(D) value of the period (including remittances excluded from (A) for limitation, para 3.1) + non-zero-rated services'],
      ['net_itc', 'Net ITC (D)', s ? s.net : undefined, 'GSTR-3B Table 4A(1) to 4A(5) less capital goods and ineligible credit'],
    ],
    A: s?.numerator, B: 0, leftNoun: 'Invoice and remittance',
  })

  hearing(k, 8)
  statutory(k, 9, UE_ZR)
  conclusionAndOrder(k, { kind: 'itc', law: LAW_EXPORT, clause8: 'a', rejParas: REJ_PARAS })
  closing(k)
  return B
}
