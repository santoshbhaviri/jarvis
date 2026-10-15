// Refund Desk: the rule 89(5) arithmetic and the checks, in plain code (never AI).
// Everything here is a pure function of the case (fields.js), so the review screen, the order and
// the tests all see the same figures. Amounts are rupees; only the final figures are rounded
// (section 170), and the ratio Net ITC ÷ ITC on inputs and input services is never rounded.
import { HEADS, FIELD, CONFIRMS } from './fields.js'

export const num = (x) => {
  if (x === null || x === undefined || x === '') return null
  const n = typeof x === 'number' ? x : Number(String(x).replace(/[₹,\s]/g, ''))
  return Number.isFinite(n) ? n : null
}
const r0 = (n) => Math.round(n)
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0)

// ── Dates (all in UTC, as plain calendar days) ──
const day = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null
}
const iso = (d) => d.toISOString().slice(0, 10)
export const ddmmyyyy = (s) => { const d = day(s); return d ? `${iso(d).slice(8, 10)}.${iso(d).slice(5, 7)}.${iso(d).slice(0, 4)}` : '' }
const addDays = (d, n) => new Date(d.getTime() + n * 86400e3)
const addYears = (d, n) => new Date(Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate()))
const daysBetween = (a, b) => Math.round((b - a) / 86400e3)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthName = (ym) => { const m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : '' }

export function monthsOf(from, to) {
  const a = /^(\d{4})-(\d{2})$/.exec(from || ''), b = /^(\d{4})-(\d{2})$/.exec(to || from || '')
  if (!a || !b) return []
  const out = []
  for (let y = +a[1], m = +a[2]; y < +b[1] || (y === +b[1] && m <= +b[2]); m === 12 ? (y++, m = 1) : m++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    if (out.length > 36) break
  }
  return out
}

// Due date of GSTR-3B for a month: the 20th of the next month; under QRMP the 22nd of the month
// after the quarter (Telangana is in the 22nd group). Extensions by notification are not known
// here, so the review screen asks the officer to check them.
export function dueDate(ym, type = 'monthly') {
  let [y, m] = ym.split('-').map(Number)
  if (type === 'quarterly') m = Math.ceil(m / 3) * 3
  const next = m === 12 ? [y + 1, 1] : [y, m + 1]
  return new Date(Date.UTC(next[0], next[1] - 1, type === 'quarterly' ? 22 : 20))
}

// Notification 13/2022-Central Tax: 01.03.2020 to 28.02.2022 is left out of the two years
const COVID = [day('2020-03-01'), day('2022-02-28')]

// Two years from the relevant date (clause (e) of Explanation 2 to s.54), for each month
export function limitation(v) {
  const filed = day(v.filed)
  const extra = num(v.excluded_days) || 0
  return monthsOf(v.from, v.to).map(ym => {
    const relevant = dueDate(ym, v.return_type)
    let ends = addDays(addYears(relevant, 2), extra)
    let covid = 0
    if (relevant <= COVID[1]) {
      covid = daysBetween(relevant > COVID[0] ? relevant : COVID[0], COVID[1]) + 1
      ends = addDays(ends, covid)
    }
    return { month: ym, relevant: iso(relevant), ends: iso(ends), covid, inTime: filed ? filed <= ends : null }
  })
}

// Head-wise split of the admissible amount (para 37 of Circular 125/44/2019-GST): IGST first,
// then CGST and SGST equally, each within what was debited and the ledger balances under it.
function split(total, caps) {
  const out = { igst: 0, cgst: 0, sgst: 0 }
  out.igst = Math.min(total, caps.igst)
  let rest = total - out.igst
  out.cgst = Math.min(caps.cgst, Math.ceil(rest / 2))
  out.sgst = Math.min(caps.sgst, rest - out.cgst)
  out.cgst = Math.min(caps.cgst, rest - out.sgst)   // SGST had less room: CGST takes the rest
  return { ...out, left: rest - out.cgst - out.sgst }
}

const STOP = 'stop', WARN = 'warn', OK = 'ok'

export function compute(c) {
  const v = c.v || {}
  const n = (k) => num(v[k])
  const flags = []
  const flag = (level, text, law = '') => flags.push({ level, text, law })

  // ── The formula ──
  const [A, B, C, D, E] = ['A', 'B', 'C', 'D', 'E'].map(n)
  const missing = ['A', 'B', 'C', 'D', 'E'].filter(k => num(v[k]) === null).map(k => FIELD[k].label)
  const claimed = Object.fromEntries(HEADS.map(h => [h, n(`claimed_${h}`) || 0]))
  const claimedTax = claimed.igst + claimed.cgst + claimed.sgst
  const end = Object.fromEntries(HEADS.map(h => [h, n(`end_${h}`)]))
  const atFiling = Object.fromEntries(HEADS.map(h => [h, n(`at_filing_${h}`)]))
  const known = (o) => ['igst', 'cgst', 'sgst'].some(h => o[h] !== null)
  const tot = (o) => known(o) ? sum(['igst', 'cgst', 'sgst'].map(h => o[h])) : null

  let steps = null
  if (missing.length) flag(STOP, `Fill in ${missing.join(', ')} to work out the refund.`, 'rule 89(5)')
  else if (B <= 0 || D <= 0) flag(STOP, 'Adjusted Total Turnover (B) and ITC on inputs and input services (D) must be more than nil.', 'rule 89(5)')
  else {
    const i = A * C / B
    const ratio = C / D
    const iii = E * ratio
    const iv = i - iii
    const vEnd = tot(end), vFiling = tot(atFiling)
    const least = Math.min(...[Math.max(0, iv), vEnd, vFiling].filter(x => x !== null))
    const admissible = Math.max(0, Math.min(r0(least), claimedTax))
    steps = { i, ratio, iii, iv, maxRefund: r0(iv), end: vEnd, atFiling: vFiling, admissible, claimed: claimedTax, rejected: Math.max(0, claimedTax - admissible) }
    if (iv <= 0) flag(STOP, 'The formula gives nil or less: no credit has accumulated on account of inversion.', 'rule 89(5)')
    if (vEnd === null || vFiling === null) flag(WARN, 'Enter the credit ledger balances at the end of the period and at filing: the refund is the least of the formula and both balances.', 'para 37 of Circular 125/44/2019-GST')
    if (admissible < r0(least) && claimedTax) flag(WARN, `The formula allows more than was claimed; only the amount claimed (₹${inr(claimedTax)}) can be sanctioned.`)
  }

  // ── Cess: the same formula on cess credit alone (para 39 of Circular 125) ──
  let cess = null
  if (claimed.cess > 0) {
    const [cC, cD, cE] = ['cess_C', 'cess_D', 'cess_E'].map(n)
    if ([cC, cD, cE].includes(null) || A === null || !B) flag(STOP, 'Cess is claimed: fill in the cess figures to apply the formula to cess credit alone.', 'para 39 of Circular 125/44/2019-GST')
    else if (cD <= 0) flag(STOP, 'Cess credit on inputs and input services must be more than nil.')
    else {
      const i = A * cC / B, iii = cE * cC / cD, iv = i - iii
      const least = Math.min(...[Math.max(0, iv), end.cess, atFiling.cess].filter(x => x !== null))
      cess = { i, iii, iv, admissible: Math.max(0, Math.min(r0(least), claimed.cess)) }
    }
  }

  // ── Head-wise ──
  let heads = null
  if (steps) {
    const cap = (h) => Math.min(...[claimed[h], end[h], atFiling[h]].filter(x => x !== null))
    const s = split(steps.admissible, { igst: cap('igst'), cgst: cap('cgst'), sgst: cap('sgst') })
    if (s.left > 0) flag(STOP, `₹${inr(s.left)} of the admissible amount does not fit under any head (debit or ledger balance too low). Check the head-wise figures.`, 'para 37 of Circular 125/44/2019-GST')
    if (s.cgst !== s.sgst) flag(WARN, `CGST (₹${inr(s.cgst)}) and SGST (₹${inr(s.sgst)}) are not equal. Check the ledger balances and the debit.`)
    const adm = { igst: s.igst, cgst: s.cgst, sgst: s.sgst, cess: cess?.admissible || 0 }
    heads = Object.fromEntries(HEADS.map(h => {
      const prov = n(`prov_${h}`) || 0
      let a = adm[h]
      const small = a > 0 && a < 1000
      if (small) a = 0
      const excess = Math.max(0, prov - a)
      return [h, { claimed: claimed[h], admissible: a, notPaid: small ? adm[h] : 0, rejected: claimed[h] - a, prov, net: Math.max(0, a - prov), excess }]
    }))
    for (const h of HEADS) {
      const x = heads[h]
      if (x.notPaid) flag(WARN, `Admissible ${h.toUpperCase()} is ₹${inr(x.notPaid)}, below ₹1,000: not paid and shown as rejected.`, 's.54(14); para 60 of Circular 125/44/2019-GST')
      if (x.excess) flag(STOP, `Provisional refund under ${h.toUpperCase()} (₹${inr(x.prov)}) is more than the admissible ₹${inr(x.admissible)}. The excess must be proposed for recovery in the RFD-08 notice with DRC-01 (stage 2 of the Refund Desk).`, 'para 3.4 of Instruction 06/2025-GST')
    }
  }
  const total = heads && Object.fromEntries(['claimed', 'admissible', 'rejected', 'prov', 'net', 'excess', 'notPaid'].map(k => [k, sum(HEADS.map(h => heads[h][k]))]))

  // ── Checks on the figures ──
  if (A !== null && B !== null && A > B) flag(STOP, 'Turnover of inverted rated supply (A) is more than the Adjusted Total Turnover (B).', 'rule 89(5)')
  if (C !== null && D !== null && C > D) flag(STOP, 'Net ITC on inputs (C) is more than ITC on inputs and input services (D).', 'Explanation (a) to rule 89(5)')
  if (A !== null && E !== null && E > A) flag(STOP, 'Tax payable (E) is more than the inverted turnover (A).')
  const outRate = n('output_rate'), inRate = n('input_rate')
  if (A && E !== null && outRate !== null && Math.abs(E / A * 100 - outRate) > 0.5) flag(WARN, `Tax payable is ${(E / A * 100).toFixed(2)}% of the inverted turnover, not the ${outRate}% output rate. Check E against GSTR-1.`)
  if (outRate !== null && inRate !== null && outRate >= inRate) flag(STOP, `The output rate (${outRate}%) is not lower than the input rate (${inRate}%), so there is no inversion.`, 'clause (ii) of the first proviso to s.54(3)')
  const oh = String(v.outward_hsn || '').replace(/\s/g, ''), ih = String(v.input_hsn || '').replace(/\s/g, '')
  if (oh && ih && oh.slice(0, 4) === ih.slice(0, 4)) flag(WARN, 'Inputs and outputs share the same HSN heading. If they are the same goods, inversion from a rate change over time does not qualify.', 'para 3.2 of Circular 135/05/2020-GST as substituted by Circular 173/05/2022-GST')
  if (/^(15|27)/.test(oh)) flag(WARN, 'Goods of chapter 15 or 27: no refund of inverted duty on applications filed on or after 18.07.2022.', 'Notification 9/2022-CT(R); Circular 181/13/2022-GST')

  const [t4a, sv, cg, bl, b2] = ['itc_4a', 'itc_services', 'itc_capital', 'itc_blocked', 'itc_2b'].map(n)
  if (t4a !== null && C !== null) {
    const calc = t4a - (sv || 0) - (cg || 0) - (bl || 0)
    if (Math.abs(calc - C) > 1) flag(WARN, `Net ITC does not reconcile: Table 4A ₹${inr(t4a)} − input services ₹${inr(sv || 0)} − capital goods ₹${inr(cg || 0)} − blocked ₹${inr(bl || 0)} = ₹${inr(calc)}, but C is ₹${inr(C)}. Explain the difference in para 7.1.`, 'drafting note to para 7.1 of T1')
  }
  if (sv !== null && C !== null && D !== null && Math.abs(C + sv - D) > 1) flag(WARN, `D should be C + input services (₹${inr(C + sv)}), but is ₹${inr(D)}.`)
  if (b2 !== null && C !== null && C > b2 + 1) flag(WARN, `Net ITC (₹${inr(C)}) is more than the input credit in GSTR-2B (₹${inr(b2)}). Check credit on imports, ISD and reverse charge before excluding anything.`, 'para 1.3 of Circular 197/09/2023-GST; para 4 of Circular 139/09/2020-GST')
  for (const h of ['igst', 'cgst', 'sgst']) {
    if (end[h] !== null && claimed[h] > end[h]) flag(WARN, `${h.toUpperCase()} claimed is more than the ledger balance at the end of the period.`, 'para 37 of Circular 125/44/2019-GST')
  }

  // Rate-wise tables against the formula
  const inv = (c.outputs || []).filter(r => r.inverted === 'yes')
  if (inv.length && A !== null && Math.abs(sum(inv.map(r => num(r.value))) - A) > 1) flag(WARN, `Inverted rows in Table 2 add up to ₹${inr(sum(inv.map(r => num(r.value))))}, not A (₹${inr(A)}).`)
  if (inv.length && E !== null && Math.abs(sum(inv.map(r => num(r.tax))) - E) > 1) flag(WARN, `Tax on inverted rows in Table 2 is ₹${inr(sum(inv.map(r => num(r.tax))))}, not E (₹${inr(E)}).`)
  const ins = (c.inputs || []).filter(r => r.kind === 'input')
  if (ins.length && C !== null && Math.abs(sum(ins.map(r => num(r.itc))) - C) > 1) flag(WARN, `Input rows in Table 1 add up to ₹${inr(sum(ins.map(r => num(r.itc))))} of ITC, not C (₹${inr(C)}).`)

  // ── Time ──
  const lim = limitation(v)
  const late = lim.filter(m => m.inTime === false)
  if (!v.filed) flag(STOP, 'Enter the date of filing to check limitation and the sixty days.')
  else if (!lim.length) flag(STOP, 'Enter the claim period (from and to).')
  else if (late.length === lim.length) flag(STOP, 'The whole claim is beyond two years from the relevant date.', 's.54(1); clause (e) of Explanation 2 to s.54')
  else if (late.length) flag(STOP, `${late.map(m => monthName(m.month)).join(', ')} ${late.length > 1 ? 'are' : 'is'} beyond two years. Enter the figures of the remaining months only.`, 's.54(1); drafting note to para 3 of T1')
  if (lim.some(m => m.covid)) flag(WARN, 'The period 01.03.2020 to 28.02.2022 has been left out of the two years.', 'Notification 13/2022-Central Tax')
  if (lim.length) flag(OK, 'GSTR-3B due dates are taken as the 20th (monthly) or 22nd (quarterly). Check for any extension notified for these months.', 'clause (e) of Explanation 2 to s.54')

  const filed = day(v.filed)
  const sixty = filed && iso(addDays(filed, 60))
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
  const daysLeft = filed ? daysBetween(today, addDays(filed, 60)) : null
  if (daysLeft !== null && daysLeft < 0) flag(WARN, `The sixty days ended on ${ddmmyyyy(sixty)}. Interest at 6% under s.56 is payable from the next day until the refund is credited.`, 's.54(7), s.56, rule 94')
  else if (daysLeft !== null && daysLeft <= 10) flag(WARN, `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of the sixty (ends ${ddmmyyyy(sixty)}).`, 's.54(7)')
  const instruction = filed && filed >= day('2025-10-01')
  if (instruction && !v.risk) flag(WARN, 'Filed on or after 01.10.2025: record the system risk category and the provisional refund (90%) or the reason it was not granted.', 'Instruction 06/2025-GST para 5.1; rule 91(2)')

  // ── Rejection needs a notice ──
  const rejecting = total && total.rejected > 0
  const grounds = (c.grounds || []).filter(g => g.text?.trim())
  if (rejecting) {
    if (!c.notice?.no || !c.notice?.date) flag(STOP, `₹${inr(total.rejected)} would be rejected. No application can be rejected without an RFD-08 notice and a hearing: enter the notice details and its grounds.`, 'rule 92(3)')
    if (!grounds.length) flag(STOP, 'Add each ground of the RFD-08 notice with the amount, so the order can decide every one.', 'rule 92(3)')
    const unanswered = grounds.filter(g => !g.finding?.trim() || !g.outcome)
    if (unanswered.length) flag(STOP, `Write your finding on ground${unanswered.length > 1 ? 's' : ''} ${unanswered.map(g => grounds.indexOf(g) + 1).join(', ')}.`, 'rule 92(3)')
    const proposed = sum(grounds.map(g => num(g.amount)))
    if (grounds.length && proposed + 1 < total.rejected) flag(STOP, `The order rejects ₹${inr(total.rejected)}, but the notice proposed only ₹${inr(proposed)}. A rejection must stand on a ground put to the applicant; issue a further RFD-08 first.`, 'rule 92(3)')
  }

  const notConfirmed = CONFIRMS.filter(x => !c.confirm?.[x.key])
  const RANK = { stop: 0, warn: 1, ok: 2 }
  flags.sort((a, b) => RANK[a.level] - RANK[b.level])
  return {
    steps, cess, heads, total, limitation: lim, sixty, daysLeft, instruction, flags,
    notConfirmed, rejecting: !!rejecting,
    ready: !flags.some(f => f.level === STOP),
  }
}

// Indian digit grouping: 12,34,567
export function inr(n, dp = 0) {
  if (n === null || n === undefined || !Number.isFinite(n)) return ''
  const neg = n < 0, x = Math.abs(n).toFixed(dp)
  const [int, frac] = x.split('.')
  const last3 = int.slice(-3), rest = int.slice(0, -3)
  const g = (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3
  return (neg ? '−' : '') + g + (frac ? '.' + frac : '')
}

// Rupees in words, Indian system: "Fifty Eight Thousand Eight Hundred and Eighty Two"
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const two = (n) => n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`
export function words(n) {
  n = Math.round(n)
  if (!n) return 'Zero'
  const parts = []
  for (const [size, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand'], [100, 'Hundred']]) {
    const q = Math.floor(n / size)
    if (q) { parts.push(`${size === 1e7 ? words(q) : two(q)} ${name}`); n %= size }
  }
  if (n) parts.push((parts.length ? 'and ' : '') + two(n))
  return parts.join(' ')
}
