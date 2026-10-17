// Refund Desk: the speaking order for template T1, refund of unutilised credit on account of an
// inverted duty structure (s.54(3)(ii), rule 89(5)).
import { kit, opening, provisional, hearing, statutory, conclusionAndOrder, closing, sourcesTable, blank, or, date, rs, exact, headsText, num, inr, ddmmyyyy, monthName, HEAD_LABEL } from './order-kit.js'

export function buildT1(c, r, office) {
  const k = kit(c, r, office)
  const { v, T, B, ok, confirmText, name, period } = k
  const s = r.steps
  const shownHeads = k.shownHeads
  const { h, p, table } = k

  opening(k, {
    title: 'REFUND OF UNUTILISED INPUT TAX CREDIT ON ACCOUNT OF INVERTED DUTY STRUCTURE [SECTION 54(3)(ii) OF THE CGST ACT]',
    category: 'Refund of ITC accumulated due to inverted tax structure',
  })
  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, is engaged in the supply of ${or(v.outward, 'description of outward supplies')} falling under HSN ${or(v.outward_hsn, 'HSN')}, taxed at ${or(v.output_rate, 'rate')}%. Its principal inputs are ${or(v.inputs, 'description of inputs')} under HSN ${or(v.input_hsn, 'HSN')}, taxed at ${or(v.input_rate, 'rate')}%.`)
  p(`1.2 The applicant filed an application in FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, shownHeads)}) for ${period || blank('period')}, claiming that input tax credit had accumulated because the rate of tax on inputs is higher than the rate of tax on output supplies. The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

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
  provisional(k, 'Section 54(6) of the CGST Act provides for provisional refund of ninety per cent of claims on account of zero-rated supplies. By para 5.1 of Instruction No. 06/2025-GST dated 03.10.2025, the Central Government has decided, as an interim measure until section 54(6) is amended (the amendment made by section 155 of the Finance Act, 2026 has not yet been brought into force), that ninety per cent of claims on account of inverted duty structure filed on or after 01.10.2025 may be sanctioned provisionally in the same manner and on the same statutory conditions (para 5.2).', {
    beforeText: `The application was filed on ${date(v.filed)}, before 01.10.2025, when provisional refund was not available for claims on account of inverted duty structure.`,
  })

  // 6. Verification
  h('6. Verification of the inversion and the credit')
  p('6.1 **Inversion actually exists.** The rate-wise details of inputs and outward supplies for the period, taken from GSTR-2B / the purchase register and GSTR-1, are:')
  const rows = (list, cols, totalCols) => {
    const body = list.length ? list.map(rw => cols.map(k => ['value', 'itc', 'tax'].includes(k) ? inr(num(rw[k])) : or(rw[k], ''))) : [cols.map(() => blank())]
    const tot = cols.map((k, i) => i === 1 ? '**Total**' : totalCols.includes(k) ? `**${inr(list.reduce((a, rw) => a + (num(rw[k]) || 0), 0))}**` : '')
    return [...body, tot]
  }
  B.push({ t: 'caption', text: 'Table 1: Inputs (credit availed in GSTR-3B Table 4A(1) to 4A(5) for the period)' })
  table(['HSN', 'Description', 'Rate (%)', 'Taxable value (₹)', 'ITC availed (₹)', 'Type'], rows(c.rows?.inputs || [], ['hsn', 'desc', 'rate', 'value', 'itc', 'kind'], ['value', 'itc']))
  B.push({ t: 'caption', text: 'Table 2: Outward supplies of the period (GSTR-1)' })
  table(['HSN', 'Description', 'Rate (%)', 'Taxable value (₹)', 'Tax (₹)', 'Inverted?'], rows(c.rows?.outputs || [], ['hsn', 'desc', 'rate', 'value', 'tax', 'inverted'], ['value', 'tax']))
  p(`6.2 From Tables 1 and 2, the principal inputs bear tax at ${or(v.input_rate, 'rate')}% while the outward supplies of ${or(v.outward, 'description')} bear tax at ${or(v.output_rate, 'rate')}%. The accumulation of credit is therefore on account of the rate on inputs being higher than the rate on outward supplies.`)
  p(`6.3 **Notified exclusions.** ${confirmText('notification', `The outward supplies of ${or(v.outward, 'description')} under HSN ${or(v.outward_hsn, 'HSN')} are not covered by Notification No. 5/2017-Central Tax (Rate) or Notification No. 15/2017-Central Tax (Rate), as amended.`)} ${confirmText('same_goods', 'The inputs and the output are not the same goods (para 3.2 of Circular No. 135/05/2020-GST as substituted by Circular No. 173/05/2022-GST).')}`)
  const notLower = (c.rows?.outputs || []).filter(x => x.inverted === 'no: rate not lower').reduce((a, x) => a + (num(x.value) || 0), 0)
  p(`6.4 **Supplies kept out of inverted turnover.** Outward supplies at a rate equal to or higher than the input rate (${rs(notLower)}) and zero-rated supplies by way of export and supplies to SEZ units or developers (${rs(num(v.zero_rated))}) are not "inverted rated supplies" and are kept out of the numerator. They remain part of the Adjusted Total Turnover, except exempt supplies (${rs(num(v.exempt))}), which are excluded from it. Exports of goods are included in the Adjusted Total Turnover at the lower of the FOB and invoice values (Explanation to rule 89(4), applied through Explanation (b) to rule 89(5); para 3 of Circular No. 197/09/2023-GST), and zero-rated services at the rule 89(4)(D) value.`)
  p(`6.5 **Credit admissibility.** ${confirmText('gstr2b', 'The credit on inputs taken in the computation is reflected in the applicant\'s GSTR-2B for the period or an earlier period (para 1.3 of Circular No. 197/09/2023-GST), and no credit blocked by section 17(5) or barred by section 16(4) has been included.')} Credit on imports of goods, on Input Service Distributor documents and on inward supplies taxed under reverse charge is not excluded merely because it does not appear as a supplier invoice in GSTR-2B (para 4 of Circular No. 139/09/2020-GST). Credit on input services (${rs(num(v.itc_services))}) and capital goods (${rs(num(v.itc_capital))}) is excluded from Net ITC because the rule defines Net ITC as credit on inputs only, not because it is ineligible.`)

  // 7. Computation
  h('7. Computation of the admissible refund')
  p('7.1 Sources of the figures. For each figure, one source is used, and the same source is used wherever the figure appears in the formula.')
  sourcesTable(k, [['A', 'Turnover of inverted rated supply (A)'], ['B', 'Adjusted Total Turnover (B)'], ['C', 'Net ITC: inputs only (C)'], ['D', 'ITC on inputs and input services (D)'], ['E', 'Tax payable on inverted rated supply (E)']])
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
    ...shownHeads.map(x => [HEAD_LABEL[x], inr(k.claimedH[x]), bal('end', x), bal('at_filing', x), inr(k.admH[x]), inr(k.rejH[x])]),
    ['**Total**', `**${inr(T.claimed)}**`, '', '', `**${inr(T.admissible)}**`, `**${inr(T.rejected)}**`],
  ])


  hearing(k, 8)
  statutory(k, 9, 'The refund is of unutilised input tax credit under section 54(3), which is payable to the applicant under clause (b) of section 54(8). The question of unjust enrichment does not arise, and no certificate or declaration under rule 89(2)(l) or (m) is required (provisos to rule 89(2)(l) and (m)).')
  conclusionAndOrder(k, { kind: 'itc', law: 'clause (ii) of the first proviso to section 54(3) read with rule 89(5)', clause8: 'b', rejParas: '3, 6, 7 and 8' })
  closing(k)
  return k.B
}
