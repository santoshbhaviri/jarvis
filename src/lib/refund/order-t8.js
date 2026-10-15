// Refund Desk: the speaking order for template T8, refund of a pre-deposit under section 107(6) /
// 112(8), or of an amount paid under an order set aside, consequent to an appellate order
// (s.54(1) read with s.54(8)(e) and s.115). Relevant date: communication of the appellate order
// (clause (d) of Explanation 2 to s.54). No provisional refund; its own paras 9.5, 9.6 and ORDER.
import { kit, opening, hearing, statutory, closing, blank, or, date, rs, headsText, num, inr, words, ddmmyyyy, HEAD_LABEL } from './order-kit.js'

const RESULT = {
  'set aside in full': 'set aside the order-in-original and allowed the appeal, with consequential relief',
  'allowed in part': `allowed the appeal in part, reducing the tax demand to ${blank('₹ tax upheld')}, with consequential relief`,
  remanded: 'set aside the order-in-original and remanded the matter for fresh adjudication',
}

export function buildT8(c, r, office) {
  const k = kit(c, r, office)
  const { v, H, T, ok, confirmText, name } = k
  const s = r.steps
  const shownHeads = k.shownHeads
  const { h, p, table } = k
  const by = (key) => Object.fromEntries(shownHeads.map(x => [x, H[x][key] || 0]))
  const sum = (key) => shownHeads.reduce((a, x) => a + (H[x][key] || 0), 0)
  const pdH = by('pd'), opH = by('op'), nrH = by('nr')
  const pdT = sum('pd'), opT = sum('op'), nrT = sum('nr')
  const tribunal = /tribunal|gstat/i.test(v.ao_by || '')
  const ledger = (mode) => mode === 'credit ledger' ? 'credit' : mode === 'cash ledger' ? 'cash' : blank('cash / credit')
  const final = v.dept === 'accepted on review'

  opening(k, {
    title: 'REFUND CONSEQUENT TO ORDER-IN-APPEAL / TRIBUNAL ORDER (PRE-DEPOSIT UNDER SECTION 107(6) / 112(8), OR AMOUNT PAID UNDER THE ORDER SET ASIDE) [SECTION 54(1) READ WITH SECTION 54(8)(e) AND SECTION 115 OF THE CGST ACT]',
    category: 'On account of assessment / provisional assessment / appeal / any other order',
    periodValue: k.period || blank('period of the demand'),
    rfd04Row: 'Not applicable (section 54(6) covers only zero-rated supplies)',
  })

  // 1. Brief facts
  h('1. Brief facts')
  p(`1.1 ${name} (the applicant), registered under GSTIN ${or(v.gstin, 'GSTIN')}, was issued Order-in-Original No. ${or(v.oio, 'No. and date')} by ${or(v.oio_by, 'authority')} confirming a demand of tax of ${num(v.oio_tax) !== null ? rs(num(v.oio_tax)) : blank('₹ tax confirmed')}, with interest and penalty, for ${k.period || blank('period')}, on the ground that ${or(v.oio_ground, 'one-line ground')}.`)
  p(`1.2 Against that order, the applicant filed an appeal in FORM GST APL-01 (ARN ${or(v.apl_arn, 'ARN and date')}) and paid the pre-deposit under section 107(6) of ${rs(pdT)} (${headsText(pdH, shownHeads, true)}) on ${date(v.pd_date)} by debit to the electronic ${ledger(v.pd_mode)} ledger (DRC-03 / APL-01 debit reference ${blank('reference')}).${opT ? ` It had also paid ${rs(opT)} (${headsText(opH, shownHeads, true)}) towards the confirmed demand on ${date(v.op_date)} by debit to the electronic ${ledger(v.op_mode)} ledger (DRC-03 No. ${blank('DRC-03 No.')}).` : ''}`)
  p(`1.3 The ${or(v.ao_by, 'Joint / Additional Commissioner (Appeals) / Commissioner (Appeals) / GST Appellate Tribunal')}, by Order No. ${or(v.ao, 'No. and date')}, communicated to the applicant on ${date(v.ao_comm)}, ${RESULT[v.ao_result] || blank('set aside the order-in-original and allowed the appeal / allowed the appeal in part / remanded the matter')}.`)
  p(`1.4 The applicant filed FORM GST RFD-01 under ARN ${or(v.arn, 'ARN')} dated ${date(v.filed)} for refund of ${rs(T.claimed)} (${headsText(k.claimedH, shownHeads)}), with a copy of the appellate order and the payment references (rule 89(2)(a)). The application was acknowledged in FORM GST RFD-02 on ${date(v.ack)}.`)

  // 2. Legal provisions
  h('2. Legal provisions')
  p('2.1 Under section 54(1) of the CGST Act, any person claiming refund of any tax and interest, if any, paid on such tax or any other amount paid by him, may apply within two years from the relevant date. Under clause (d) of Explanation 2 to section 54, where tax becomes refundable as a consequence of a judgment, decree, order or direction of the Appellate Authority, Appellate Tribunal or any court, the relevant date is the date of communication of that judgment, decree, order or direction. Under rule 89(2)(a), the application is accompanied by the reference number and a copy of the order resulting in the refund, or the reference number of the payment of the amount under section 107(6) or 112(8) claimed as refund.')
  p('2.2 Under section 54(8)(e), the refundable amount is paid to the applicant, instead of being credited to the Consumer Welfare Fund, if the applicant has not passed on the incidence of the tax and interest to any other person. Under rule 89(2)(l) and (m), the applicant furnishes a declaration (where the amount claimed does not exceed two lakh rupees) or a certificate from a Chartered Accountant or Cost Accountant (where it exceeds two lakh rupees) to that effect.')
  p('2.3 Under **section 115**, where an amount paid by the appellant under section 107(6) or section 112(8) is required to be refunded consequent to any order of the Appellate Authority or the Appellate Tribunal, interest at the rate specified under section 56 (six per cent under the main part, or nine per cent under its proviso: Notification No. 13/2017-Central Tax, as amended; the rate adopted and its basis are recorded in para 9.6) is payable on such refund **from the date of payment of the amount till the date of refund**. Under the proviso to section 56, where a refund arises from an order of an adjudicating authority, Appellate Authority, Appellate Tribunal or court which has attained finality and is not refunded within sixty days of the application, interest at nine per cent per annum (Notification No. 13/2017-Central Tax, as amended) is payable from the day after the sixty days until the date of refund.')
  p('2.4 Under rule 92(1A), where refund of an amount paid as tax (other than on zero-rated supplies or deemed exports) is sanctioned, the part debited in cash is paid in cash, proportionately, and the part debited from the electronic credit ledger is re-credited to that ledger by FORM GST PMT-03.')

  // 3. Limitation
  h('3. Limitation')
  const L = r.limitation?.[0]
  if (L) p(`3.1 The appellate order was communicated on ${ddmmyyyy(L.relevant)}, which is the relevant date under clause (d) of Explanation 2 to section 54. Two years from it end on ${ddmmyyyy(L.ends)}${L.covid ? `, after leaving out the period from 01.03.2020 to 28.02.2022 (${L.covid} days) under Notification No. 13/2022-Central Tax dated 05.07.2022` : ''}. The application, filed on ${date(v.filed)}, ${L.inTime === false ? `is beyond that date. ${blank('record the view of the jurisdictional High Court on whether a pre-deposit, which is not tax, is subject to the time limit in section 54(1), and the decision on limitation')}` : 'is within time.'}`)
  else p(`3.1 ${blank('date the appellate order was communicated (the relevant date) and the two years from it')}`)

  // 4. Other conditions
  h('4. Other conditions for admissibility')
  const ledgers = [...new Set([pdT && v.pd_mode, opT && v.op_mode].filter(Boolean).map(ledger))]
  const ledgerText = ledgers.length ? ledgers.join(' and ') : blank('cash / credit')
  p(`4.1 The application was complete in terms of rule 89(2) and was acknowledged in RFD-02 on ${date(v.ack)} under rule 90(2). ${confirmText('payments', `The payments claimed have been verified in the electronic ${ledgerText} ledger and the Electronic Liability Register (Part II) against demand ID ${blank('demand ID')}: pre-deposit of ${rs(pdT)} debited on ${date(v.pd_date)}${opT ? ` and payment of ${rs(opT)} by DRC-03 dated ${date(v.op_date)}` : ''}.`)} ${confirmText('no_overlap', 'The back-office refund history shows no earlier refund of these amounts.')} The applicant ${ok('aadhaar') ? 'has' : blank('has / has not')} undergone Aadhaar authentication under rule 10B.`)

  // 5. Provisional refund
  h('5. Provisional refund')
  p('5.1 Provisional refund under section 54(6) applies only to zero-rated supplies. It is not applicable to this category.')

  // 6. The appellate order and the department's position
  h("6. Verification of the appellate order and of the department's position")
  const effect = {
    'set aside in full': 'The appellate order sets aside the demand in full.',
    'allowed in part': `The appellate order reduces the tax in dispute from ${num(v.oio_tax) !== null ? rs(num(v.oio_tax)) : blank('₹ tax confirmed')} to ${blank('₹ tax upheld')}; the amounts paid count towards the tax upheld to the extent of ${rs(nrT)} (row (c) of Table 1).`,
    remanded: `The ${or(v.ao_by, 'Appellate Tribunal')} has set aside the order and remanded the matter for fresh adjudication. ${blank('basis adopted, following the jurisdictional High Court or any Board instruction, on whether the pre-deposit becomes refundable on remand or is retained till the fresh order')}`,
  }[v.ao_result] || blank('effect of the appellate order: set aside in full / allowed in part / remanded')
  p(`6.1 **Effect of the appellate order.** ${effect} The amount that has become refundable is worked out in para 7.`)
  const modeKnown = (!T.pdRef || v.pd_mode) && (!T.opRef || v.op_mode)
  p(`6.2 **Mode of the original payment.** ${modeKnown ? `Of the amount refundable, ${rs(T.cash)} was paid in cash and ${rs(T.credit)} by debit to the electronic credit ledger.` : blank('the part of the amount refundable paid in cash and the part paid by debit to the electronic credit ledger')} Under rule 92(1A), the cash portion is paid to the bank account and the credit portion is re-credited by PMT-03.`)
  const reviewSec = tribunal ? 'section 117, for an order of the Tribunal' : 'section 112(3), for an order of the Appellate Authority'
  const dept = {
    'accepted on review': `The order was accepted by the Commissioner on review under ${reviewSec}, on ${blank('DD.MM.YYYY')} (letter No. ${blank('letter No.')}), and no appeal has been or will be filed.`,
    'department has appealed': `The department has filed an appeal before ${tribunal ? 'the High Court' : 'the Appellate Tribunal'} on ${blank('DD.MM.YYYY')}. An appeal by the department does not by itself stay the appellate order or bar the refund. ${blank('The Commissioner has / has not')} ordered withholding under section 54(11), after giving the applicant an opportunity of being heard, on the ground that the grant of refund is likely to adversely affect the revenue in that appeal on account of malfeasance or fraud: see para 9.2.`,
    'review period open': `The period for the department's review under ${tribunal ? 'section 117' : 'section 112(3)'} has not yet expired. The refund is decided on the appellate order as it stands, which is binding on this office.`,
  }[v.dept] || blank("department's position: accepted on review / appeal filed / review period open")
  p(`6.3 **Department's position on the appellate order.** ${dept}`)

  // 7. Amount refundable
  h('7. Amount refundable')
  k.caption('Table 1: Amount refundable')
  const dH = Object.fromEntries(shownHeads.map(x => [x, Math.max(0, pdH[x] + opH[x] - nrH[x])]))
  const dT = shownHeads.reduce((a, x) => a + dH[x], 0)
  const row = (label, o, tot, bold = false) => {
    const f = (n) => bold ? `**${inr(n)}**` : inr(n)
    return [label, ...shownHeads.map(x => f(o[x])), f(tot)]
  }
  table(['Item', ...shownHeads.map(x => `${HEAD_LABEL[x]} (₹)`), 'Total (₹)'], [
    row(`(a) Pre-deposit paid under section 107(6), date ${pdT ? date(v.pd_date) : 'not applicable'}`, pdH, pdT),
    row(`(b) Other amounts paid towards the demand, date ${opT ? date(v.op_date) : 'not applicable'}`, opH, opT),
    row('(c) Part of (a) and (b) **not refundable** under the appellate order: (i) appropriated towards the tax, interest and penalty upheld, where no further appeal is filed; or (ii) where the upheld part is under appeal to the Tribunal, the pre-deposit under section 107(6) and other amounts paid towards that upheld part, which are retained pending that appeal (section 112(8)(b))', nrH, nrT),
    row('(d) Refundable as a consequence of the appellate order = (a) + (b) − (c)', dH, dT, true),
    row('(e) Claimed', k.claimedH, T.claimed),
  ])
  const other = 'Any **other** dues of the applicant (for example, under a different order) are not netted in this table; they can be adjusted only under section 54(10)(b) as set out in para 9.2, and only if not stayed by the specified date.'
  if (nrT) {
    const from = v.nr_from === 'other amounts' ? 'the other amounts in row (b)' : v.nr_from === 'pre-deposit' ? 'the pre-deposit in row (a)' : blank('the pre-deposit in row (a) / the other amounts in row (b)')
    p(`7.1 Row (c) is the part of the amounts paid that the appellate order has not required to be refunded. Where the upheld part is before the Tribunal, recovery of the **balance** is stayed (section 112(9)), but amounts already paid towards it are not refunded until the Tribunal decides (section 112(8)(b) requires the Tribunal pre-deposit "in addition to" the amount paid under section 107(6)). Row (c) is met first from ${from}, ${blank('state the basis')}; the attribution decides whether the amount refunded carries interest under section 115 or under section 56 (para 9.6). Of the amount refundable, ${rs(T.pdRef)} is from the pre-deposit and ${rs(T.opRef)} from the other amounts. ${other}`)
  } else p(`7.1 Row (c) is nil: the appellate order requires the whole of the amounts paid to be refunded. ${other}`)
  if (T.claimed > dT + 1) p(`7.2 The amount claimed, ${rs(T.claimed)}, exceeds the amount refundable in row (d), ${rs(dT)}; the excess is not refundable and is dealt with in para 11.`)

  hearing(k, 8, { affCol: 'Amount found not admissible on this ground (₹)' })

  // 9. Statutory conditions, with T8's own time limit and s.115 interest
  const ue = {
    'declaration (up to ₹2 lakh)': 'The applicant has filed the declaration under rule 89(2)(l) that the incidence of the amount claimed has not been passed on to any other person.',
    'CA / CMA certificate (above ₹2 lakh)': 'The applicant has filed a certificate in Annexure 2 of FORM GST RFD-01 from a Chartered Accountant / Cost Accountant under rule 89(2)(m) that the incidence has not been passed on.',
  }[v.ue_doc] || blank('declaration under rule 89(2)(l) (up to ₹2 lakh) or CA / CMA certificate under rule 89(2)(m) (above ₹2 lakh): ask for it in RFD-03 if missing')
  statutory(k, 9, `${ue} Nothing on record (the invoices of the period, the books of account or the financial statements) shows that the amount was recovered from customers. The refund is therefore payable to the applicant under section 54(8)(e).`, { interest: false })
  p(`9.5 **Time limit (section 54(7)).** The application was filed on ${date(v.filed)} (the ARN date, rule 90(2)), and sixty days from that date end on ${date(r.sixty)}. Interest on this refund is dealt with in para 9.6: interest under section 115 on the pre-deposit, and interest under section 56 only on the other amounts in Table 1, row (b). No interest under section 56 is payable on the pre-deposit.`)
  const s56 = T.opRef > 0
    ? ` On those other amounts (${rs(T.opRef)}), interest under section 56 is payable only for any delay beyond sixty days from the date of receipt of this application: ${final ? 'at nine per cent per annum under the proviso to section 56, as the appellate order has attained finality (para 6.3)' : 'at six per cent per annum, as the appellate order has not yet attained finality (para 6.3); at nine per cent under the proviso to section 56 if it attains finality'}.`
    : ''
  const rate = s.rate
  const rateWord = rate === 6 ? 'six' : rate === 9 ? 'nine' : `${rate}`
  if (T.pdRef > 0) {
    const basis = rate === 6
      ? `The rate of six per cent per annum under the main part of section 56 (Notification No. 13/2017-Central Tax) is adopted, because ${blank('basis, e.g. Board instruction No. / jurisdictional High Court ruling')}.`
      : rate === 9
        ? `The rate of nine per cent per annum under the proviso to section 56 (Notification No. 13/2017-Central Tax, as amended) is adopted, as it is held applicable to refunds arising from an appellate order that has attained finality, on the basis of ${blank('Board instruction No. / jurisdictional High Court ruling')}.`
        : `The rate of ${rate} per cent per annum is adopted, because ${blank('basis for the rate')}.`
    const credited = v.pd_mode === 'credit ledger'
      ? ` Section 115 does not say whether interest is payable on the part of a pre-deposit that is restored to the credit ledger by PMT-03; ${blank('basis adopted on that point (Board instruction / jurisdictional High Court ruling)')}.`
      : ''
    p(`9.6 **Interest under section 115 (pre-deposit).** Interest is payable on the pre-deposit of ${rs(T.pdRef)} at the rate specified under section 56, from the date of payment, ${date(v.pd_date)}, to the date of refund (the date the amount is credited to the applicant's bank account: para 34 of Circular No. 125/44/2019-GST). ${basis}${credited} Up to the expected date of credit, ${date(v.credit_date)}, it works out to:`)
    const days = s.days === null || s.days === undefined ? blank('days') : String(s.days)
    table(['Head', 'Pre-deposit refunded (₹)', 'Paid on', 'Expected date of credit', 'Days', `Interest at ${rate}% p.a. (₹)`], [
      ...shownHeads.map(x => H[x].pdRef > 0
        ? [HEAD_LABEL[x], inr(H[x].pdRef), date(v.pd_date), date(v.credit_date), days, inr(H[x].interest)]
        : [HEAD_LABEL[x], '0', '–', '–', '–', '0']),
      ['**Total**', `**${inr(T.pdRef)}**`, '', '', '', `**${inr(T.interest)}**`],
    ])
    p(`Interest is computed from the day after the payment of the pre-deposit up to and including the expected date of credit, as amount × ${rateWord} per cent × days ÷ 365, rounded to the rupee separately for each head (section 170), and only on the part of row (a) that remains in row (d). Interest under section 56 is not payable on the pre-deposit, on which interest is paid under section 115 for the whole period from payment to refund; section 56 applies only to the other amounts in Table 1, row (b).${s56}`)
  } else p(`9.6 **Interest under section 115 (pre-deposit).** No part of the pre-deposit is refunded under this order (Table 1, row (d)), so no interest under section 115 arises. Section 56 applies only to the other amounts in Table 1, row (b).${s56}`)

  // 10. Conclusion
  h('10. Conclusion')
  p(`10.1 In view of the above, I find that ${rs(T.admissible)} has become refundable to the applicant as a consequence of the appellate order, ${T.interest > 0 ? `with interest of ${rs(T.interest)} under section 115` : 'with no interest under section 115 (para 9.6)'}${T.rejected > 0 ? `, and that ${rs(T.rejected)} is not refundable for the reasons in paras 7 and 8` : ''}. Accordingly, I pass the following order.`)

  // 11. ORDER
  h('11. ORDER')
  p(`11.1 Under section 54(5) of the CGST Act read with rules 92(1), 92(1A) and 92(4), I sanction refund of **${rs(T.admissible)} (Rupees ${words(T.admissible)} only)** to the applicant, payable under section 54(8)(e), as follows:`)
  table(['Head', 'Claimed (₹)', 'Admissible (₹)', 'Paid in cash by RFD-05 (₹)', 'Re-credited to credit ledger by PMT-03 (₹)', 'Adjusted under section 54(10)(b) in this order (₹)', 'Rejected (₹)'], [
    ...shownHeads.map(x => [HEAD_LABEL[x], inr(H[x].claimed), inr(H[x].admissible), inr(H[x].net), inr(H[x].credit), inr(H[x].adj), H[x].notPaid ? `${inr(H[x].rejected)} (of which ${inr(H[x].notPaid)} not paid under section 54(14))` : inr(H[x].rejected)]),
    ['**Total**', `**${inr(T.claimed)}**`, `**${inr(T.admissible)}**`, `**${inr(T.net)}**`, `**${inr(T.credit)}**`, `**${inr(T.adj)}**`, `**${inr(T.rejected)}**`],
  ])
  p(`11.2 The amount of ${rs(T.net)} (Rupees ${words(T.net)} only) in the "cash" column shall be credited to the applicant's bank account by payment order in FORM GST RFD-05 (rule 92(4))${T.credit > 0 ? `, and the amount of ${rs(T.credit)} (${headsText(by('credit'), shownHeads, true)}) in the "credit ledger" column shall be re-credited to the electronic credit ledger by FORM GST PMT-03 (rule 92(1A))` : '; as no part of the amount refundable was paid from the electronic credit ledger, no re-credit by PMT-03 arises'}.${T.adj ? ` The amount of ${rs(T.adj)} (${headsText(k.adjH, shownHeads, true)}) adjusted under section 54(10)(b) shall be appropriated against ${or(c.order?.adj_ref, 'demand ID / order No.')}.` : ''}`)
  let para = 3
  const s56Order = T.opRef > 0 && k.late ? ' Interest under section 56 on the other amounts, as stated in para 9.6, shall be paid by a separate order under rule 94.' : ''
  if (T.interest > 0) p(`11.${para++} Under section 115, I sanction interest of **${rs(T.interest)} (Rupees ${words(T.interest)} only)** (${headsText(by('interest'), shownHeads, true)}) on the pre-deposit, computed in para 9.6 up to ${date(v.credit_date)}, the expected date of credit, to be paid by payment order in FORM GST RFD-05. If the refund is credited after that date, interest for the further period up to the date of credit shall be sanctioned by a supplementary order.${s56Order}`)
  else if (s56Order) p(`11.${para++}${s56Order}`)
  if (T.rejected > 0) {
    const what = T.claimed > dT + 1
      ? `being the part of the claim in row (e) that exceeds row (d) of Table 1${nrT ? ', that is, the amount in row (c)' : ''}`
      : `being ${blank('an amount claimed that was not in fact paid / other reason')}`
    const rowC = nrT ? ` The amount in row (c) itself ${blank('stands appropriated towards the dues upheld / is retained pending the Tribunal appeal')}.` : ''
    p(`11.${para++} Under rule 92(3), I reject refund of **${rs(T.rejected)} (Rupees ${words(T.rejected)} only)** (${headsText(k.rejH, shownHeads, true)}), ${what}, for the reasons in paras 7 and 8.${rowC} Nothing was debited from a ledger on filing this claim, so no PMT-03 re-credit arises from this rejection.`)
  }
  if (v.dept === 'department has appealed' || v.dept === 'review period open') p(`11.${para++} This order is subject to the outcome of any appeal by the department against the appellate order. If that order is modified or set aside, the amount refunded, with interest, will be recoverable under the provisions of the Act.`)

  closing(k, [`The Assistant / Deputy Commissioner (Legal / Review), ${k.office.commrte}, with reference to the department's decision on review or appeal against the order of the Appellate Authority.`])
  return k.B
}
