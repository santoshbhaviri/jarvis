// Refund Desk: the arithmetic and the checks for the eight refund categories (templates T1 to T8),
// in plain code (never AI). Everything here is a pure function of the case (fields.js), so the
// review screen, the order and the tests all see the same figures. Amounts are rupees; only the
// final figures are rounded (section 170), and no ratio inside a formula is ever rounded.
//
//   T1           rule 89(5): inverted duty structure
//   T2, T3, T4   rule 89(4): zero-rated supplies under LUT, refund of unutilised credit
//   T5, T6       IGST paid on exports of services and on supplies to an SEZ, invoice by invoice
//   T7           excess balance in the electronic cash ledger, entry by entry
//   T8           pre-deposit and other amounts paid, after an appellate order, with s.115 interest
import { HEADS, FIELD, PROV_CATS, confirmsFor } from './fields.js'

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

// Two years from a relevant date (s.54(1)), leaving out 01.03.2020 to 28.02.2022 where the two
// years had not run out by then, and any days excluded under the proviso to rule 90(3)
export function twoYears(relevant, v) {
  const rel = typeof relevant === 'string' ? day(relevant) : relevant
  if (!rel) return null
  const filed = day(v.filed)
  let ends = addDays(addYears(rel, 2), num(v.excluded_days) || 0)
  let covid = 0
  if (rel <= COVID[1] && addYears(rel, 2) >= COVID[0]) {
    covid = daysBetween(rel > COVID[0] ? rel : COVID[0], COVID[1]) + 1
    ends = addDays(ends, covid)
  }
  return { relevant: iso(rel), ends: iso(ends), covid, inTime: filed ? filed <= ends : null }
}

// Clause (e) of Explanation 2 to s.54 (and (ba) for SEZ supplies): two years from the GSTR-3B due
// date, for each month of the claim
export function limitation(v) {
  return monthsOf(v.from, v.to).map(ym => ({ month: ym, label: monthName(ym), ...twoYears(dueDate(ym, v.return_type), v) }))
}

// Head-wise split of the admissible credit (para 37 of Circular 125/44/2019-GST): IGST first,
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
const TAX3 = ['igst', 'cgst', 'sgst']
const headsOf = (n, key) => Object.fromEntries(HEADS.map(h => [h, n(`${key}_${h}`)]))
const tot3 = (o) => TAX3.some(h => o[h] !== null) ? sum(TAX3.map(h => o[h])) : null
const label = (k) => FIELD[k]?.label || k
const monthOfDate = (s) => /^\d{4}-\d{2}/.test(s || '') ? s.slice(0, 7) : null

// ── Shared by the credit categories (T1 to T4) ──

// The refund is the least of the formula and the ledger balances at the end of the period and at
// filing (para 37 of Circular 125/44/2019-GST), and never more than was claimed
function ledgerLeast(x, formula) {
  const { n, flag, claimed } = x
  const end = headsOf(n, 'end'), atFiling = headsOf(n, 'at_filing')
  const vEnd = tot3(end), vFiling = tot3(atFiling)
  const least = Math.min(...[Math.max(0, formula), vEnd, vFiling].filter(z => z !== null))
  const claimedTax = sum(TAX3.map(h => claimed[h]))
  const admissible = Math.max(0, Math.min(r0(least), claimedTax))
  if (vEnd === null || vFiling === null) flag(WARN, 'Enter the credit ledger balances at the end of the period and at filing: the refund is the least of the formula and both balances.', 'para 37 of Circular 125/44/2019-GST')
  if (admissible < r0(least) && claimedTax) flag(WARN, `The formula allows more than was claimed; only the amount claimed (₹${inr(claimedTax)}) can be sanctioned.`)
  for (const h of TAX3) {
    if (end[h] !== null && claimed[h] > end[h]) flag(WARN, `${h.toUpperCase()} claimed is more than the ledger balance at the end of the period.`, 'para 37 of Circular 125/44/2019-GST')
  }
  return { maxRefund: r0(formula), end: vEnd, atFiling: vFiling, admissible, claimed: claimedTax, rejected: Math.max(0, claimedTax - admissible), endH: end, atFilingH: atFiling }
}

function creditHeads(x, steps, cessAdmissible) {
  const { flag, claimed } = x
  const cap = (h) => Math.min(...[claimed[h], steps.endH[h], steps.atFilingH[h]].filter(z => z !== null))
  const s = split(steps.admissible, { igst: cap('igst'), cgst: cap('cgst'), sgst: cap('sgst') })
  if (s.left > 0) flag(STOP, `₹${inr(s.left)} of the admissible amount does not fit under any head (debit or ledger balance too low). Check the head-wise figures.`, 'para 37 of Circular 125/44/2019-GST')
  if (s.cgst !== s.sgst) flag(WARN, `CGST (₹${inr(s.cgst)}) and SGST (₹${inr(s.sgst)}) are not equal. Check the ledger balances and the debit.`)
  return { igst: s.igst, cgst: s.cgst, sgst: s.sgst, cess: cessAdmissible || 0 }
}

// Cess: the same formula on cess credit alone, within the cess balances (para 39 of Circular 125)
function cessLeast(x, formula) {
  const { n, claimed } = x
  const least = Math.min(...[Math.max(0, formula), n('end_cess'), n('at_filing_cess')].filter(z => z !== null))
  return Math.max(0, Math.min(r0(least), claimed.cess))
}

function checkNetItc(x, net, { services = false } = {}) {
  const { n, flag } = x
  const [t4a, sv, cg, bl, b2] = ['itc_4a', 'itc_services', 'itc_capital', 'itc_blocked', 'itc_2b'].map(n)
  if (t4a !== null && net !== null) {
    const calc = t4a - (services ? sv || 0 : 0) - (cg || 0) - (bl || 0)
    if (Math.abs(calc - net) > 1) flag(WARN, `Net ITC does not reconcile: Table 4A ₹${inr(t4a)}${services ? ` − input services ₹${inr(sv || 0)}` : ''} − capital goods ₹${inr(cg || 0)} − blocked ₹${inr(bl || 0)} = ₹${inr(calc)}, but Net ITC is ₹${inr(net)}. Explain the difference in para 7.1.`, 'drafting note to para 7.1')
  }
  if (b2 !== null && net !== null && net > b2 + 1) flag(WARN, `Net ITC (₹${inr(net)}) is more than the credit in GSTR-2B (₹${inr(b2)}). Check credit on imports, ISD and reverse charge before excluding anything.`, 'para 1.3 of Circular 197/09/2023-GST; para 4 of Circular 139/09/2020-GST')
}

function monthLimits(x, law) {
  const { v, flag } = x
  const lim = limitation(v)
  const late = lim.filter(m => m.inTime === false)
  if (v.filed && !lim.length) flag(STOP, 'Enter the claim period (from and to).')
  else if (lim.length && late.length === lim.length) flag(STOP, 'The whole claim is beyond two years from the relevant date.', `s.54(1); ${law}`)
  else if (late.length) flag(STOP, `${late.map(m => m.label).join(', ')} ${late.length > 1 ? 'are' : 'is'} beyond two years. Enter the figures of the remaining months only.`, `s.54(1); ${law}`)
  if (lim.length) flag(OK, 'GSTR-3B due dates are taken as the 20th (monthly) or 22nd (quarterly). Check for any extension notified for these months.', law)
  return lim
}

// Rows of a table, each with its relevant date and two years, and why it is left out (if it is)
function dated(x, list, relevantOf, what) {
  const { v, flag } = x
  return list.map((r, i) => {
    const rel = relevantOf(r)
    const lim = twoYears(rel, v)
    const why = []
    if (!lim) why.push('relevant date not entered')
    else if (lim.inTime === false) why.push(`beyond two years from the relevant date ${ddmmyyyy(lim.relevant)}`)
    if (!lim && v.filed) flag(STOP, `${what} ${i + 1}: enter the date that gives its relevant date.`)
    return { i, label: `${what} ${i + 1}${r.sb ? ` (${r.sb})` : r.inv ? ` (${r.inv})` : ''}`, ...(lim || {}), why }
  })
}

const notIn = (rr, amountOf) => rr.filter(r => r.why.length).map(r => ({ ...r, amount: amountOf(r) }))

// ── T1: inverted duty structure, rule 89(5) ──
function calcT1(x) {
  const { c, v, n, flag, claimed, rows } = x
  const [A, B, C, D, E] = ['A', 'B', 'C', 'D', 'E'].map(n)
  const missing = ['A', 'B', 'C', 'D', 'E'].filter(k => n(k) === null).map(label)
  let steps = null, adm = null, cess = null
  if (missing.length) flag(STOP, `Fill in ${missing.join(', ')} to work out the refund.`, 'rule 89(5)')
  else if (B <= 0 || D <= 0) flag(STOP, 'Adjusted Total Turnover (B) and ITC on inputs and input services (D) must be more than nil.', 'rule 89(5)')
  else {
    const i = A * C / B
    const ratio = C / D
    const iii = E * ratio
    const iv = i - iii
    steps = { i, ratio, iii, iv, ...ledgerLeast(x, iv) }
    if (iv <= 0) flag(STOP, 'The formula gives nil or less: no credit has accumulated on account of inversion.', 'rule 89(5)')
  }
  if (claimed.cess > 0) {
    const [cC, cD, cE] = ['cess_C', 'cess_D', 'cess_E'].map(n)
    if ([cC, cD, cE].includes(null) || A === null || !B) flag(STOP, 'Cess is claimed: fill in the cess figures to apply the formula to cess credit alone.', 'para 39 of Circular 125/44/2019-GST')
    else if (cD <= 0) flag(STOP, 'Cess credit on inputs and input services must be more than nil.')
    else {
      const i = A * cC / B, iii = cE * cC / cD, iv = i - iii
      cess = { i, iii, iv, admissible: cessLeast(x, iv) }
    }
  }
  if (steps) adm = creditHeads(x, steps, cess?.admissible)

  if (A !== null && B !== null && A > B) flag(STOP, 'Turnover of inverted rated supply (A) is more than the Adjusted Total Turnover (B).', 'rule 89(5)')
  if (C !== null && D !== null && C > D) flag(STOP, 'Net ITC on inputs (C) is more than ITC on inputs and input services (D).', 'Explanation (a) to rule 89(5)')
  if (A !== null && E !== null && E > A) flag(STOP, 'Tax payable (E) is more than the inverted turnover (A).')
  const outRate = n('output_rate'), inRate = n('input_rate')
  if (A && E !== null && outRate !== null && Math.abs(E / A * 100 - outRate) > 0.5) flag(WARN, `Tax payable is ${(E / A * 100).toFixed(2)}% of the inverted turnover, not the ${outRate}% output rate. Check E against GSTR-1.`)
  if (outRate !== null && inRate !== null && outRate >= inRate) flag(STOP, `The output rate (${outRate}%) is not lower than the input rate (${inRate}%), so there is no inversion.`, 'clause (ii) of the first proviso to s.54(3)')
  const oh = String(v.outward_hsn || '').replace(/\s/g, ''), ih = String(v.input_hsn || '').replace(/\s/g, '')
  if (oh && ih && oh.slice(0, 4) === ih.slice(0, 4)) flag(WARN, 'Inputs and outputs share the same HSN heading. If they are the same goods, inversion from a rate change over time does not qualify.', 'para 3.2 of Circular 135/05/2020-GST as substituted by Circular 173/05/2022-GST')
  if (/^(15|27)/.test(oh)) flag(WARN, 'Goods of chapter 15 or 27: no refund of inverted duty on applications filed on or after 18.07.2022.', 'Notification 9/2022-CT(R); Circular 181/13/2022-GST')
  checkNetItc(x, C, { services: true })
  const sv = n('itc_services')
  if (sv !== null && C !== null && D !== null && Math.abs(C + sv - D) > 1) flag(WARN, `D should be C + input services (₹${inr(C + sv)}), but is ₹${inr(D)}.`)

  // Rate-wise tables against the formula
  const inv = rows('outputs').filter(r => r.inverted === 'yes')
  if (inv.length && A !== null && Math.abs(sum(inv.map(r => num(r.value))) - A) > 1) flag(WARN, `Inverted rows in Table 2 add up to ₹${inr(sum(inv.map(r => num(r.value))))}, not A (₹${inr(A)}).`)
  if (inv.length && E !== null && Math.abs(sum(inv.map(r => num(r.tax))) - E) > 1) flag(WARN, `Tax on inverted rows in Table 2 is ₹${inr(sum(inv.map(r => num(r.tax))))}, not E (₹${inr(E)}).`)
  const ins = rows('inputs').filter(r => r.kind === 'input')
  if (ins.length && C !== null && Math.abs(sum(ins.map(r => num(r.itc))) - C) > 1) flag(WARN, `Input rows in Table 1 add up to ₹${inr(sum(ins.map(r => num(r.itc))))} of ITC, not C (₹${inr(C)}).`)

  return { steps, adm, cess, lim: monthLimits(x, 'clause (e) of Explanation 2 to s.54') }
}

// ── T2 to T4: zero-rated supplies under LUT, rule 89(4) ──
function calcR894(x) {
  const { c, v, n, flag, claimed, rows, cat } = x
  let goods = cat === 'T3' ? 0 : n('zr_goods'), services = n('zr_services')
  const claimedZR = (cat === 'T3' ? 0 : n('zr_goods') || 0) + (n('zr_services') || 0)
  let fromD = null
  if (cat !== 'T2') {
    const [a, b, cc] = ['d_a', 'd_b', 'd_c'].map(n)
    if ([a, b, cc].some(z => z !== null)) {
      fromD = (a || 0) + (b || 0) - (cc || 0)
      if (services !== null && Math.abs(fromD - services) > 1) flag(WARN, `Turnover of zero-rated services claimed (₹${inr(services)}) is not (a) + (b) − (c) = ₹${inr(fromD)}. The rule 89(4)(D) figure is adopted.`, 'rule 89(4)(D)')
      services = fromD
    }
  }
  let rr = [], left = [], numerator = null, excluded = 0, lim = []

  if (cat === 'T2') {
    const list = rows('exports')
    rr = dated(x, list, r => r.egm, 'Shipping bill').map((r, i) => {
      const fob = num(list[i].fob), invv = num(list[i].inv_value)
      const lower = [fob, invv].filter(z => z !== null)
      return { ...r, fob, inv: invv, value: lower.length ? Math.min(...lower) : 0 }
    })
    if (list.length) {
      const all = sum(rr.map(r => r.value))
      left = notIn(rr, r => r.value)
      excluded = sum(left.map(r => r.amount))
      if (n('zr_goods') !== null && Math.abs(all - n('zr_goods')) > 1) flag(WARN, `The shipping bills add up to ₹${inr(all)} at the lower of FOB and invoice value, but the claim shows ₹${inr(n('zr_goods'))} as the turnover of zero-rated goods. The lower value is adopted, in the numerator and the Adjusted Total Turnover alike.`, 'Explanation to rule 89(4); para 3 of Circular 197/09/2023-GST')
      goods = all - excluded
    } else if (v.filed) flag(STOP, 'Enter each shipping bill in Table 1, with its EGM date and FOB value: the relevant date and the value are worked out shipping bill by shipping bill.', 'clause (a) of Explanation 2 to s.54')
    if (v.drawback === 'including central tax') flag(STOP, 'Drawback including the central tax portion was claimed: no refund of input tax credit is allowed on those exports.', 'last proviso to s.54(3); para 40 of Circular 125/44/2019-GST')
    if (v.export_duty === 'yes') flag(STOP, 'The goods are subject to export duty: no refund of unutilised credit is allowed.', 'second proviso to s.54(3)')
    numerator = (goods || 0) + (services || 0)
  } else if (cat === 'T3') {
    const list = rows('remits')
    rr = dated(x, list, r => r.advance === 'advance' ? r.inv_date : r.firc_date, 'Invoice').map((r, i) => ({ ...r, value: num(list[i].realised) ?? num(list[i].inv_value) ?? 0 }))
    if (list.length) {
      left = notIn(rr, r => r.value)
      excluded = sum(left.map(r => r.amount))
    } else if (v.filed) flag(STOP, 'Enter each invoice and its remittance in Table 1: the relevant date is the date of each remittance (or the invoice date for an advance).', 'clause (c) of Explanation 2 to s.54')
    numerator = services === null ? null : services - excluded
  } else {
    const list = rows('sez')
    rr = dated(x, list, r => monthOfDate(r.inv_date) && dueDate(monthOfDate(r.inv_date), v.return_type), 'Invoice').map((r, i) => {
      const row = list[i], why = [...r.why]
      if (!String(row.endorsement || '').trim()) why.push('no endorsement of the specified officer')
      if (row.authorised !== 'yes') why.push('not shown to be for authorised operations')
      return { ...r, why, value: num(row.value) || 0 }
    })
    if (list.length) {
      left = notIn(rr, r => r.value)
      excluded = sum(left.map(r => r.amount))
      const all = sum(rr.map(r => r.value))
      if (claimedZR && Math.abs(all - claimedZR) > 1) flag(WARN, `The SEZ invoices add up to ₹${inr(all)}, but the claim shows ₹${inr(claimedZR)} as zero-rated turnover.`)
      numerator = all - excluded
    } else {
      numerator = (goods || 0) + (services || 0)
      lim = monthLimits(x, 'clause (ba) of Explanation 2 to s.54')
    }
  }
  if (rr.length) lim = rr

  for (const r of left) flag(WARN, `${r.label}: ₹${inr(r.amount)} left out of the zero-rated turnover (${r.why.join('; ')}). It stays in the Adjusted Total Turnover. Put it to the applicant in the RFD-08 notice.`, cat === 'T4' ? 'proviso to rule 89(1); rule 89(2)(d), (e)' : 's.54(1); Explanation 2 to s.54')

  const ato = n('ato'), net = n('net_itc')
  const need = [['ato', ato], ['net_itc', net]].filter(([, z]) => z === null).map(([k]) => label(k))
  if (numerator === null) need.unshift(cat === 'T3' ? 'the turnover of zero-rated services ((a), (b) and (c))' : 'the zero-rated turnover')
  let steps = null, adm = null, cess = null
  if (need.length) flag(STOP, `Fill in ${need.join(', ')} to work out the refund.`, 'rule 89(4)')
  else if (ato <= 0) flag(STOP, 'Adjusted Total Turnover must be more than nil.', 'rule 89(4)(E)')
  else {
    if (numerator > ato + 1) flag(STOP, `The zero-rated turnover (₹${inr(numerator + excluded)}) is more than the Adjusted Total Turnover (₹${inr(ato)}). The same value must go into both.`, 'rule 89(4)(E); para 3 of Circular 197/09/2023-GST')
    const formula = numerator * net / ato
    const asClaimed = claimedZR && Math.abs(claimedZR - numerator) > 1 ? claimedZR * net / ato : null
    steps = { goods, services, fromD, excluded, numerator, ato, net, formula, asClaimed, ...ledgerLeast(x, formula) }
    if (formula <= 0) flag(STOP, 'The formula gives nil.', 'rule 89(4)')
  }
  if (claimed.cess > 0) {
    const cC = n('cess_C')
    if (cC === null || !steps) flag(STOP, 'Cess is claimed: enter the Net ITC of cess to apply the formula to cess credit alone.', 'para 39 of Circular 125/44/2019-GST')
    else { const f = numerator * cC / ato; cess = { formula: f, admissible: cessLeast(x, f) } }
  }
  if (steps) adm = creditHeads(x, steps, cess?.admissible)
  checkNetItc(x, net)
  if (cat !== 'T2' && n('d_c') !== null && n('d_a') !== null && n('d_c') > n('d_a')) flag(STOP, 'Advances for services not completed ((c)) are more than all payments received ((a)).', 'rule 89(4)(D)')
  return { steps, adm, cess, lim, rows: rr, left }
}

// ── T5, T6: IGST paid on a zero-rated supply ──
function calcTax(x) {
  const { v, n, flag, claimed, rows, cat } = x
  const key = cat === 'T5' ? 'taxinv' : 'seztax'
  const list = rows(key)
  const rr = dated(x, list,
    cat === 'T5' ? r => r.advance === 'advance' ? r.inv_date : r.firc_date : r => monthOfDate(r.inv_date) && dueDate(monthOfDate(r.inv_date), v.return_type),
    'Invoice').map((r, i) => {
    const row = list[i], why = [...r.why]
    if (cat === 'T5') {
      if (row.export === 'no') why.push('not an export of services under s.2(6) of the IGST Act')
      if (row.in_gstr1 === 'no') why.push('not shown in GSTR-1 Table 6A')
    } else {
      if (!String(row.endorsement || '').trim()) why.push('no endorsement of the specified officer')
      if (row.authorised !== 'yes') why.push('not shown to be for authorised operations')
      if (row.collected === 'yes') why.push('tax collected from the SEZ unit or developer (rule 89(2)(f))')
      if (row.in_gstr1 === 'no') why.push('not shown in GSTR-1 Table 6B')
    }
    return { ...r, why, igst: num(row.igst) || 0, cess: num(row.cess) || 0 }
  })
  const left = notIn(rr, r => r.igst + r.cess)
  for (const r of left) flag(WARN, `${r.label}: tax of ₹${inr(r.amount)} not admissible (${r.why.join('; ')}). Put it to the applicant in the RFD-08 notice.`, cat === 'T5' ? 's.54(1); s.2(6) of the IGST Act' : 'clause (ba) of Explanation 2 to s.54; rule 89(2)(f)')
  const [g1, b3] = [n('tax_gstr1'), n('tax_3b')]
  let igst, cess = 0
  if (list.length) {
    igst = sum(rr.filter(r => !r.why.length).map(r => r.igst))
    cess = sum(rr.filter(r => !r.why.length).map(r => r.cess))
    const all = sum(rr.map(r => r.igst))
    if (Math.abs(all - claimed.igst) > 1) flag(WARN, `IGST on the invoices in Table 1 adds up to ₹${inr(all)}, but ₹${inr(claimed.igst)} is claimed.`)
  } else {
    igst = claimed.igst
    if (v.filed) flag(STOP, 'Enter each invoice in Table 1: the relevant date and the conditions are checked invoice by invoice.', cat === 'T5' ? 'rule 89(2)(c)' : 'rule 89(2)(d), (e)')
  }
  if (g1 !== null && b3 !== null && Math.abs(g1 - b3) > 1) flag(WARN, `IGST in GSTR-1 (₹${inr(g1)}) does not agree with GSTR-3B Table 3.1(b) (₹${inr(b3)}).`, 'rule 89(2)(c)')
  if (b3 !== null && igst > b3) { flag(WARN, `Only ₹${inr(b3)} of IGST was paid in GSTR-3B; the refund cannot be more than the tax paid.`, 's.16(4) of the IGST Act'); igst = b3 }
  if (claimed.cgst || claimed.sgst) flag(WARN, 'CGST or SGST is claimed. A zero-rated supply is an inter-State supply: only IGST (and cess) can be refunded under this category.', 's.7(5) of the IGST Act')
  if (cat === 'T6') {
    const claimedTotal = claimed.igst + claimed.cess
    if (v.ue_doc === 'not filed' || !v.ue_doc) flag(STOP, 'Enter the unjust enrichment document: a declaration (claims up to ₹2 lakh) or a CA / CMA certificate (above ₹2 lakh).', 'rule 89(2)(l), (m); s.54(8)(e)')
    else if (claimedTotal > 200000 && /declaration/.test(v.ue_doc)) flag(STOP, `The claim is ₹${inr(claimedTotal)}, above ₹2 lakh: a CA / CMA certificate under rule 89(2)(m) is needed, not a declaration.`, 'rule 89(2)(m)')
  }
  const adm = { igst: Math.min(igst, claimed.igst), cgst: 0, sgst: 0, cess: Math.min(cess, claimed.cess) }
  return { steps: { rowsTotal: sum(rr.map(r => r.igst)), igst: adm.igst, cess: adm.cess }, adm, lim: rr, rows: rr, left }
}

// ── T7: excess balance in the electronic cash ledger (s.49(6)) ──
function calcT7(x) {
  const { n, flag, claimed, rows } = x
  const list = rows('cashrows')
  const cash = headsOf(n, 'cash')
  const adm = {}, fromRows = {}
  list.forEach((r, i) => {
    const cr = num(r.credited), used = num(r.used) || 0, cl = num(r.claimed) || 0
    if (cr !== null && cl > cr - used + 1) flag(WARN, `Entry ${i + 1}: ₹${inr(cl)} claimed, but only ₹${inr(cr - used)} of it is unutilised.`)
    if (!HEADS.includes(r.head)) flag(STOP, `Entry ${i + 1}: choose the head.`)
    if (r.refundable === 'no') flag(WARN, `Entry ${i + 1}${r.entry ? ` (${r.entry})` : ''}: ₹${inr(cl)} marked not refundable. Put it to the applicant in the RFD-08 notice.`, 's.49(6); Circular 166/22/2021-GST')
  })
  for (const h of HEADS) {
    const mine = list.filter(r => r.head === h)
    fromRows[h] = sum(mine.map(r => num(r.claimed)))
    let a = list.length ? sum(mine.filter(r => r.refundable !== 'no').map(r => num(r.claimed))) : claimed[h]
    if (list.length && Math.abs(fromRows[h] - claimed[h]) > 1) flag(WARN, `${h.toUpperCase()}: the entries in Table 1 add up to ₹${inr(fromRows[h])}, but ₹${inr(claimed[h])} is claimed.`)
    if (cash[h] !== null && a > cash[h]) { flag(WARN, `${h.toUpperCase()} refundable is more than the cash ledger balance at filing (₹${inr(cash[h])}).`, 's.49(6)'); a = cash[h] }
    adm[h] = Math.max(0, Math.min(a, claimed[h]))
  }
  if (!list.length && sum(HEADS.map(h => claimed[h]))) flag(STOP, 'Enter what the balance is made of in Table 1 (each challan, or TDS / TCS credit), so that every credit is checked.', 's.49(6); Circular 166/22/2021-GST')
  flag(OK, 'No time limit applies to a refund of excess balance in the cash ledger.', 'S. No. 1 of Circular 166/22/2021-GST')
  const left = list.map((r, i) => ({ i, label: `Entry ${i + 1}${r.entry ? ` (${r.entry})` : ''}`, head: r.head, amount: num(r.claimed) || 0, why: [String(r.remarks || '').trim() || 'not refundable on verification'] }))
    .filter((r, i) => list[i].refundable === 'no')
  return { steps: { fromRows, cash }, adm, lim: [], left }
}

// ── T8: pre-deposit and amounts paid, after an appellate order ──
function calcT8(x) {
  const { v, n, flag, claimed } = x
  const rate = n('int_rate') ?? 6
  const pdDay = day(v.pd_date), crDay = day(v.credit_date)
  const days = pdDay && crDay ? daysBetween(pdDay, crDay) : null
  const adm = {}, extra = {}
  for (const h of HEADS) {
    const pd = n(`pd_${h}`) || 0, op = n(`op_${h}`) || 0, nr = n(`nr_${h}`) || 0
    let pdRef, opRef
    if (v.nr_from === 'other amounts') { opRef = Math.max(0, op - nr); pdRef = Math.max(0, pd - Math.max(0, nr - op)) }
    else { pdRef = Math.max(0, pd - nr); opRef = Math.max(0, op - Math.max(0, nr - pd)) }
    let d = pdRef + opRef
    if (d > claimed[h]) {        // never more than claimed: the other amounts give way first
      const cut = d - claimed[h]
      const fromOp = Math.min(cut, opRef)
      opRef -= fromOp; pdRef -= cut - fromOp; d = claimed[h]
      if (cut > 1) flag(WARN, `${h.toUpperCase()}: rows (a) + (b) − (c) come to more than claimed; only the ₹${inr(claimed[h])} claimed can be sanctioned.`)
    }
    const cash = (v.pd_mode === 'credit ledger' ? 0 : pdRef) + (v.op_mode === 'credit ledger' ? 0 : opRef)
    const interest = days !== null && days > 0 ? r0(pdRef * rate / 100 * days / 365) : 0
    adm[h] = d
    extra[h] = { pd, op, nr, pdRef, opRef, cash, credit: d - cash, interest }
  }
  const paid = sum(HEADS.map(h => extra[h].pd + extra[h].op))
  if (!paid) flag(STOP, 'Enter the pre-deposit (row (a)) and any other amounts paid (row (b)), head by head.', 'rule 89(2)(a)')
  if (!v.pd_mode && sum(HEADS.map(h => extra[h].pd))) flag(WARN, 'Say whether the pre-deposit was paid from the cash or the credit ledger: the cash part is paid to the bank, the credit part re-credited by PMT-03.', 'rule 92(1A)')
  if (sum(HEADS.map(h => extra[h].pdRef)) && days === null) flag(WARN, 'Enter the pre-deposit date and the expected date of credit to work out interest under s.115.', 's.115')
  if (v.ao_result === 'allowed in part' && !sum(HEADS.map(h => extra[h].nr))) flag(WARN, 'The appeal was allowed in part: enter in row (c) the part of the amounts paid that goes towards the demand upheld.', 'Option B of para 6.1 of T8')
  if (v.ao_result === 'remanded') flag(WARN, 'The matter is remanded: record the basis adopted (jurisdictional High Court or Board instruction) on whether the pre-deposit is refundable before the fresh order.', 'Option C of para 6.1 of T8')
  if (v.dept === 'department has appealed') flag(WARN, "The department has appealed. That does not stay the appellate order or bar the refund; only the Commissioner can withhold under s.54(11), with reasons and a hearing.", 's.54(11)')
  if (v.dept === 'review period open') flag(WARN, "The department's review period is still open. The appellate order binds this office until it is stayed or set aside.", 's.112(3); s.54(11)')
  if (rate !== 6 && rate !== 9) flag(WARN, `Interest under s.115 is taken at ${rate}%: the rate is 6%, or 9% where the proviso to s.56 applies.`, 'Notification 13/2017-Central Tax')
  const rel = twoYears(v.ao_comm, v)
  const lim = rel ? [{ label: 'Appellate order communicated', ...rel }] : []
  if (!rel && v.filed) flag(STOP, 'Enter the date the appellate order was communicated: it is the relevant date.', 'clause (d) of Explanation 2 to s.54')
  if (rel?.inTime === false) flag(STOP, `The application is beyond two years from the communication of the appellate order (${ddmmyyyy(rel.relevant)}).`, 's.54(1); clause (d) of Explanation 2 to s.54')
  return { steps: { days, rate }, adm, extra, lim }
}

const CALC = { T1: calcT1, T2: calcR894, T3: calcR894, T4: calcR894, T5: calcTax, T6: calcTax, T7: calcT7, T8: calcT8 }

export function compute(c) {
  const cat = CALC[c.cat] ? c.cat : 'T1'
  const v = c.v || {}
  const n = (k) => num(v[k])
  const flags = []
  const flag = (level, text, law = '') => flags.push({ level, text, law })
  const rows = (k) => c.rows?.[k] || []
  const claimed = Object.fromEntries(HEADS.map(h => [h, n(`claimed_${h}`) || 0]))
  const base = CALC[cat]({ c, v, n, flag, rows, claimed, cat })
  const { steps, cess, adm, lim = [] } = base
  const recovery = !!(c.notice?.drc01 || '').trim()

  // ── Head-wise: the ₹1,000 floor, provisional refund, adjustment against dues ──
  let heads = null
  if (adm) {
    heads = Object.fromEntries(HEADS.map(h => {
      const prov = PROV_CATS.includes(cat) ? n(`prov_${h}`) || 0 : 0
      const adj = num(c.order?.[`adj_${h}`]) || 0
      let a = adm[h] || 0
      const small = a > 0 && a < 1000
      if (small) a = 0
      const more = base.extra?.[h] ? { ...base.extra[h] } : {}
      if (small) Object.assign(more, { pdRef: 0, opRef: 0, cash: 0, credit: 0, interest: 0 })
      const payable = cat === 'T8' ? more.cash : a - prov          // T8: the credit part goes back by PMT-03
      return [h, {
        claimed: claimed[h], admissible: a, notPaid: small ? adm[h] : 0, rejected: Math.max(0, claimed[h] - a),
        prov, adj, net: Math.max(0, payable - adj), excess: Math.max(0, prov - a), ...more,
      }]
    }))
    for (const h of HEADS) {
      const x = heads[h]
      if (x.notPaid) flag(WARN, `Admissible ${h.toUpperCase()} is ₹${inr(x.notPaid)}, below ₹1,000: not paid and shown as rejected.`, 's.54(14); para 60 of Circular 125/44/2019-GST')
      if (x.excess && !recovery) flag(STOP, `Provisional refund under ${h.toUpperCase()} (₹${inr(x.prov)}) is more than the admissible ₹${inr(x.admissible)}. Propose recovery of the ₹${inr(x.excess)} excess in the RFD-08 notice with a DRC-01 summary, and enter the DRC-01 in the Notice step.`, 'para 3.4 of Instruction 06/2025-GST; rule 142(1)(a)')
      if (x.excess && recovery) flag(WARN, `Excess provisional refund of ₹${inr(x.excess)} under ${h.toUpperCase()} is confirmed for recovery in the order, with interest under s.50.`, 'para 3.4 of Instruction 06/2025-GST')
      const room = cat === 'T8' ? x.cash : x.admissible - x.prov
      if (x.adj > Math.max(0, room)) flag(STOP, `${h.toUpperCase()}: ₹${inr(x.adj)} is to be adjusted against dues, but only ₹${inr(Math.max(0, room))} is payable under that head.`, 's.54(10)(b)')
    }
    if (sum(HEADS.map(h => heads[h].adj)) && !(c.order?.adj_ref || '').trim()) flag(STOP, 'Enter the demand ID or order against which the amount is adjusted.', 's.54(10)(b); para 35 of Circular 125/44/2019-GST')
  }
  const KEYS = ['claimed', 'admissible', 'rejected', 'prov', 'adj', 'net', 'excess', 'notPaid', ...(cat === 'T8' ? ['cash', 'credit', 'interest', 'pdRef', 'opRef'] : [])]
  const total = heads && Object.fromEntries(KEYS.map(k => [k, sum(HEADS.map(h => heads[h][k]))]))

  // ── Time ──
  if (!v.filed) flag(STOP, 'Enter the date of filing to check limitation and the sixty days.')
  if (lim.some(m => m.covid)) flag(WARN, 'The period 01.03.2020 to 28.02.2022 has been left out of the two years.', 'Notification 13/2022-Central Tax')
  const filed = day(v.filed)
  const sixty = filed && iso(addDays(filed, 60))
  const today = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()))
  const daysLeft = filed ? daysBetween(today, addDays(filed, 60)) : null
  if (daysLeft !== null && daysLeft < 0) flag(WARN, `The sixty days ended on ${ddmmyyyy(sixty)}. Interest at 6% under s.56 is payable from the next day until the refund is credited.`, 's.54(7), s.56, rule 94')
  else if (daysLeft !== null && daysLeft <= 10) flag(WARN, `Only ${daysLeft} day${daysLeft === 1 ? '' : 's'} left of the sixty (ends ${ddmmyyyy(sixty)}).`, 's.54(7)')
  const instruction = !!(filed && filed >= day('2025-10-01') && PROV_CATS.includes(cat))
  if (instruction && !v.risk) flag(WARN, 'Filed on or after 01.10.2025: record the system risk category and the provisional refund (90%) or the reason it was not granted.', 'Instruction 06/2025-GST; rule 91(2)')

  // ── Rejection needs a notice ──
  const rejecting = !!(total && (total.rejected > 0 || (total.excess > 0)))
  const grounds = (c.grounds || []).filter(g => g.text?.trim())
  if (rejecting) {
    const what = total.rejected > 0 ? `₹${inr(total.rejected)} would be rejected` : `₹${inr(total.excess)} of provisional refund would be recovered`
    if (!c.notice?.no || !c.notice?.date) flag(STOP, `${what}. No application can be rejected without an RFD-08 notice and a hearing: enter the notice details and its grounds.`, 'rule 92(3)')
    if (!grounds.length) flag(STOP, 'Add each ground of the RFD-08 notice with the amount, so the order can decide every one.', 'rule 92(3)')
    const unanswered = grounds.filter(g => !g.finding?.trim() || !g.outcome)
    if (unanswered.length) flag(STOP, `Write your finding on ground${unanswered.length > 1 ? 's' : ''} ${unanswered.map(g => grounds.indexOf(g) + 1).join(', ')}.`, 'rule 92(3)')
    const proposed = sum(grounds.map(g => num(g.amount)))
    if (grounds.length && proposed + 1 < total.rejected) flag(STOP, `The order rejects ₹${inr(total.rejected)}, but the notice proposed only ₹${inr(proposed)}. A rejection must stand on a ground put to the applicant; issue a further RFD-08 first.`, 'rule 92(3)')
  }

  const notConfirmed = confirmsFor(cat).filter(x => !c.confirm?.[x.key])
  const RANK = { stop: 0, warn: 1, ok: 2 }
  flags.sort((a, b) => RANK[a.level] - RANK[b.level])
  return {
    cat, steps, cess, heads, total, limitation: lim, rows: base.rows || [], left: base.left || [],
    sixty, daysLeft, instruction, flags, notConfirmed, rejecting, recovery,
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
