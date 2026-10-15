// Refund Desk: the speaking order (FORM GST RFD-06) for an inverted-duty refund, built from
// template T1 of the office's refund standard, with the facts the officer confirmed and the figures
// from compute.js. The result is a list of blocks that word.js turns into the letterhead .docx
// and the review screen previews.
//
// Blocks: { t: 'h', text } heading · { t: 'p', text } paragraph · { t: 'table', head, rows }
//         { t: 'sign' } · { t: 'quote', text } (the formula)
// In text, **bold** is bold and ⟦…⟧ is something still to fill in: it prints as [ … ] on yellow,
// so nothing unfinished can go out unnoticed.
import { HEADS, HEAD_LABEL, CONFIRMS } from './fields.js'
import { num, inr, words, ddmmyyyy, monthName } from './compute.js'

// The office. Change here if the office, officer or appellate authority changes.
export const OFFICE = {
  officer: 'Dr. B. Santosh Kumar',
  desig: 'Assistant Commissioner of Central Tax',
  division: 'Sangareddy CGST Division',
  commrte: 'Medchal CGST Commissionerate',
  address: 'Plot No. 328, SSR Arcade, Mathrusri Nagar, Miyapur, Hyderabad – 500 049',
  phone: '79012 43259',
  email: 'cgst.sgrdiv@gov.in',
  appeal: 'the Commissioner (Appeals-II), Hyderabad, Headquarters Office, 7th Floor, L.B. Stadium Road, Basheerbagh, Hyderabad – 500 004',
  state: 'Telangana',
}

const blank = (what = ' ') => `⟦${what}⟧`
const or = (x, what) => (x !== undefined && x !== null && String(x).trim() !== '') ? String(x).trim() : blank(what)
const date = (s, what = 'DD.MM.YYYY') => ddmmyyyy(s) || blank(what)
const rs = (n) => `₹${inr(n || 0)}`
const exact = (n) => inr(n, 2)
const same = (a, b) => Math.abs((num(a) ?? NaN) - (num(b) ?? NaN)) < 1
const headsText = (o, only = ['igst', 'cgst', 'sgst', 'cess'], skipNil = false) =>
  only.filter(h => (h !== 'cess' || o.cess) && (!skipNil || o[h])).map(h => `${HEAD_LABEL[h]} ${rs(o[h])}`).join(', ')

export function buildOrder(c, r, office = OFFICE) {
  const v = c.v, s = r.steps, H = r.heads, T = r.total
  const ok = (k) => !!c.confirm?.[k]
  const confirmText = (k, yes) => ok(k) ? yes : blank(`confirm: ${CONFIRMS.find(x => x.key === k).text}`)
  const period = v.from === v.to || !v.to ? monthName(v.from) : `${monthName(v.from)} to ${monthName(v.to)}`
  const name = or(v.legal_name, 'Legal name')
  const claimedH = Object.fromEntries(HEADS.map(h => [h, H[h].claimed]))
  const admH = Object.fromEntries(HEADS.map(h => [h, H[h].admissible]))
  const rejH = Object.fromEntries(HEADS.map(h => [h, H[h].rejected]))
  const provH = Object.fromEntries(HEADS.map(h => [h, H[h].prov]))
  const cess = T.claimed && H.cess.claimed > 0
  const shownHeads = HEADS.filter(h => h !== 'cess' || cess)
  const late = r.daysLeft !== null && r.daysLeft < 0
  const grounds = (c.grounds || []).filter(g => g.text?.trim())
  const n = c.notice || {}
  const prov = T.prov > 0
  const B = []
  const h = (text) => B.push({ t: 'h', text })
  const p = (text) => B.push({ t: 'p', text })
  const table = (head, rows) => B.push({ t: 'table', head, rows })

  B.push({ t: 'letterhead' })
  B.push({ t: 'title', lines: [
    'FORM GST RFD-06 [See rules 92(1), 92(3), 92(4), 92(5) and 96(7)]',
    'SPEAKING ORDER ANNEXED TO THE REFUND SANCTION / REJECTION ORDER',
    'REFUND OF UNUTILISED INPUT TAX CREDIT ON ACCOUNT OF INVERTED DUTY STRUCTURE [SECTION 54(3)(ii) OF THE CGST ACT]',
  ] })

  table(['Particulars', 'Details'], [
    ['Order No. and date', `${or(c.order?.no, 'Order No.')} dated ${date(c.order?.date)}`],
    ['Reference No. (RFN) / DIN', `RFN ${or(c.order?.rfn, 'RFN')} generated on the common portal`],
    ['Name and address of the applicant', `${name}${v.trade_name ? ` (${v.trade_name})` : ''}, ${or(v.address, 'principal place of business')}`],
    ['GSTIN', or(v.gstin, 'GSTIN')],
    ['Refund category as selected in RFD-01', 'Refund of ITC accumulated due to inverted tax structure'],
    ['Tax period(s)', period || blank('period')],
    ['ARN and date of filing of RFD-01', `${or(v.arn, 'ARN')} dated ${date(v.filed)}`],
    ['Acknowledgement (RFD-02)', `Issued on ${date(v.ack)}`],
    ['Date of receipt of the application for section 54(7) and section 56', `${date(v.filed)}, the date of filing (ARN), as indicated in RFD-02 (rule 90(2)); sixty days end on ${date(r.sixty)}`],
    ['Provisional refund (RFD-04)', prov ? `RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)} for ${rs(T.prov)}` : 'Not granted, reasons in para 5'],
    ['Notice (RFD-08) and reply (RFD-09)', r.rejecting ? `RFD-08 No. ${or(n.no, 'No.')} dated ${date(n.date)}; ${n.reply ? `reply dated ${date(n.reply)}` : 'no reply received'}` : 'Not issued, as the claim is sanctioned in full'],
    ['Personal hearing', r.rejecting ? `${date(n.hearing)}, attended by ${or(n.attended, 'designation of the authorised representative')}` : 'Not required, as the claim is sanctioned in full'],
    ['Amount claimed', `${shownHeads.map(x => `${HEAD_LABEL[x]} ${rs(claimedH[x])}`).join('; ')}; Total ${rs(T.claimed)}`],
    ['Result', `Sanctioned ${rs(T.admissible)}; Rejected ${rs(T.rejected)}; Adjusted against dues / withheld ₹0 (head-wise details in para 11)`],
  ])

  h('IMPORTANT NOTE FOR THE APPLICANT')
  p('1. This copy is granted free of charge for the private use of the person to whom it is issued.')
  p(`2. Any person aggrieved by this order may appeal under section 107(1) of the Central Goods and Services Tax Act, 2017 (the CGST Act) to ${office.appeal} (rule 109A(1)(b) of the CGST Rules, 2017) within **three months** from the date on which this order is communicated. Under section 107(4), the Appellate Authority may allow a further period of **one month** if satisfied that there was sufficient cause.`)
  p('3. The appeal is to be filed **electronically in FORM GST APL-01 on the common portal**, with the documents uploaded there (rule 108). No court fee stamp is required. As this order is available on the common portal, no copy of it need be filed; if it is not available there, a self-certified copy is to be submitted within seven days of filing APL-01, failing which the appeal is treated as filed on the date the copy is submitted (rule 108(3)).')
  p('4. Under section 107(6), no appeal can be filed unless the appellant has paid (a) in full, the part of the tax, interest, fine, fee and penalty arising from this order that is admitted; and (b) ten per cent of the remaining **tax in dispute** arising from this order, subject to a maximum of twenty crore rupees. Where an order demands only a penalty without any demand of tax, ten per cent of that penalty is payable (proviso to section 107(6)).')
  p(`5. This order is passed under the CGST Act and the CGST Rules, and also under the corresponding provisions of the ${office.state} Goods and Services Tax Act, 2017 and the Integrated Goods and Services Tax Act, 2017 (the IGST Act), as applicable (the State portion is decided under section 6 of the ${office.state} Goods and Services Tax Act; IGST under section 20 of the IGST Act). The sanction and payment orders for all tax heads are issued by this office, to which the application is assigned (para 27 of Circular No. 125/44/2019-GST). A reference to a provision of the CGST Act or Rules includes the corresponding provision of those Acts and Rules.`)

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, is engaged in the supply of ${or(v.outward, 'description of outward supplies')} falling under HSN ${or(v.outward_hsn, 'HSN')}, taxed at ${or(v.output_rate, 'rate')}%. Its principal inputs are ${or(v.inputs, 'description of inputs')} under HSN ${or(v.input_hsn, 'HSN')}, taxed at ${or(v.input_rate, 'rate')}%.`)
  p(`1.2 The applicant filed an application in FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(claimedH, shownHeads)}) for ${period || blank('period')}, claiming that input tax credit had accumulated because the rate of tax on inputs is higher than the rate of tax on output supplies. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under clause (ii) of the first proviso to section 54(3) of the CGST Act, a registered person may claim refund of unutilised input tax credit at the end of a tax period where the credit has accumulated on account of the rate of tax on inputs being higher than the rate of tax on output supplies, other than nil-rated or fully exempt supplies, except supplies of goods or services or both notified by the Government on the recommendations of the Council. Supplies of goods so notified are in Notification No. 5/2017-Central Tax (Rate) dated 28.06.2017, as amended, including by Notification No. 9/2022-Central Tax (Rate) dated 13.07.2022 for goods of chapters 15 and 27, with effect from 18.07.2022, which applies to applications filed on or after that date (Circular No. 181/13/2022-GST); supplies of services so notified are in Notification No. 15/2017-Central Tax (Rate) dated 28.06.2017, as amended.')
  p('2.2 The refund is computed under rule 89(5) of the CGST Rules, as amended by Notification No. 14/2022-Central Tax dated 05.07.2022 (which applies to applications filed on or after 05.07.2022: Circular No. 181/13/2022-GST):')
  B.push({ t: 'quote', text: '**Maximum Refund Amount = {(Turnover of inverted rated supply of goods and services) × Net ITC ÷ Adjusted Total Turnover} − {Tax payable on such inverted rated supply of goods and services × (Net ITC ÷ ITC availed on inputs and input services)}**' })
  p('where "Net ITC" means input tax credit availed on **inputs** during the relevant period, and "Adjusted Total Turnover" and "relevant period" have the meanings in rule 89(4) (Explanation (b) to rule 89(5)): Adjusted Total Turnover is the sum of (a) the turnover in the State as defined in section 2(112), excluding the turnover of services, and (b) the turnover of zero-rated supply of services determined under rule 89(4)(D) and of non-zero-rated supply of services, excluding the value of exempt supplies other than zero-rated supplies, during the relevant period (rule 89(4)(E)).')
  p('2.3 Circular No. 125/44/2019-GST clarifies that refund under this head is not available for input services and capital goods (para 53); that Net ITC includes credit on all inputs, whatever their rate (para 54); that credit availed in the relevant period counts even if the invoice is of an earlier period (para 61); and that stores and spares charged to the revenue account are not capital goods (para 62). Under para 3.2 of Circular No. 135/05/2020-GST, as substituted by Circular No. 173/05/2022-GST dated 06.07.2022, credit does not accumulate on account of inverted duty structure where the input and the output are the same goods and the rates differ only because the rate changed over time; under para 3.3 so substituted, refund is admissible where the same goods are supplied under a concessional rate notification, so that the output rate is lower than the input rate at the same point of time (other than nil-rated or fully exempt supplies). Under para 37 of Circular No. 125/44/2019-GST, the refund is the least of (a) the amount computed by the formula, (b) the balance in the electronic credit ledger at the end of the tax period, and (c) the balance in the electronic credit ledger at the time of filing the claim.')
  p('2.4 Under rule 89(2)(h), the applicant files a statement of the invoices received and issued during the period (Annexure-B / Statement 1A on the portal) along with Statement 1 (the formula). Under clause (e) of Explanation 2 to section 54, the relevant date is the due date for furnishing the return under section 39 for the period in which the claim for refund arises.')

  // 3. Limitation
  h('3. Limitation')
  const L = r.limitation, first = L[0]
  if (first) {
    const extra = num(v.excluded_days)
    p(`3.1 The claim relates to ${period}. The earliest relevant date under clause (e) of Explanation 2 to section 54, the due date for filing the GSTR-3B for ${monthName(first.month)}, was ${ddmmyyyy(first.relevant)}; two years from it end on ${ddmmyyyy(first.ends)}${first.covid ? `, after leaving out the period from 01.03.2020 to 28.02.2022 (${first.covid} days) under Notification No. 13/2022-Central Tax dated 05.07.2022` : ''}${extra ? `, after excluding ${extra} days under the proviso to rule 90(3) for the earlier application returned by RFD-03` : ''}. The application was filed on ${date(v.filed)}. ${L.every(m => m.inTime) ? `The claim is within time${L.length > 1 ? ' for every month' : ''}.` : blank('months beyond two years: say they are excluded and the formula is applied to the remaining months only')}`)
    if (L.length > 1) table(['Month', 'Relevant date (GSTR-3B due date)', 'Two years end on', 'Within time'], L.map(m => [monthName(m.month), ddmmyyyy(m.relevant), ddmmyyyy(m.ends), m.inTime ? 'Yes' : 'No']))
  } else p(`3.1 ${blank('limitation: claim period and filing date')}`)

  // 4. Other conditions
  h('4. Other conditions for admissibility')
  p(`4.1 The application was complete in terms of rule 89(2) and was acknowledged in RFD-02 on ${date(v.ack)} under rule 90(2). ${confirmText('returns', 'The applicant has filed all returns in FORM GSTR-1 and GSTR-3B due up to the date of the application (para 6 of Circular No. 125/44/2019-GST).')} The amount claimed was debited from the electronic credit ledger by debit entry No. ${or(v.debit_no, 'debit entry No.')} dated ${date(v.debit_date)} (rule 89(3)). ${confirmText('undertaking', 'The undertaking in relation to section 16(2)(c) has been filed online (para 2.4 of Circular No. 197/09/2023-GST).')} ${confirmText('no_overlap', 'The back-office refund history shows no other claim for this period in this or any other category.')} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)

  // 5. Provisional refund
  h('5. Provisional refund')
  p('5.1 Section 54(6) of the CGST Act provides for provisional refund of ninety per cent of claims on account of zero-rated supplies. By para 5.1 of Instruction No. 06/2025-GST dated 03.10.2025, the Central Government has decided, as an interim measure until section 54(6) is amended (the amendment made by section 155 of the Finance Act, 2026 has not yet been brought into force), that ninety per cent of claims on account of inverted duty structure filed on or after 01.10.2025 may be sanctioned provisionally in the same manner and on the same statutory conditions (para 5.2). Under rule 91(2), as substituted by Notification No. 13/2025-Central Tax dated 17.09.2025 with effect from 01.10.2025, the proper officer is to issue the provisional refund order in FORM GST RFD-04 within seven days of the acknowledgement, on the basis of the identification and evaluation of risk by the system. Under the first proviso to rule 91(2), the proper officer may, for reasons to be recorded in writing, decide that the applicant is not to be granted refund on a provisional basis. Instruction No. 06/2025-GST dated 03.10.2025 (paras 3.1 to 3.3) directs that ninety per cent of the amount claimed be sanctioned provisionally where the system categorises the application as "low-risk", without further scrutiny for that purpose; that applications not categorised as low-risk get no provisional refund and are scrutinised in detail; and that the first proviso to rule 91(2) be used sparingly, case by case, and not on presumptive grounds or merely because routine proceedings such as scrutiny have begun. Provisional refund is not available to the categories notified under section 54(6) by Notification No. 14/2025-Central Tax dated 17.09.2025, namely a person who has not undergone Aadhaar authentication under rule 10B, and a person engaged in the supply of areca nuts (0802 80), pan masala (2106 90 20), tobacco and manufactured tobacco substitutes (chapter 24) or essential oils (3301); nor, under rule 91(1), to a person prosecuted, during the five years before the tax period of the claim, for an offence where the tax evaded exceeds two hundred and fifty lakh rupees.')
  if (!r.instruction) p(`5.2 The application was filed on ${date(v.filed)}, before 01.10.2025, when provisional refund was not available for claims on account of inverted duty structure.`)
  else if (prov) p(`5.2 The claim was marked "low-risk" by the system. Provisional refund of ${rs(T.prov)} (${headsText(provH, shownHeads)}), being ninety per cent of the amount claimed, was sanctioned by RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)} and paid by RFD-05 dated ${date(v.rfd05_date)}. That amount is accounted for in the final sanction in para 11 under rule 92(1).`)
  else if (v.risk === 'not low-risk') p('5.2 The claim was not marked "low-risk" by the system. In terms of para 3.1 of Instruction No. 06/2025-GST, no provisional refund was sanctioned, and the claim has been examined in detail as set out below.')
  else if (v.risk === 'low-risk') p(`5.2 Although the claim was categorised as "low-risk", provisional refund was not granted, for the reasons recorded in writing on ${blank('DD.MM.YYYY')} under the first proviso to rule 91(2), namely ${blank('the specific, case-related reason')}. The reason is not presumptive and does not rest merely on routine proceedings (para 3.3 of Instruction No. 06/2025-GST).`)
  else if (v.risk === 'barred') p(`5.2 Provisional refund was not available because ${blank('the applicant has not undergone Aadhaar authentication under rule 10B / supplies goods covered by Notification No. 14/2025-Central Tax')} (section 54(6)).`)
  else p(`5.2 ${blank('system risk category and provisional refund (RFD-04), or the reason it was not granted')}`)

  // 6. Verification
  h('6. Verification of the inversion and the credit')
  p('6.1 **Inversion actually exists.** The rate-wise details of inputs and outward supplies for the period, taken from GSTR-2B / the purchase register and GSTR-1, are:')
  const rows = (list, cols, totalCols) => {
    const body = list.length ? list.map(rw => cols.map(k => ['value', 'itc', 'tax'].includes(k) ? inr(num(rw[k])) : or(rw[k], ''))) : [cols.map(() => blank())]
    const tot = cols.map((k, i) => i === 1 ? '**Total**' : totalCols.includes(k) ? `**${inr(list.reduce((a, rw) => a + (num(rw[k]) || 0), 0))}**` : '')
    return [...body, tot]
  }
  B.push({ t: 'caption', text: 'Table 1: Inputs (credit availed in GSTR-3B Table 4A(1) to 4A(5) for the period)' })
  table(['HSN', 'Description', 'Rate (%)', 'Taxable value (₹)', 'ITC availed (₹)', 'Type'], rows(c.inputs || [], ['hsn', 'desc', 'rate', 'value', 'itc', 'kind'], ['value', 'itc']))
  B.push({ t: 'caption', text: 'Table 2: Outward supplies of the period (GSTR-1)' })
  table(['HSN', 'Description', 'Rate (%)', 'Taxable value (₹)', 'Tax (₹)', 'Inverted?'], rows(c.outputs || [], ['hsn', 'desc', 'rate', 'value', 'tax', 'inverted'], ['value', 'tax']))
  p(`6.2 From Tables 1 and 2, the principal inputs bear tax at ${or(v.input_rate, 'rate')}% while the outward supplies of ${or(v.outward, 'description')} bear tax at ${or(v.output_rate, 'rate')}%. The accumulation of credit is therefore on account of the rate on inputs being higher than the rate on outward supplies.`)
  p(`6.3 **Notified exclusions.** ${confirmText('notification', `The outward supplies of ${or(v.outward, 'description')} under HSN ${or(v.outward_hsn, 'HSN')} are not covered by Notification No. 5/2017-Central Tax (Rate) or Notification No. 15/2017-Central Tax (Rate), as amended.`)} ${confirmText('same_goods', 'The inputs and the output are not the same goods (para 3.2 of Circular No. 135/05/2020-GST as substituted by Circular No. 173/05/2022-GST).')}`)
  const notLower = (c.outputs || []).filter(x => x.inverted === 'no: rate not lower').reduce((a, x) => a + (num(x.value) || 0), 0)
  p(`6.4 **Supplies kept out of inverted turnover.** Outward supplies at a rate equal to or higher than the input rate (${rs(notLower)}) and zero-rated supplies by way of export and supplies to SEZ units or developers (${rs(num(v.zero_rated))}) are not "inverted rated supplies" and are kept out of the numerator. They remain part of the Adjusted Total Turnover, except exempt supplies (${rs(num(v.exempt))}), which are excluded from it. Exports of goods are included in the Adjusted Total Turnover at the lower of the FOB and invoice values (Explanation to rule 89(4), applied through Explanation (b) to rule 89(5); para 3 of Circular No. 197/09/2023-GST), and zero-rated services at the rule 89(4)(D) value.`)
  p(`6.5 **Credit admissibility.** ${confirmText('gstr2b', 'The credit on inputs taken in the computation is reflected in the applicant\'s GSTR-2B for the period or an earlier period (para 1.3 of Circular No. 197/09/2023-GST), and no credit blocked by section 17(5) or barred by section 16(4) has been included.')} Credit on imports of goods, on Input Service Distributor documents and on inward supplies taxed under reverse charge is not excluded merely because it does not appear as a supplier invoice in GSTR-2B (para 4 of Circular No. 139/09/2020-GST). Credit on input services (${rs(num(v.itc_services))}) and capital goods (${rs(num(v.itc_capital))}) is excluded from Net ITC because the rule defines Net ITC as credit on inputs only, not because it is ineligible.`)

  // 7. Computation
  h('7. Computation of the admissible refund')
  p('7.1 Sources of the figures. For each figure, one source is used, and the same source is used wherever the figure appears in the formula.')
  const comp = [['A', 'Turnover of inverted rated supply (A)'], ['B', 'Adjusted Total Turnover (B)'], ['C', 'Net ITC: inputs only (C)'], ['D', 'ITC on inputs and input services (D)'], ['E', 'Tax payable on inverted rated supply (E)']]
  table(['Component', 'Source used', 'Adopted (₹)', 'Other figure found and reason for the difference'],
    comp.map(([k, label]) => {
      const was = c.edited?.[k], alt = c.alt?.[k] || []
      const other = [
        ...(was && !same(was.value, v[k]) ? [`${inr(num(was.value))} as read from ${was.src}, corrected on verification: ${blank('reason')}`] : []),
        ...(alt.length ? [`${alt.map(a => `${inr(num(a.value))} in ${a.src}`).join('; ')}: ${blank('reason for not adopting')}`] : []),
      ]
      return [label, or(c.src?.[k], 'source'), inr(num(v[k])), other.join('. ') || 'None']
    }))
  const [A, Bv, C, D, E] = ['A', 'B', 'C', 'D', 'E'].map(k => num(v[k]))
  p('7.2 Computation:')
  table(['Step', 'Working', 'Amount (₹)'], [
    ['(i)', `A × C ÷ B = ${inr(A)} × ${inr(C)} ÷ ${inr(Bv)}`, exact(s.i)],
    ['(ii)', `C ÷ D = ${inr(C)} ÷ ${inr(D)}`, `${s.ratio.toFixed(6)} (carried unrounded)`],
    ['(iii)', `E × C ÷ D = ${inr(E)} × ${inr(C)} ÷ ${inr(D)} (ratio not rounded)`, exact(s.iii)],
    ['(iv)', 'Maximum refund = (i) − (iii)', inr(s.maxRefund)],
    ['(v)', 'Balance in the electronic credit ledger at the end of the period', s.end === null ? blank() : inr(s.end)],
    ['(vi)', 'Balance in the electronic credit ledger at the time of filing', s.atFiling === null ? blank() : inr(s.atFiling)],
    ['(vii)', 'Admissible refund: least of (iv), (v) and (vi), rounded to the nearest rupee (section 170), and not more than claimed', `**${inr(s.admissible)}**`],
    ['(viii)', 'Amount claimed', inr(s.claimed)],
    ['(ix)', 'Inadmissible: (viii) − (vii)', inr(s.rejected)],
    ...(r.cess ? [['(cess)', `The same formula applied to cess credit alone, debited entirely from the cess balance (para 39 of Circular No. 125/44/2019-GST): ${inr(A)} × ${inr(num(v.cess_C))} ÷ ${inr(Bv)} − ${inr(num(v.cess_E))} × ${inr(num(v.cess_C))} ÷ ${inr(num(v.cess_D))}`, inr(r.cess.admissible)]] : []),
  ])
  p('7.3 Head-wise split. The admissible amount (other than cess) is taken from the credit ledger in the order in which it was debited: integrated tax first, then central tax and State tax equally (para 37 of Circular No. 125/44/2019-GST). It is checked against the balance under each head at the end of the period and at filing:')
  const bal = (k, x) => { const b = num(v[`${k}_${x}`]); return b === null ? blank() : inr(b) }
  table(['Head', 'Debited in RFD-01 (₹)', 'Ledger balance at end of period (₹)', 'Ledger balance at filing (₹)', 'Admissible (₹)', 'Inadmissible (₹)'], [
    ...shownHeads.map(x => [HEAD_LABEL[x], inr(claimedH[x]), bal('end', x), bal('at_filing', x), inr(admH[x]), inr(rejH[x])]),
    ['**Total**', `**${inr(T.claimed)}**`, '', '', `**${inr(T.admissible)}**`, `**${inr(T.rejected)}**`],
  ])

  // 8. Notice, reply and hearing
  h('8. Notice, reply and personal hearing')
  if (!r.rejecting) p('8.1 As the claim is found admissible in full, no notice in FORM GST RFD-08 was required.')
  else {
    p(`8.1 On scrutiny, the following grounds were noticed, and a notice in FORM GST RFD-08 No. ${or(n.no, 'No.')} dated ${date(n.date)} was issued proposing to reject ${rs(grounds.reduce((a, g) => a + (num(g.amount) || 0), 0))} of the claim and asking the applicant to reply in FORM GST RFD-09 within fifteen days:`)
    table(['Ground No.', 'Ground stated in the notice', 'Amount proposed for rejection (₹)'], [
      ...grounds.map((g, i) => [String(i + 1), g.text, inr(num(g.amount))]),
      ['', '**Total**', `**${inr(grounds.reduce((a, g) => a + (num(g.amount) || 0), 0))}**`],
    ])
    if (n.reply) p(`8.2 The applicant replied in FORM GST RFD-09 on ${date(n.reply)}. A personal hearing was held on ${date(n.hearing)}, attended by ${or(n.attended, 'designation of the authorised representative')}.`)
    else p(`8.2 No reply was received. Opportunities of personal hearing were given on ${or(n.hearing ? ddmmyyyy(n.hearing) : '', 'dates of the hearing letters')} by letters served on the portal, but no one appeared and no adjournment was sought. The matter is therefore decided on the records available, as each of the grounds below is examined on its merits.`)
    p('8.3 **Findings on each ground.** Each ground in the notice, each point in the reply and each submission made at the hearing is dealt with below.')
    const OUT = { rejected: 'Not accepted', accepted: 'Accepted', partly: 'Partly accepted' }
    table(['Ground', "Applicant's reply / submission at hearing", 'Verification done', 'Finding and provision relied on', 'Amount proposed (₹)', 'Effect on refund (₹)'],
      grounds.map((g, i) => [String(i + 1), g.reply?.trim() || (n.reply ? blank('reply on this ground') : 'No reply'), or(g.verified, 'what was checked'), `${OUT[g.outcome] || blank('outcome')}: ${or(g.finding, 'finding')}`, inr(num(g.amount)),
        g.outcome === 'accepted' ? 'Nil' : g.effect?.trim() || (g.outcome === 'rejected' ? `${inr(num(g.amount))} not admissible` : blank('effect on refund'))]))
    grounds.forEach((g, i) => { if (g.para?.trim()) p(`8.${4 + i} On ground ${i + 1}: ${g.para.trim()}`) })
  }

  // 9. Other conditions for payment
  h('9. Other conditions for payment of the refund')
  p('9.1 **Unjust enrichment.** The refund is of unutilised input tax credit under section 54(3), which is payable to the applicant under clause (b) of section 54(8). The question of unjust enrichment does not arise, and no certificate or declaration under rule 89(2)(l) or (m) is required (provisos to rule 89(2)(l) and (m)).')
  p(`9.2 **Dues and withholding (section 54(10) and 54(11)).** The arrears and liability register of the Division, the back-office demand and recovery ledger and the portal (Electronic Liability Register Part II) were checked on ${date(c.order?.dues, 'date of the dues check')}. ${ok('dues') ? 'No return was pending and no tax, interest, penalty or other amount was payable by the applicant under the CGST Act or the existing law that had not been stayed by the specified date. No amount is withheld or deducted.' : blank('result of the dues check: none / adjusted under s.54(10)(b) / withheld under s.54(10)(a) or 54(11)')}`)
  const small = HEADS.filter(x => H[x].notPaid)
  p(`9.3 **Minimum amount (section 54(14)).** ${small.length ? small.map(x => `The amount found admissible under ${HEAD_LABEL[x]} is ${rs(H[x].notPaid)}, which is less than one thousand rupees, and is therefore not paid (section 54(14); para 60 of Circular No. 125/44/2019-GST, which applies the limit to each tax head separately).`).join(' ') : 'The amount sanctioned under each tax head is not less than one thousand rupees.'}`)
  p(`9.4 **Bank account.** ${confirmText('bank', 'The refund will be credited to the bank account declared in the application, which is one of the accounts in the applicant\'s registration particulars and has been validated on the portal (rule 92(4)).')}`)
  p(late
    ? `9.5 **Time limit and interest on delay (section 54(7), section 56 and rule 94).** The application was filed on ${date(v.filed)} (the ARN date, as indicated in RFD-02 under rule 90(2)). The sixty days ended on ${date(r.sixty)}, before this order. Under section 56 and rule 94, interest at six per cent per annum (Notification No. 13/2017-Central Tax dated 28.06.2017) is payable on the refund sanctioned from the day after that date until the date on which the amount is credited to the applicant's bank account (para 34 of Circular No. 125/44/2019-GST). Under rule 94(2), the period beyond fifteen days of receipt of any RFD-08 notice taken by the applicant to reply or to submit documents, and any period taken to correct or validate the bank account, are excluded. A separate order under rule 94(1), with FORM GST RFD-05, will specify the amount of delayed refund, the period of delay and the interest payable.`
    : `9.5 **Time limit and interest on delay (section 54(7), section 56 and rule 94).** The application was filed on ${date(v.filed)} (the ARN date, as indicated in RFD-02 under rule 90(2)); the period under section 54(7) and section 56 counts from that date and ends on ${date(r.sixty)}. This order and the payment order in FORM GST RFD-05 are issued within the sixty days. A refund is made only when the amount is credited to the applicant's bank account (para 34 of Circular No. 125/44/2019-GST); if the credit takes place after ${date(r.sixty)}, interest under section 56 is payable for the days of delay up to the date of credit, and will be sanctioned by a separate order under rule 94.`)

  // 10. Conclusion
  h('10. Conclusion')
  p(r.rejecting
    ? `10.1 In view of the above, I find that the applicant is entitled to refund of ${rs(T.admissible)} under clause (ii) of the first proviso to section 54(3) read with rule 89(5), and that ${rs(T.rejected)} is not admissible for the reasons in paras 7 and 8. The inadmissible amount, having been debited from the electronic credit ledger, is to be re-credited under rule 93(2) on the conditions in para 11.4. Accordingly, I pass the following order.`
    : `10.1 In view of the above, I find that the applicant is entitled to refund of ${rs(T.admissible)}, the whole of the amount claimed, under clause (ii) of the first proviso to section 54(3) read with rule 89(5). Accordingly, I pass the following order.`)

  // 11. ORDER
  h('11. ORDER')
  p(`11.1 Under section 54(5) of the CGST Act read with rules 92(1) and 92(4), I sanction refund of **${rs(T.admissible)} (Rupees ${words(T.admissible)} only)** to the applicant, payable under section 54(8)(b), as follows:`)
  table(['Head', 'Claimed (₹)', 'Admissible (₹)', 'Provisional refund paid (₹)', 'Adjusted / withheld (₹)', 'Net payable now by RFD-05 (₹)', 'Rejected (₹)'], [
    ...shownHeads.map(x => [HEAD_LABEL[x], inr(H[x].claimed), inr(H[x].admissible), inr(H[x].prov), '0', inr(H[x].net), H[x].notPaid ? `${inr(H[x].rejected)} (of which ${inr(H[x].notPaid)} not paid under section 54(14))` : inr(H[x].rejected)]),
    ['**Total**', `**${inr(T.claimed)}**`, `**${inr(T.admissible)}**`, `**${inr(T.prov)}**`, '**0**', `**${inr(T.net)}**`, `**${inr(T.rejected)}**`],
  ])
  p(`11.2 The net amount of ${rs(T.net)} (Rupees ${words(T.net)} only) shall be credited to the applicant's bank account by payment order in FORM GST RFD-05 (rule 92(4)).`)
  let para = 3
  if (T.rejected > 0) {
    p(`11.${para++} Under rule 92(3), I reject refund of **${rs(T.rejected)} (Rupees ${words(T.rejected)} only)** (${headsText(rejH, shownHeads, true)}) for the reasons in paras ${r.rejecting && grounds.length ? '7 and 8' : '7 and 9.3'}.`)
    p(`11.${para++} Under rule 93(2), the amount of ${rs(T.rejected)} (${headsText(rejH, shownHeads, true)}) rejected in para 11.3, which was debited from the electronic credit ledger, shall be re-credited to that ledger by an order in FORM GST PMT-03, after the applicant gives an undertaking in writing that it will not file an appeal against this order, or, if it files an appeal, after the appeal is finally rejected (Explanation to rule 93; paras 21 and 23 of Circular No. 125/44/2019-GST). If the appeal succeeds, the applicant may file a fresh claim under the category "on account of assessment / provisional assessment / appeal / any other order" (para 24 of that Circular).`)
  }
  if (late) p(`11.${para++} Interest under section 56 on the delayed refund shall be paid by a separate order under rule 94, as stated in para 9.5.`)

  B.push({ t: 'sign', officer: office.officer, desig: office.desig, office: `${office.division}, ${office.commrte}` })
  p(`To,\n${name} (GSTIN ${or(v.gstin, 'GSTIN')}), ${or(v.address, 'address')} (through the common portal and by e-mail to the registered e-mail address)`)
  p('Copy to:')
  B.push({ t: 'list', items: [
    `The Commissioner of Central Tax, ${office.commrte} (by name to the Assistant Commissioner (Review – Refunds), Headquarters), for review under section 107(2).`,
    `The Assistant / Deputy Commissioner (Post-Audit), ${office.commrte}, for post-audit of refund orders.`,
    `The Superintendent, ${or(c.order?.range, 'Range')} Range, ${office.division}, for information and for updating the refund register.`,
    'Guard file / Office copy.',
  ] })
  return B
}

// Everything still to fill in, so the screen can list it before the Word file goes out
export const blanks = (blocks) => {
  const all = []
  const scan = (t) => { for (const m of String(t).matchAll(/⟦([^⟧]*)⟧/g)) all.push(m[1].trim() || 'a blank') }
  for (const b of blocks) {
    if (b.text) scan(b.text)
    b.rows?.forEach(rw => rw.forEach(scan))
    b.items?.forEach(scan)
  }
  return [...new Set(all)]
}
