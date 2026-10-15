// Refund Desk: the speaking order for template T7, refund of excess balance in the electronic cash
// ledger (s.49(6) read with the proviso to s.54(1)). No time limit (Circular No. 166/22/2021-GST),
// no provisional refund, and its own ORDER: the rejected amount goes back to the cash ledger.
import { kit, opening, hearing, statutory, closing, blank, or, date, rs, same, headsText, num, inr, words, HEAD_LABEL, HEADS } from './order-kit.js'

const UE_TEXT = "The amount is the applicant's own unutilised deposit in the electronic cash ledger, not tax paid on a supply. As clarified at S. No. 2 of Circular No. 166/22/2021-GST, the unjust enrichment clause does not apply, and no certificate or declaration under rule 89(2)(l) or (m) is required. The refund is payable to the applicant under clause (e) of section 54(8), the question of passing on not arising."

export function buildT7(c, r, office) {
  const k = kit(c, r, office)
  const { v, H, T, ok, confirmText, name } = k
  const s = r.steps
  const shownHeads = k.shownHeads
  const { h, p, table } = k
  const list = c.rows?.cashrows || []
  const sno = (pred) => list.map((rw, i) => pred(rw) ? i + 1 : 0).filter(Boolean)
  const amt = (pred) => list.filter(pred).reduce((a, rw) => a + (num(rw.claimed) || 0), 0)

  opening(k, {
    title: 'REFUND OF EXCESS BALANCE IN THE ELECTRONIC CASH LEDGER [SECTION 49(6) READ WITH THE PROVISO TO SECTION 54(1) OF THE CGST ACT]',
    category: 'Excess balance in electronic cash ledger',
    periodLabel: 'Balance claimed as on',
    periodValue: date(v.balance_on),
    rfd04Row: 'Not applicable (section 54(6) covers only zero-rated supplies)',
    ackRow: `Generated automatically on filing, ${date(v.ack || v.filed)} (rule 90(1))`,
    receiptRow: `${date(v.filed)}, the date of filing (rule 90(1)); sixty days end on ${date(r.sixty)}`,
  })

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, shownHeads)}), being the balance in its electronic cash ledger as on ${date(v.balance_on)}. The amount was debited from the electronic cash ledger on filing. The applicant states that the balance arose because ${or(v.cash_reason, 'reason given, for example: tax deposited by challan was later paid through the credit ledger / an excess deposit by mistake / TDS or TCS credited under section 51 or 52 / a deposit made during an inquiry that was not adjusted / the business has closed')}.`)
  p('1.2 Under rule 90(1), an application for refund from the electronic cash ledger is acknowledged in FORM GST RFD-02 automatically on the portal, and the time in section 54(7) runs from the date of filing.')

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 49(6) of the CGST Act, the balance in the electronic cash ledger after payment of tax, interest, penalty, fee or any other amount payable under the Act or the rules may be refunded in accordance with section 54. Under the proviso to section 54(1), a registered person claiming refund of any balance in the electronic cash ledger under section 49(6) may claim it in the form and manner prescribed, which is FORM GST RFD-01 under rule 89(1).')
  p('2.2 Circular No. 166/22/2021-GST clarifies that (i) the time limit in section 54(1) does not apply to refund of excess balance in the electronic cash ledger (S. No. 1); (ii) no certificate or declaration under rule 89(2)(l) or (m) is required, as unjust enrichment does not apply (S. No. 2); and (iii) TDS and TCS credited to the electronic cash ledger under sections 51 and 52 are equivalent to cash deposited, and any amount left unutilised after discharge of tax and other dues can be refunded as excess balance (S. No. 3).')
  p('2.3 Under section 54(10), where the applicant has defaulted in furnishing any return or is required to pay any tax, interest or penalty that has not been stayed by the specified date, the proper officer may withhold the refund, or deduct the unpaid amount from it. This, and not rejection, is the way to deal with dues.')

  // 3. Limitation
  h('3. Limitation')
  p('3.1 In terms of S. No. 1 of Circular No. 166/22/2021-GST, the time limit in section 54(1) does not apply to this claim.')

  // 4. Other conditions
  h('4. Other conditions for admissibility')
  p(`4.1 The amount claimed was debited from the electronic cash ledger on filing (debit entry No. ${or(v.debit_no, 'debit entry No.')} dated ${date(v.debit_date)}). ${confirmText('no_overlap', 'The back-office refund history shows no other claim for the same balance.')} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)

  // 5. Provisional refund
  h('5. Provisional refund')
  p('5.1 Provisional refund under section 54(6) applies only to zero-rated supplies (and, from the date section 155 of the Finance Act, 2026 is brought into force, to inverted-duty refunds). It is not applicable to this category.')

  // 6. Verification of the cash balance
  h('6. Verification of the cash balance')
  p(`6.1 **Source of the balance.** The electronic cash ledger up to ${date(v.balance_on)} was examined entry by entry. The balance claimed is made up as follows:`)
  k.caption('Table 1: Composition of the balance claimed')
  const paidBy = ok('own_account') ? "The applicant's own account" : blank('own account / other, explain')
  k.rowsTable(
    ['S. No.', 'Credit entry: challan (CPIN / CIN) and date, or TDS / TCS credit', 'Major head / minor head', 'Amount credited (₹)', 'Paid by', 'Used later for liability (₹)', 'Unutilised and claimed (₹)', 'Remarks'],
    list, ['#', 'entry', 'head', 'credited', 'paid_by', 'used', 'claimed', 'remarks'], ['credited', 'used', 'claimed'],
    { fmt: {
      head: (rw) => `${HEAD_LABEL[rw.head] || blank('head')} / ${or(rw.minor, 'minor head')}`,
      paid_by: () => paidBy,
      used: (rw) => inr(num(rw.used) || 0),
      remarks: (rw) => [rw.remarks?.trim(), rw.refundable === 'no' ? 'Not refundable: paras 6 and 8' : ''].filter(Boolean).join('; '),
    } })
  const out = sno(rw => rw.refundable === 'no')
  p(`6.2 **Why the cash accumulated.** ${blank('finding on the reason given in para 1.1, with the evidence, e.g. the challan date and the GSTR-3B in which the liability was discharged through the credit ledger')}.${out.length ? ` The ${out.length > 1 ? 'entries' : 'entry'} at S. No${out.length > 1 ? 's' : ''}. ${out.join(', ')} of Table 1 (${rs(amt(rw => rw.refundable === 'no'))}) ${out.length > 1 ? 'are' : 'is'} not found refundable, for the reasons in para 8.` : ''}`)
  p(`6.3 **No liability attached to the deposit.** ${confirmText('cash_source', 'It was verified that the balance does not represent:')}`)
  k.list([
    `(a) tax, interest or late fee for any period for which the return is yet to be filed, or that is shown as payable in the Electronic Liability Register (Part I or Part II) (checked on ${date(c.order?.dues)});`,
    '(b) an amount deposited during an inquiry, investigation or audit and intended as a voluntary payment, but not yet adjusted through DRC-03;',
    '(c) a pre-deposit for an appeal (which is debited separately and is not part of this balance).',
  ])
  p(`6.4 **Deposits by others.** ${ok('own_account') ? "All deposits in Table 1 were made from the applicant's own bank account, as seen from the challan details." : blank("all deposits made from the applicant's own bank account, or the deposit made from another person's account, the applicant's explanation and the evidence; the refund is payable only to the applicant's registered bank account")}`)
  const tds = (rw) => /\b(TDS|TCS)\b/i.test(rw.entry || '')
  const tdsOk = sno(rw => tds(rw) && rw.refundable !== 'no'), tdsOut = sno(rw => tds(rw) && rw.refundable === 'no')
  if (tdsOk.length || tdsOut.length) {
    const parts = []
    if (tdsOk.length) parts.push(`The TDS / TCS credit${tdsOk.length > 1 ? 's' : ''} at S. No${tdsOk.length > 1 ? 's' : ''}. ${tdsOk.join(', ')} ${tdsOk.length > 1 ? 'were' : 'was'} accepted by the applicant on the portal and ${tdsOk.length > 1 ? 'are' : 'is'} not in dispute with the deductor / operator; under S. No. 3 of Circular No. 166/22/2021-GST ${tdsOk.length > 1 ? 'they are' : 'it is'} equivalent to cash and may be refunded once no dues remain.`)
    if (tdsOut.length) parts.push(`The TDS / TCS credit${tdsOut.length > 1 ? 's' : ''} at S. No${tdsOut.length > 1 ? 's' : ''}. ${tdsOut.join(', ')} (${rs(amt(rw => tds(rw) && rw.refundable === 'no'))}) ${tdsOut.length > 1 ? 'are' : 'is'} not found refundable: although TDS and TCS credits are equivalent to cash under S. No. 3 of Circular No. 166/22/2021-GST, ${tdsOut.length > 1 ? 'they were' : 'it was'} put to the applicant in the RFD-08 notice and ${tdsOut.length > 1 ? 'are' : 'is'} decided in para 8.`)
    p(`6.5 ${parts.join(' ')}`)
  }

  // 7. Amount refundable
  h('7. Amount refundable')
  const cashKnown = HEADS.some(x => s.cash?.[x] !== null && s.cash?.[x] !== undefined)
  const cashTot = HEADS.reduce((a, x) => a + (num(s.cash?.[x]) || 0), 0)
  const rowsTot = HEADS.reduce((a, x) => a + (s.fromRows?.[x] || 0), 0)
  const agree = HEADS.every(x => same(s.fromRows?.[x] || 0, H[x].claimed) && (!cashKnown || s.cash?.[x] === null || s.cash[x] >= H[x].claimed - 1))
  p(`7.1 The balance in the electronic cash ledger on the date of filing was ${cashKnown ? rs(cashTot) : blank('₹ balance at filing')}; the unutilised total in Table 1 is ${rs(rowsTot)}; and the amount claimed is ${rs(T.claimed)}. ${agree ? 'These agree, head-wise and minor-head-wise.' : `The difference is explained as ${blank('explanation of the difference, head-wise and minor-head-wise')}.`} ${T.rejected > 0 ? `Of the amount claimed, ${rs(T.admissible)} is found refundable and ${rs(T.rejected)} is not, for the reasons in para 6 and para 8.` : `The whole of the amount claimed, ${rs(T.admissible)}, is found refundable.`}`)

  hearing(k, 8, { affCol: 'Amount found not admissible on this ground (₹)' })
  statutory(k, 9, UE_TEXT)

  // 10. Conclusion
  h('10. Conclusion')
  p(T.rejected > 0
    ? `10.1 In view of the above, I find that ${rs(T.admissible)} of the balance in the electronic cash ledger is refundable to the applicant under section 49(6) read with the proviso to section 54(1), and that ${rs(T.rejected)} is not refundable for the reasons in paras 6, 7 and 8. Accordingly, I pass the following order.`
    : `10.1 In view of the above, I find that ${rs(T.admissible)}, the whole of the balance in the electronic cash ledger claimed, is refundable to the applicant under section 49(6) read with the proviso to section 54(1). Accordingly, I pass the following order.`)

  // 11. ORDER
  h('11. ORDER')
  p(`11.1 Under section 54(5) of the CGST Act read with rules 92(1) and 92(4), I sanction refund of **${rs(T.admissible)} (Rupees ${words(T.admissible)} only)** to the applicant, as follows:`)
  table(['Head', 'Claimed (₹)', 'Admissible (₹)', 'Adjusted under section 54(10)(b) in this order (₹)', 'Net payable now by RFD-05 (₹)', 'Rejected (₹)'], [
    ...shownHeads.map(x => [HEAD_LABEL[x], inr(H[x].claimed), inr(H[x].admissible), inr(H[x].adj), inr(H[x].net), H[x].notPaid ? `${inr(H[x].rejected)} (of which ${inr(H[x].notPaid)} not paid under section 54(14))` : inr(H[x].rejected)]),
    ['**Total**', `**${inr(T.claimed)}**`, `**${inr(T.admissible)}**`, `**${inr(T.adj)}**`, `**${inr(T.net)}**`, `**${inr(T.rejected)}**`],
  ])
  p(`11.2 The net amount of ${rs(T.net)} (Rupees ${words(T.net)} only) shall be credited to the applicant's bank account by payment order in FORM GST RFD-05 (rule 92(4)).${T.adj ? ` The amount of ${rs(T.adj)} (${headsText(k.adjH, shownHeads, true)}) adjusted under section 54(10)(b) shall be appropriated against ${or(c.order?.adj_ref, 'demand ID / order No.')}.` : ''}`)
  let para = 3
  if (T.rejected > 0) {
    const rejNo = para
    p(`11.${para++} Under rule 92(3), I reject refund of **${rs(T.rejected)} (Rupees ${words(T.rejected)} only)** (${headsText(k.rejH, shownHeads, true)}) for the reasons in paras 6, 7 and 8.`)
    p(`11.${para++} The amount of ${rs(T.rejected)} (${headsText(k.rejH, shownHeads, true)}) rejected in para 11.${rejNo}, which was debited from the electronic cash ledger on filing, shall be re-credited to the electronic cash ledger by an order in FORM GST PMT-03, after the applicant gives an undertaking in writing that it will not file an appeal, or, if it files an appeal, after the appeal is finally rejected (rule 93 and its Explanation, applied to the ledger from which the amount was debited, and paras 21 to 23 of Circular No. 125/44/2019-GST, which apply the PMT-03 re-credit to rejections on any ground). Rejection does not forfeit the deposit; it remains available to the applicant in its electronic cash ledger.`)
  }
  if (k.late) p(`11.${para++} Interest under section 56 on the delayed refund shall be paid by a separate order under rule 94, as stated in para 9.5.`)

  closing(k)
  return k.B
}
