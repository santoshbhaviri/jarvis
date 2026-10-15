// Refund Desk: the speaking order for template T4, refund of unutilised credit on supplies to an SEZ
// unit or developer without payment of tax under LUT (s.54(3)(i) of the CGST Act, s.16(1)(b) and
// s.16(3) of the IGST Act, rule 89(4)).
import { kit, opening, provisional, hearing, statutory, conclusionAndOrder, closing, PROV_FIRST_ZR, blank, or, date, rs, same, headsText, num, inr, ddmmyyyy, monthName } from './order-kit.js'
import { REJ_PARAS, conditions, extraTime, creditPara, riskPara, computation, servicesD, yesNo, remarks, plural, listAnd } from './order-zr.js'

const UE_SEZ = 'The refund is of unutilised input tax credit on zero-rated supplies, payable to the applicant under clause (b) of section 54(8) (a supply to an SEZ is zero-rated but is not an export, which is what clause (a) covers). The question of unjust enrichment does not arise, and no certificate or declaration under rule 89(2)(l) or (m) is required (provisos to rule 89(2)(l) and (m)).'
const LAW_SEZ = 'clause (i) of the first proviso to section 54(3) of the CGST Act and sections 16(1)(b) and 16(3) of the IGST Act, read with rule 89(4)'
const LIMIT_WHY = /^beyond two years/

export function buildT4(c, r, office) {
  const k = kit(c, r, office)
  const { v, T, B, confirmText, name, period } = k
  const s = r.steps
  const { h, p } = k
  const list = c.rows?.sez || []
  const gs = v.goods_or_services
  const services = gs === 'services'
  const unendorsed = list.filter(x => !String(x.endorsement || '').trim()).length
  const what = gs === 'goods' ? 'goods' : services ? 'services' : 'goods / services'

  opening(k, {
    title: 'REFUND OF UNUTILISED INPUT TAX CREDIT ON SUPPLIES MADE TO A SPECIAL ECONOMIC ZONE UNIT / DEVELOPER WITHOUT PAYMENT OF TAX UNDER LETTER OF UNDERTAKING [SECTION 54(3)(i) OF THE CGST ACT READ WITH SECTIONS 16(1)(b) AND 16(3) OF THE IGST ACT]',
    category: 'On account of supplies made to SEZ unit / SEZ developer (without payment of tax)',
  })

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, supplied ${or(v.supply_desc, `description of ${what}`)} under ${gs === 'goods' ? 'HSN' : services ? 'SAC' : 'HSN / SAC'} ${or(v.supply_hsn, gs === 'goods' ? 'HSN' : services ? 'SAC' : 'HSN / SAC')} to ${or(v.sez_name, 'SEZ unit(s) / developer(s) and the name of the SEZ')} during ${period || blank('period')}, without payment of integrated tax under Letter of Undertaking (LUT) ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)}, furnished for financial year ${or(v.lut_fy, 'YYYY-YY')}.`)
  p(`1.2 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, k.shownHeads)}) of input tax credit accumulated on account of these supplies, with Statement 5 listing ${list.length ? `${list.length} ${plural(list.length, 'invoice', 'invoices')}` : `${blank('number of')} invoices`}${unendorsed && unendorsed < list.length ? `, of which ${list.length - unendorsed} ${plural(list.length - unendorsed, 'bears', 'bear')} the endorsement of the specified officer of the SEZ (para 6.2)` : unendorsed ? ', none of which bears the endorsement of the specified officer of the SEZ (para 6.2)' : ' endorsed by the specified officer of the SEZ'}. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 16(1)(b) of the IGST Act, as amended with effect from 01.10.2023, a supply of goods or services or both **for authorised operations** to a Special Economic Zone developer or a Special Economic Zone unit is a zero-rated supply. Under section 16(3) (as substituted with effect from 01.10.2023), such a supply may be made under LUT without payment of integrated tax, with refund of unutilised input tax credit under clause (i) of the first proviso to section 54(3) of the CGST Act. The LUT provisions of rule 96A(1) apply to such supplies by rule 96A(6).')
  p('2.2 Under the proviso to rule 89(1) relating to supplies to a Special Economic Zone (which rule 89(2)(d) and (e) still describe as the second proviso), in respect of supplies to an SEZ unit or developer, the application is to be filed by the supplier of goods after the goods have been admitted in full in the SEZ for authorised operations, as endorsed by the specified officer of the Zone; and by the supplier of services along with evidence of receipt of the services for authorised operations, as endorsed by the specified officer of the Zone. Rule 89(2)(d) and (e) require the corresponding statements of invoices with that endorsement. Under the Explanation to rule 89(1), "specified officer" means a specified officer or an authorised officer as defined in rule 2 of the SEZ Rules, 2006.')
  p('2.3 The refund is computed under rule 89(4):')
  k.quote('**Refund Amount = (Turnover of zero-rated supply of goods + Turnover of zero-rated supply of services) × Net ITC ÷ Adjusted Total Turnover**')
  p('with the meanings given in rule 89(4)(A) to (F). The Explanation to rule 89(4) (FOB or invoice value, whichever is less) governs only goods exported out of India, so for supplies of goods to an SEZ the invoice value is taken, subject to the limit of 1.5 times the value of like goods supplied domestically (rule 89(4)(C)). For supplies of services, the turnover is the payments received during the period, worked out under rule 89(4)(D), and the same value is used inside the Adjusted Total Turnover (rule 89(4)(E)(b)).')
  p('2.4 Under clause (ba) of Explanation 2 to section 54, the relevant date for zero-rated supply to an SEZ developer or unit, where refund is claimed of the input tax credit used in such supplies, is the due date for furnishing the return under section 39 in respect of such supplies.')

  // 3. Limitation: month by month (the GSTR-3B due date of the invoices' month)
  h('3. Limitation')
  const months = []
  if (r.rows.length) {
    for (const m of r.rows) {
      const ym = /^\d{4}-\d{2}/.test(list[m.i]?.inv_date || '') ? list[m.i].inv_date.slice(0, 7) : null
      if (!ym || !m.relevant) continue
      let g = months.find(x => x.ym === ym)
      if (!g) months.push(g = { ym, relevant: m.relevant, ends: m.ends, inTime: m.inTime, covid: m.covid, value: 0 })
      if (m.inTime === false) g.value += m.value || 0
    }
  } else for (const m of r.limitation) months.push({ ym: m.month, relevant: m.relevant, ends: m.ends, inTime: m.inTime, covid: m.covid, value: null })
  months.sort((a, b) => a.ym < b.ym ? -1 : 1)
  if (months.length) {
    const first = months[0], late = months.filter(m => m.inTime === false), unsure = months.filter(m => m.inTime !== false && !m.inTime)
    const lateValue = late.reduce((a, m) => a + (m.value || 0), 0)
    const allIn = !late.length && !unsure.length
    p(`3.1 The invoices in this claim are of ${listAnd(months.map(m => monthName(m.ym)))}. The due date for the GSTR-3B of ${monthName(first.ym)} was ${ddmmyyyy(first.relevant)}, which is the earliest relevant date under clause (ba); two years from it end on ${ddmmyyyy(first.ends)}. The application, filed on ${date(v.filed)}, is within time for ${allIn ? 'all invoices' : 'the invoices of the other months'}.${late.length ? ` Invoices of ${listAnd(late.map(m => monthName(m.ym)))}, whose relevant date${plural(late.length, ' was', 's were')} ${listAnd(late.map(m => ddmmyyyy(m.relevant)))}, are beyond two years; their value of ${r.rows.length ? rs(lateValue) : blank('amount')} is excluded from the zero-rated turnover (it remains in the Adjusted Total Turnover).` : ''}${unsure.length ? ` ${blank(`limitation for ${listAnd(unsure.map(m => monthName(m.ym)))}`)}` : ''}${extraTime(k, months)}`)
  } else p(`3.1 ${blank('limitation: months of the invoices, the GSTR-3B due dates and the filing date')}`)

  // 4. Other conditions
  conditions(k, 'no invoice in the statement was used in an earlier claim')

  // 5. Provisional refund
  provisional(k, PROV_FIRST_ZR)

  // 6. Verification
  h('6. Verification of the supplies to the SEZ')
  let n6 = 1
  const N = () => `6.${n6++}`
  p(`${N()} **Endorsement and authorised operations.** Each invoice was checked against the endorsement of the specified officer ${blank('on the SEZ Online system / on the copy of the invoice')}, and against the Letter of Approval of the SEZ unit / developer and its list of authorised operations:`)
  k.caption('Table 1: Invoices to the SEZ')
  k.table(['S. No.', 'Invoice No. and date', 'SEZ unit / developer (GSTIN)', 'Goods / services', 'Taxable value (₹)', 'Endorsement (bill of entry / SEZ Online request No. and date of admission or receipt)', 'Covered by the authorised operations?', 'Within two years?', 'Remarks'], [
    ...(r.rows.length ? r.rows.map((m, i) => {
      const x = list[m.i] || {}
      return [String(i + 1), `${or(x.inv, 'Invoice No.')} dated ${date(x.inv_date)}`, or(x.unit, 'SEZ unit (GSTIN)'), or(x.desc, 'goods / services'), inr(m.value), String(x.endorsement || '').trim() || 'Not endorsed', x.authorised === 'yes' ? 'Yes' : x.authorised === 'no' ? 'No' : blank('Yes / No'), yesNo(m), remarks(x, m)]
    }) : [Array(9).fill(blank())]),
    ['', '**Total**', '', '', `**${inr(r.rows.reduce((a, m) => a + (m.value || 0), 0))}**`, '', '', '', ''],
  ])
  const bad = r.rows.map((m, i) => ({ ...m, sno: i + 1, cond: m.why.filter(w => !LIMIT_WHY.test(w) && w !== 'relevant date not entered') })).filter(m => m.cond.length)
  const n62 = N()
  if (bad.length) {
    const value = bad.reduce((a, m) => a + (m.value || 0), 0)
    const noLoa = bad.some(m => m.cond.some(w => /authorised/.test(w)))
    p(`${n62} ${plural(bad.length, 'The invoice at S. No.', 'The invoices at S. Nos.')} ${listAnd(bad.map(m => String(m.sno)))} ${plural(bad.length, 'does', 'do')} not meet the proviso to rule 89(1) and rule 89(2)(d) and (e), for the reason${plural(bad.length, '', 's')} shown in Table 1 (${bad.map(m => `S. No. ${m.sno}: ${m.cond.join('; ')}`).join('; ')}).${noLoa ? ` The authorised operations were checked against the Letter of Approval No. ${blank('No.')} dated ${blank('DD.MM.YYYY')}.` : ''} ${plural(bad.length, 'Its', 'Their')} value of ${rs(value)} is not a zero-rated supply under section 16(1)(b) and is excluded from the zero-rated turnover, for the reasons in para 8. ${plural(bad.length, 'It remains', 'They remain')} in the Adjusted Total Turnover, as part of the turnover of the period (para 7.1).`)
    if (r.rows.length > bad.length) p(`The other invoices bear the specified officer's endorsement that the ${gs === 'goods' ? 'goods were admitted in full in the Zone' : services ? 'services were received' : 'goods were admitted in full in the Zone / the services were received'}, for authorised operations.`)
  } else p(`${n62} ${confirmText('endorsed', `All invoices bear the specified officer's endorsement that the ${gs === 'goods' ? 'goods were admitted in full in the Zone' : services ? 'services were received' : 'goods were admitted in full in the Zone / the services were received'}, for authorised operations.`)}`)

  const all = r.rows.reduce((a, m) => a + (m.value || 0), 0)
  const claimedZR = (num(v.zr_goods) || 0) + (num(v.zr_services) || 0)
  p(`${N()} **Match with returns.** The invoices were matched with GSTR-1 Table 6B and the GSTR-3B for the period (Table 3.1(b)).${r.rows.length && claimedZR ? same(all, claimedZR) ? ` The invoices in Table 1 add up to ${rs(all)}, the zero-rated turnover shown in the application.` : ` The invoices in Table 1 add up to ${rs(all)}, against ${rs(claimedZR)} shown in the application as the zero-rated turnover: ${blank('explain the difference')}.` : ''}${gs === 'goods' ? ` ${confirmText('domestic', 'No like goods were supplied domestically, by the applicant or, to its knowledge, by a similarly placed supplier, at a value 1.5 times which is less than the invoice value, so the invoice value is adopted (rule 89(4)(C)).')}` : ''}`)
  p(`${N()} **LUT and rule 89(2)(f) declaration.** ${confirmText('lut', `The LUT ARN ${or(v.lut_arn, 'LUT ARN')} dated ${date(v.lut_date)} covers the period of all invoices (rule 96A(1) read with rule 96A(6)).`)} ${confirmText('not_collected', 'The declaration under rule 89(2)(f) that tax has not been collected from the SEZ unit / developer has been filed, and the invoices in Table 1 show no tax charged.')}`)
  let n65 = null
  if (services || (gs !== 'goods' && s?.fromD !== null && s?.fromD !== undefined)) {
    n65 = N()
    p(`${n65} **Payments for services.** The turnover of zero-rated supply of services under rule 89(4)(D) is worked out as follows:`)
    servicesD(k)
  }
  creditPara(k, N())
  riskPara(k, N())

  // 7. Computation: with invoices in Table 1, the zero-rated turnover is the invoices kept, under goods or services
  const zr = s ? (r.rows.length ? s.numerator : null) : undefined
  const A = s ? (r.rows.length ? (services ? 0 : zr) : s.goods || 0) : undefined
  const Bv = s ? (r.rows.length ? (services ? zr : 0) : s.services || 0) : undefined
  const leftParas = ['3.1', n62].join(' and ')
  computation(k, {
    comp: [
      ['zr_goods', 'Turnover of zero-rated supply of goods (A)', A, services ? 'Nil' : 'Table 1, endorsed invoices within limitation, subject to rule 89(4)(C)', leftParas],
      ['zr_services', 'Turnover of zero-rated supply of services (B)', Bv, services ? `Table 1${n65 ? ` and para ${n65}, rule 89(4)(D)` : ''}, endorsed invoices within limitation` : n65 ? `Para ${n65}, rule 89(4)(D)` : 'Nil', leftParas],
      ['ato', 'Adjusted Total Turnover (C)', s ? s.ato : undefined, 'GSTR-3B Table 3.1(a) and (b) only (rows (c) nil-rated / exempt, (d) inward reverse charge and (e) non-GST excluded: sections 2(112) and 2(47), rule 89(4)(E)), with SEZ supplies of goods at the value adopted under rule 89(4)(C), services at the rule 89(4)(D) value, and all SEZ invoices of the period, including those excluded in paras 3.1 and 6.2'],
      ['net_itc', 'Net ITC (D)', s ? s.net : undefined, 'GSTR-3B Table 4A(1) to 4A(5) less capital goods and ineligible credit'],
    ],
    A, B: Bv, leftNoun: 'Invoice',
  })

  hearing(k, 8)
  statutory(k, 9, UE_SEZ)
  conclusionAndOrder(k, { kind: 'itc', law: LAW_SEZ, clause8: 'b', rejParas: REJ_PARAS })
  closing(k)
  return B
}
