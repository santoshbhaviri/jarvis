// Refund Desk: what every refund order shares, ported from the common parts of the office's
// templates (gst-orders/templates/source/src/common): the particulars table, the important note,
// provisional refund (para 5), notice and hearing (para 8), other conditions for payment (para 9),
// the conclusion and ORDER for credit and tax refunds (paras 10 and 11), and the signature with
// copies. Each category's own paragraphs are in order-t1.js to order-t8.js.
//
// Blocks: { t: 'h', text } heading · { t: 'p', text } paragraph · { t: 'table', head, rows }
//         { t: 'caption', text } · { t: 'quote', text } (a formula) · { t: 'list', items }
//         { t: 'letterhead' } · { t: 'title', lines } · { t: 'sign', officer, desig, office }
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

export const blank = (what = ' ') => `⟦${what}⟧`
export const or = (x, what) => (x !== undefined && x !== null && String(x).trim() !== '') ? String(x).trim() : blank(what)
export const date = (s, what = 'DD.MM.YYYY') => ddmmyyyy(s) || blank(what)
export const rs = (n) => `₹${inr(n || 0)}`
export const exact = (n) => inr(n, 2)
export const same = (a, b) => Math.abs((num(a) ?? NaN) - (num(b) ?? NaN)) < 1
export const headsText = (o, only = HEADS, skipNil = false) =>
  only.filter(h => (h !== 'cess' || o.cess) && (!skipNil || o[h])).map(h => `${HEAD_LABEL[h]} ${rs(o[h])}`).join(', ')
export { num, inr, words, ddmmyyyy, monthName, HEADS, HEAD_LABEL }

// Everything a category's builder needs, in one object
export function kit(c, r, office = OFFICE) {
  const v = c.v || {}, H = r.heads, T = r.total
  const B = []
  const by = (key) => Object.fromEntries(HEADS.map(h => [h, H[h][key]]))
  const ok = (k) => !!c.confirm?.[k]
  const k = {
    c, r, v, H, T, B, office,
    n: c.notice || {},
    grounds: (c.grounds || []).filter(g => g.text?.trim()),
    ok,
    confirmText: (key, yes) => ok(key) ? yes : blank(`confirm: ${CONFIRMS.find(x => x.key === key).text}`),
    period: !v.from ? '' : v.from === v.to || !v.to ? monthName(v.from) : `${monthName(v.from)} to ${monthName(v.to)}`,
    name: or(v.legal_name, 'Legal name'),
    claimedH: by('claimed'), admH: by('admissible'), rejH: by('rejected'), provH: by('prov'), adjH: by('adj'), excessH: by('excess'),
    // heads shown in tables: IGST, CGST and SGST, and cess when claimed; a category can narrow this
    shownHeads: HEADS.filter(h => h !== 'cess' || H.cess.claimed > 0),
    prov: T.prov > 0,
    late: r.daysLeft !== null && r.daysLeft < 0,
    h: (text) => B.push({ t: 'h', text }),
    p: (text) => B.push({ t: 'p', text }),
    table: (head, rows) => B.push({ t: 'table', head, rows }),
    caption: (text) => B.push({ t: 'caption', text }),
    quote: (text) => B.push({ t: 'quote', text }),
    list: (items) => B.push({ t: 'list', items }),
    // A table of rows with a total line: cols are keys of each row, money columns are summed
    rowsTable(head, list, cols, money, { totalAt = 1, fmt = {} } = {}) {
      const cell = (rw, key) => fmt[key] ? fmt[key](rw) : money.includes(key) ? inr(num(rw[key])) : or(rw[key], '')
      const body = list.length ? list.map((rw, i) => cols.map(key => key === '#' ? String(i + 1) : cell(rw, key))) : [cols.map(() => blank())]
      const tot = cols.map((key, i) => i === totalAt ? '**Total**' : money.includes(key) ? `**${inr(list.reduce((a, rw) => a + (num(rw[key]) || 0), 0))}**` : '')
      k.table(head, [...body, tot])
    },
  }
  return k
}

// ── The opening: letterhead, form title, particulars, important note ──
// m: { title, category, periodLabel, periodValue, ackRow, receiptRow, rfd04Row, claimHeads }
export function opening(k, m) {
  const { c, r, v, T, n, B, office, name } = k
  const shown = k.shownHeads
  B.push({ t: 'letterhead' })
  B.push({ t: 'title', lines: [
    'FORM GST RFD-06 [See rules 92(1), 92(3), 92(4), 92(5) and 96(7)]',
    'SPEAKING ORDER ANNEXED TO THE REFUND SANCTION / REJECTION ORDER',
    m.title,
  ] })
  const adjusted = T.adj ? `${rs(T.adj)} under section 54(10)(b)` : '₹0'
  k.table(['Particulars', 'Details'], [
    ['Order No. and date', `${or(c.order?.no, 'Order No.')} dated ${date(c.order?.date)}`],
    ['Reference No. (RFN) / DIN', `RFN ${or(c.order?.rfn, 'RFN')} generated on the common portal`],
    ['Name and address of the applicant', `${name}${v.trade_name ? ` (${v.trade_name})` : ''}, ${or(v.address, 'principal place of business')}`],
    ['GSTIN', or(v.gstin, 'GSTIN')],
    ['Refund category as selected in RFD-01', m.category],
    [m.periodLabel || 'Tax period(s)', m.periodValue ?? (k.period || blank('period'))],
    ['ARN and date of filing of RFD-01', `${or(v.arn, 'ARN')} dated ${date(v.filed)}`],
    ['Acknowledgement (RFD-02)', m.ackRow || `Issued on ${date(v.ack)}`],
    ['Date of receipt of the application for section 54(7) and section 56', m.receiptRow || `${date(v.filed)}, the date of filing (ARN), as indicated in RFD-02 (rule 90(2)); sixty days end on ${date(r.sixty)}`],
    ['Provisional refund (RFD-04)', m.rfd04Row || (k.prov ? `RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)} for ${rs(T.prov)}` : 'Not granted, reasons in para 5')],
    ['Notice (RFD-08) and reply (RFD-09)', r.rejecting ? `RFD-08 No. ${or(n.no, 'No.')} dated ${date(n.date)}; ${n.reply ? `reply dated ${date(n.reply)}` : 'no reply received'}` : 'Not issued, as the claim is sanctioned in full'],
    ['Personal hearing', r.rejecting ? `${date(n.hearing)}, attended by ${or(n.attended, 'designation of the authorised representative')}` : 'Not required, as the claim is sanctioned in full'],
    ['Amount claimed', m.claimHeads || `${shown.map(x => `${HEAD_LABEL[x]} ${rs(k.claimedH[x])}`).join('; ')}; Total ${rs(T.claimed)}`],
    ['Result', `Sanctioned ${rs(T.admissible)}; Rejected ${rs(T.rejected)}; Adjusted against dues / withheld ${adjusted} (head-wise details in para 11)`],
  ])

  k.h('IMPORTANT NOTE FOR THE APPLICANT')
  k.p('1. This copy is granted free of charge for the private use of the person to whom it is issued.')
  k.p(`2. Any person aggrieved by this order may appeal under section 107(1) of the Central Goods and Services Tax Act, 2017 (the CGST Act) to ${office.appeal} (rule 109A(1)(b) of the CGST Rules, 2017) within **three months** from the date on which this order is communicated. Under section 107(4), the Appellate Authority may allow a further period of **one month** if satisfied that there was sufficient cause.`)
  k.p('3. The appeal is to be filed **electronically in FORM GST APL-01 on the common portal**, with the documents uploaded there (rule 108). No court fee stamp is required. As this order is available on the common portal, no copy of it need be filed; if it is not available there, a self-certified copy is to be submitted within seven days of filing APL-01, failing which the appeal is treated as filed on the date the copy is submitted (rule 108(3)).')
  k.p('4. Under section 107(6), no appeal can be filed unless the appellant has paid (a) in full, the part of the tax, interest, fine, fee and penalty arising from this order that is admitted; and (b) ten per cent of the remaining **tax in dispute** arising from this order, subject to a maximum of twenty crore rupees. Where an order demands only a penalty without any demand of tax, ten per cent of that penalty is payable (proviso to section 107(6)).')
  k.p(`5. This order is passed under the CGST Act and the CGST Rules, and also under the corresponding provisions of the ${office.state} Goods and Services Tax Act, 2017 and the Integrated Goods and Services Tax Act, 2017 (the IGST Act), as applicable (the State portion is decided under section 6 of the ${office.state} Goods and Services Tax Act; IGST under section 20 of the IGST Act). The sanction and payment orders for all tax heads are issued by this office, to which the application is assigned (para 27 of Circular No. 125/44/2019-GST). A reference to a provision of the CGST Act or Rules includes the corresponding provision of those Acts and Rules.`)
}

// ── 5. Provisional refund ──
export const PROV_FIRST_ZR = 'Section 54(6) of the CGST Act, read with rule 91 of the CGST Rules, provides for refund on a provisional basis of ninety per cent of the amount claimed on account of zero-rated supply of goods or services.'
export function provisional(k, first, { beforeText } = {}) {
  const { v, r, T } = k
  k.h('5. Provisional refund')
  k.p(`5.1 ${first} Under rule 91(2), as substituted by Notification No. 13/2025-Central Tax dated 17.09.2025 with effect from 01.10.2025, the proper officer is to issue the provisional refund order in FORM GST RFD-04 within seven days of the acknowledgement, on the basis of the identification and evaluation of risk by the system. Under the first proviso to rule 91(2), the proper officer may, for reasons to be recorded in writing, decide that the applicant is not to be granted refund on a provisional basis. Instruction No. 06/2025-GST dated 03.10.2025 (paras 3.1 to 3.3) directs that ninety per cent of the amount claimed be sanctioned provisionally where the system categorises the application as "low-risk", without further scrutiny for that purpose; that applications not categorised as low-risk get no provisional refund and are scrutinised in detail; and that the first proviso to rule 91(2) be used sparingly, case by case, and not on presumptive grounds or merely because routine proceedings such as scrutiny have begun. Provisional refund is not available to the categories notified under section 54(6) by Notification No. 14/2025-Central Tax dated 17.09.2025, namely a person who has not undergone Aadhaar authentication under rule 10B, and a person engaged in the supply of areca nuts (0802 80), pan masala (2106 90 20), tobacco and manufactured tobacco substitutes (chapter 24) or essential oils (3301); nor, under rule 91(1), to a person prosecuted, during the five years before the tax period of the claim, for an offence where the tax evaded exceeds two hundred and fifty lakh rupees.`)
  const shown = k.shownHeads
  const excess = T.excess > 0
    ? ` The amount finally admissible is less than the provisional refund paid: the excess of ${rs(T.excess)} was proposed for recovery in the RFD-08 notice, with its summary in FORM GST DRC-01 (rule 142(1)(a)), under section 54 read with section ${or(k.n.recovery_sec, '73 / 74 / 74A')} (para 3.4 of Instruction No. 06/2025-GST; paras 15 and 16 of Circular No. 125/44/2019-GST) and is decided in para 11.`
    : ''
  if (beforeText && !r.instruction) k.p(`5.2 ${beforeText}`)
  else if (k.prov) k.p(`5.2 The claim was marked "low-risk" by the system. Provisional refund of ${rs(T.prov)} (${headsText(k.provH, shown, true)}), being ninety per cent of the amount claimed, was sanctioned by RFD-04 No. ${or(v.rfd04_no, 'No.')} dated ${date(v.rfd04_date)} and paid by RFD-05 dated ${date(v.rfd05_date)}. That amount is accounted for in the final sanction in para 11 under rule 92(1).${excess}`)
  else if (v.risk === 'not low-risk') k.p('5.2 The claim was not marked "low-risk" by the system. In terms of para 3.1 of Instruction No. 06/2025-GST, no provisional refund was sanctioned, and the claim has been examined in detail as set out below.')
  else if (v.risk === 'low-risk') k.p(`5.2 Although the claim was categorised as "low-risk", provisional refund was not granted, for the reasons recorded in writing on ${blank('DD.MM.YYYY')} under the first proviso to rule 91(2), namely ${blank('the specific, case-related reason')}. The reason is not presumptive and does not rest merely on routine proceedings (para 3.3 of Instruction No. 06/2025-GST).`)
  else if (v.risk === 'barred') k.p(`5.2 Provisional refund was not available because ${blank('the applicant has not undergone Aadhaar authentication under rule 10B / supplies goods covered by Notification No. 14/2025-Central Tax')} (section 54(6)).`)
  else k.p(`5.2 ${blank('system risk category and provisional refund (RFD-04), or the reason it was not granted')}`)
}

// ── 8. Notice, reply and personal hearing ──
export function hearing(k, N = 8, { affCol = 'Amount proposed (₹)' } = {}) {
  const { r, n, grounds } = k
  k.h(`${N}. Notice, reply and personal hearing`)
  if (!r.rejecting) { k.p(`${N}.1 As the claim is found admissible in full, no notice in FORM GST RFD-08 was required.`); return }
  const proposed = grounds.reduce((a, g) => a + (num(g.amount) || 0), 0)
  k.p(`${N}.1 On scrutiny, the following grounds were noticed, and a notice in FORM GST RFD-08 No. ${or(n.no, 'No.')} dated ${date(n.date)} was issued proposing to reject ${rs(proposed)} of the claim${r.total.excess ? ` and to recover ${rs(r.total.excess)} of provisional refund paid in excess, with its summary in FORM GST DRC-01 ${or(n.drc01, 'DRC-01 reference')},` : ''} and asking the applicant to reply in FORM GST RFD-09 within fifteen days:`)
  k.table(['Ground No.', 'Ground stated in the notice', 'Amount proposed for rejection (₹)'], [
    ...grounds.map((g, i) => [String(i + 1), g.title?.trim() ? `**${g.title.trim()}.** ${g.text}` : g.text, inr(num(g.amount))]),
    ['', '**Total**', `**${inr(proposed)}**`],
  ])
  if (n.reply) k.p(`${N}.2 The applicant replied in FORM GST RFD-09 on ${date(n.reply)}${n.docs ? ` and submitted ${n.docs}` : ''}. A personal hearing was held on ${date(n.hearing)}, attended by ${or(n.attended, 'designation of the authorised representative')}.`)
  else k.p(`${N}.2 No reply was received. Opportunities of personal hearing were given on ${or(n.hearing ? ddmmyyyy(n.hearing) : '', 'dates of the hearing letters')} by letters served on the portal, but no one appeared and no adjournment was sought. The matter is therefore decided on the records available, as each of the grounds below is examined on its merits.`)
  k.p(`${N}.3 **Findings on each ground.** Each ground in the notice, each point in the reply and each submission made at the hearing is dealt with below.`)
  const OUT = { rejected: 'Not accepted', accepted: 'Accepted', partly: 'Partly accepted' }
  k.table(['Ground', "Applicant's reply / submission at hearing", 'Verification done', 'Finding and provision relied on', affCol, 'Effect on refund (₹)'],
    grounds.map((g, i) => [String(i + 1), g.reply?.trim() || (n.reply ? blank('reply on this ground') : 'No reply'), or(g.verified, 'what was checked'), `${OUT[g.outcome] || blank('outcome')}: ${or(g.finding, 'finding')}`, inr(num(g.affected ?? g.amount) || num(g.amount)),
      g.outcome === 'accepted' ? 'Nil' : g.effect?.trim() || (g.outcome === 'rejected' ? `${inr(num(g.amount))} not admissible` : blank('effect on refund'))]))
  grounds.forEach((g, i) => { if (g.para?.trim()) k.p(`${N}.${4 + i} On ground ${i + 1}: ${g.para.trim()}`) })
}

// ── 9. Other conditions for payment: unjust enrichment, dues, ₹1,000, bank, time and interest ──
// interest: false leaves out para N.5, for a template that writes its own time-limit paragraph (T8)
export function statutory(k, N = 9, ueText, { interest = true } = {}) {
  const { c, r, v, H, T } = k
  k.h(`${N}. Other conditions for payment of the refund`)
  k.p(`${N}.1 **Unjust enrichment.** ${ueText}`)
  const dues = `${N}.2 **Dues and withholding (section 54(10) and 54(11)).** The arrears and liability register of the Division, the back-office demand and recovery ledger and the portal (Electronic Liability Register Part II) were checked on ${date(c.order?.dues, 'date of the dues check')}.`
  if (T.adj > 0) k.p(`${dues} The applicant owes an amount confirmed under ${or(c.order?.adj_ref, 'Order No. / demand ID')}. That amount was not stayed by any court, Tribunal or Appellate Authority by the specified date (the last date for filing an appeal). Under section 54(10)(b), ${rs(T.adj)} (${headsText(k.adjH, k.shownHeads, true)}) is deducted from the refund and **adjusted in this order** against that demand (rule 92(1); para 35 of Circular No. 125/44/2019-GST).`)
  else k.p(`${dues} ${k.ok('dues') ? 'No return was pending and no tax, interest, penalty or other amount was payable by the applicant under the CGST Act or the existing law that had not been stayed by the specified date. No amount is withheld or deducted.' : blank('result of the dues check: none / adjusted under s.54(10)(b) / withheld under s.54(10)(a) or 54(11)')}`)
  const small = HEADS.filter(x => H[x].notPaid)
  k.p(`${N}.3 **Minimum amount (section 54(14)).** ${small.length ? small.map(x => `The amount found admissible under ${HEAD_LABEL[x]} is ${rs(H[x].notPaid)}, which is less than one thousand rupees, and is therefore not paid (section 54(14); para 60 of Circular No. 125/44/2019-GST, which applies the limit to each tax head separately).`).join(' ') : 'The amount sanctioned under each tax head is not less than one thousand rupees.'}`)
  k.p(`${N}.4 **Bank account.** ${k.confirmText('bank', 'The refund will be credited to the bank account declared in the application, which is one of the accounts in the applicant\'s registration particulars and has been validated on the portal (rule 92(4)).')}`)
  if (interest) k.p(k.late
    ? `${N}.5 **Time limit and interest on delay (section 54(7), section 56 and rule 94).** The application was filed on ${date(v.filed)} (the ARN date, as indicated in RFD-02 under rule 90(2)). The sixty days ended on ${date(r.sixty)}, before this order. Under section 56 and rule 94, interest at six per cent per annum (Notification No. 13/2017-Central Tax dated 28.06.2017) is payable on the refund sanctioned from the day after that date until the date on which the amount is credited to the applicant's bank account (para 34 of Circular No. 125/44/2019-GST). Under rule 94(2), the period beyond fifteen days of receipt of any RFD-08 notice taken by the applicant to reply or to submit documents, and any period taken to correct or validate the bank account, are excluded. A separate order under rule 94(1), with FORM GST RFD-05, will specify the amount of delayed refund, the period of delay and the interest payable.`
    : `${N}.5 **Time limit and interest on delay (section 54(7), section 56 and rule 94).** The application was filed on ${date(v.filed)} (the ARN date, as indicated in RFD-02 under rule 90(2)); the period under section 54(7) and section 56 counts from that date and ends on ${date(r.sixty)}. This order and the payment order in FORM GST RFD-05 are issued within the sixty days. A refund is made only when the amount is credited to the applicant's bank account (para 34 of Circular No. 125/44/2019-GST); if the credit takes place after ${date(r.sixty)}, interest under section 56 is payable for the days of delay up to the date of credit, and will be sanctioned by a separate order under rule 94.`)
}

// The excess provisional refund confirmed for recovery (para 11.xA of the templates)
function excessPara(k, num_) {
  const { v, T, n } = k
  k.p(`${num_} The provisional refund of ${rs(T.prov)} sanctioned by RFD-04 dated ${date(v.rfd04_date)} and paid by RFD-05 dated ${date(v.rfd05_date)} exceeds the amount found admissible, ${rs(T.admissible)}, by ${rs(T.excess)}. As proposed in the notice in FORM GST RFD-08 dated ${date(n.date)}, with its summary in FORM GST DRC-01 ${or(n.drc01, 'DRC-01 reference')} under rule 142(1)(a), issued under section 54 read with section ${or(n.recovery_sec, '73 / 74 / 74A')} (para 3.4 of Instruction No. 06/2025-GST), I confirm ${rs(T.excess)} (${headsText(k.excessH, k.shownHeads, true)}) as refund erroneously paid, recoverable from the applicant with interest under section 50${n.penalty ? ` and penalty of ${rs(num(n.penalty))}` : ''}. A summary shall be issued in FORM GST DRC-07.${T.net ? '' : ' No amount is payable to the applicant under this order.'}`)
}

// ── 10 and 11. Conclusion and ORDER, for a refund of credit (T1 to T4) or of tax paid (T5, T6) ──
// m: { kind: 'itc' | 'tax', law, clause8, rejParas, taxDesc }
export function conclusionAndOrder(k, m) {
  const { r, H, T } = k
  const shown = k.shownHeads
  const rej = m.rejParas || '3, 6, 7 and 8'
  k.h('10. Conclusion')
  const what = m.taxDesc ? ` of ${m.taxDesc}` : ''
  k.p(T.rejected > 0
    ? `10.1 In view of the above, I find that the applicant is entitled to refund of ${rs(T.admissible)}${what} under ${m.law}, and that ${rs(T.rejected)} is not admissible for the reasons in paras ${rej}.${m.kind === 'itc' ? ' The inadmissible amount, having been debited from the electronic credit ledger, is to be re-credited under rule 93(2) on the conditions in para 11.4.' : ''} Accordingly, I pass the following order.`
    : `10.1 In view of the above, I find that the applicant is entitled to refund of ${rs(T.admissible)}${what}, the whole of the amount claimed, under ${m.law}. Accordingly, I pass the following order.`)

  k.h('11. ORDER')
  k.p(`11.1 Under section 54(5) of the CGST Act read with rules 92(1) and 92(4), I sanction refund of **${rs(T.admissible)} (Rupees ${words(T.admissible)} only)** to the applicant, payable under section 54(8)(${m.clause8}), as follows:`)
  const excessCol = T.excess > 0
  k.table(['Head', 'Claimed (₹)', 'Admissible (₹)', 'Provisional refund paid (₹)', 'Adjusted under section 54(10)(b) (₹)', 'Net payable now by RFD-05 (₹)', ...(excessCol ? ['Excess provisional refund recoverable (₹)'] : []), 'Rejected (₹)'], [
    ...shown.map(x => [HEAD_LABEL[x], inr(H[x].claimed), inr(H[x].admissible), inr(H[x].prov), inr(H[x].adj), inr(H[x].net), ...(excessCol ? [inr(H[x].excess)] : []), H[x].notPaid ? `${inr(H[x].rejected)} (of which ${inr(H[x].notPaid)} not paid under section 54(14))` : inr(H[x].rejected)]),
    ['**Total**', `**${inr(T.claimed)}**`, `**${inr(T.admissible)}**`, `**${inr(T.prov)}**`, `**${inr(T.adj)}**`, `**${inr(T.net)}**`, ...(excessCol ? [`**${inr(T.excess)}**`] : []), `**${inr(T.rejected)}**`],
  ])
  k.p(`11.2 The net amount of ${rs(T.net)} (Rupees ${words(T.net)} only) shall be credited to the applicant's bank account by payment order in FORM GST RFD-05 (rule 92(4)).${T.adj ? ` The amount of ${rs(T.adj)} adjusted under section 54(10)(b) shall be appropriated against ${or(k.c.order?.adj_ref, 'demand ID / order')}.` : ''}`)
  let para = 3
  if (T.rejected > 0) {
    k.p(`11.${para++} Under rule 92(3), I reject refund of **${rs(T.rejected)} (Rupees ${words(T.rejected)} only)** (${headsText(k.rejH, shown, true)}) for the reasons in paras ${r.rejecting && k.grounds.length ? rej : `${rej.split(',')[0]} and 9.3`}.`)
    if (m.kind === 'itc') k.p(`11.${para++} Under rule 93(2), the amount of ${rs(T.rejected)} (${headsText(k.rejH, shown, true)}) rejected in para 11.3, which was debited from the electronic credit ledger, shall be re-credited to that ledger by an order in FORM GST PMT-03, after the applicant gives an undertaking in writing that it will not file an appeal against this order, or, if it files an appeal, after the appeal is finally rejected (Explanation to rule 93; paras 21 and 23 of Circular No. 125/44/2019-GST). If the appeal succeeds, the applicant may file a fresh claim under the category "on account of assessment / provisional assessment / appeal / any other order" (para 24 of that Circular).`)
  }
  if (T.excess > 0) excessPara(k, `11.${para++}`)
  if (k.late) k.p(`11.${para++} Interest under section 56 on the delayed refund shall be paid by a separate order under rule 94, as stated in para 9.5.`)
}

// ── Signature, addressee and copies ──
export function closing(k, extraCopies = []) {
  const { c, v, B, office, name } = k
  B.push({ t: 'sign', officer: office.officer, desig: office.desig, office: `${office.division}, ${office.commrte}` })
  k.p(`To,\n${name} (GSTIN ${or(v.gstin, 'GSTIN')}), ${or(v.address, 'address')} (through the common portal and by e-mail to the registered e-mail address)`)
  k.p('Copy to:')
  k.list([
    `The Commissioner of Central Tax, ${office.commrte} (by name to the Assistant Commissioner (Review – Refunds), Headquarters), for review under section 107(2).`,
    `The Assistant / Deputy Commissioner (Post-Audit), ${office.commrte}, for post-audit of refund orders.`,
    `The Superintendent, ${or(c.order?.range, 'name of the')} Range, ${office.division}, for information and for updating the refund register.`,
    ...extraCopies,
    'Guard file / Office copy.',
  ])
}

// The sources table of para 7.1: one row per figure, with any other figure found and why it lost.
// Each entry: [key, label, adopted, basis, paras]. basis (optional) is the template's "source used"
// text, printed before where the figure was read; paras (optional, default '6') are the paras that
// give the reasons when the adopted figure differs from the one claimed.
export function sourcesTable(k, comp) {
  const { c, v } = k
  k.table(['Component', 'Source used', 'Adopted (₹)', 'Other figure found and reason for the difference'],
    comp.map(([key, label, adopted, basis, paras = '6']) => {
      const was = c.edited?.[key], alt = c.alt?.[key] || []
      const other = [
        ...(was && !same(was.value, v[key]) ? [`${inr(num(was.value))} as read from ${was.src}, corrected on verification: ${blank('reason')}`] : []),
        ...(alt.length ? [`${alt.map(a => `${inr(num(a.value))} in ${a.src}`).join('; ')}: ${blank('reason for not adopting')}`] : []),
        ...(adopted !== undefined && num(v[key]) !== null && !same(adopted, v[key]) ? [`${inr(num(v[key]))} as claimed; ${inr(adopted)} adopted on verification, for the reasons in para${/,| and /.test(paras) ? 's' : ''} ${paras}`] : []),
      ]
      const source = basis ? `${basis}${c.src?.[key] ? `; read from ${c.src[key]}` : ''}` : or(c.src?.[key], 'source')
      return [label, source, inr(adopted ?? num(v[key])), other.join('. ') || 'None']
    }))
}

// The limitation table for rows checked one by one (shipping bills, invoices, remittances)
export function limitTable(k, rows, what = 'Document') {
  if (!rows.length) return
  k.table([what, 'Relevant date', 'Two years end on', 'Within time'], rows.map(m => [m.label, m.relevant ? ddmmyyyy(m.relevant) : blank(), m.ends ? ddmmyyyy(m.ends) : blank(), m.inTime === false ? 'No' : m.inTime ? 'Yes' : blank()]))
}
