// The RFD-08 notice (template N1) for the worked examples. Run with: npm test.
// Made-up figures only: never put a real taxpayer's figures in this repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute } from './compute.js'
import { emptyCase, CONFIRMS, confirmsFor } from './fields.js'
import { buildNotice, noticeReady, replyDue, OFFICE } from './notice.js'
import { blanks } from './order.js'

const notice = (extra = {}) => ({ no: 'RFD08/2026/1', date: '2026-09-20', rfn: 'RFN-EXAMPLE-1', hearing: '2026-10-08', time: '11:00 AM', relied: 'Statement 1 of RFD-01; GSTR-3B for the period', ...extra })

// The T1 worked example (compute.test.js): ₹65,000 claimed, ₹58,882 admissible, ₹6,118 out
function t1() {
  const c = emptyCase('T1')
  Object.assign(c.v, {
    legal_name: 'Example Private Limited', gstin: '36AAAAA0000A1Z5', address: 'Plot 1, Example Nagar',
    arn: 'AA3609260000001', filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', output_rate: 12, input_rate: 18,
    A: 3000000, B: 3000000, C: 385000, D: 425000, E: 360000,
    itc_4a: 525000, itc_services: 40000, itc_capital: 100000, itc_blocked: 0,
    claimed_igst: 15000, claimed_cgst: 25000, claimed_sgst: 25000,
    end_igst: 20000, end_cgst: 25000, end_sgst: 25000,
    at_filing_igst: 15000, at_filing_cgst: 25000, at_filing_sgst: 25000, risk: 'not low-risk',
  })
  c.confirm = Object.fromEntries(CONFIRMS.map(x => [x.key, true]))
  c.notice = { ...c.notice, ...notice() }
  c.grounds = [{ title: 'Refund claimed exceeds the rule 89(5) formula', text: 'The refund worked out under rule 89(5) on the figures in Statement 1 is ₹58,882, against ₹65,000 claimed.', amount: 6118 }]
  return c
}

function make(cat, v, rows = {}) {
  const c = emptyCase(cat)
  Object.assign(c.v, { legal_name: 'Example Exports LLP', filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', risk: 'not low-risk', ...v })
  c.rows = rows
  c.confirm = Object.fromEntries(confirmsFor(cat).map(x => [x.key, true]))
  return c
}

// T4 (categories.test.js): unendorsed invoice out, ₹1,000 of provisional refund paid in excess
function t4() {
  const c = make('T4', {
    goods_or_services: 'goods', zr_goods: 900000, ato: 1500000, net_itc: 150000, risk: 'low-risk',
    claimed_igst: 90000, end_igst: 100000, at_filing_igst: 100000, prov_igst: 81000, rfd04_no: 'P/1', rfd04_date: '2026-09-15', rfd05_date: '2026-09-16',
  }, { sez: [
    { inv: 'Z/1', inv_date: '2026-07-04', value: 800000, endorsement: 'END/1', authorised: 'yes' },
    { inv: 'Z/2', inv_date: '2026-07-14', value: 100000, endorsement: '', authorised: 'yes' },
  ] })
  c.notice = { ...c.notice, ...notice({ drc01: 'DRC-01 ref', recovery_sec: '74A' }) }
  c.grounds = [{ title: 'Invoice without the endorsement of the specified officer', text: 'Invoice Z/2 (value ₹1,00,000) does not bear the endorsement of the specified officer of the Zone (proviso to rule 89(1); rule 89(2)(d)).', amount: 10000, affected: 100000 }]
  return c
}

// T7 (categories.test.js): a disputed TDS credit of ₹10,000 out
function t7() {
  const c = make('T7', {
    claimed_igst: 25000, claimed_cgst: 40000, claimed_sgst: 40000, cash_igst: 25000, cash_cgst: 40000, cash_sgst: 40000, balance_on: '2026-09-01',
  }, { cashrows: [
    { entry: 'CPIN 1', head: 'igst', minor: 'tax', credited: 15000, used: 0, claimed: 15000, refundable: 'yes' },
    { entry: 'TDS credit', head: 'igst', minor: 'tax', credited: 10000, used: 0, claimed: 10000, refundable: 'no' },
    { entry: 'CPIN 2', head: 'cgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
    { entry: 'CPIN 2', head: 'sgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
  ] })
  c.notice = { ...c.notice, ...notice() }
  c.grounds = [{ title: 'TDS credit not shown as accepted', text: 'The TDS credit of ₹10,000 in the cash ledger has not been accepted by the applicant in GSTR-2X.', amount: 10000 }]
  return c
}

const build = (c) => { const r = compute(c); return { r, blocks: buildNotice(c, r), text: JSON.stringify(buildNotice(c, r)) } }

for (const [cat, make_, amount, ground] of [['T1', t1, '6,118', 'rule 89(5) formula'], ['T4', t4, '10,000', 'endorsement of the specified officer'], ['T7', t7, '10,000', 'GSTR-2X']]) {
  test(`${cat}: the RFD-08 notice is built from N1`, () => {
    const { text, blocks } = build(make_())
    assert.doesNotMatch(text, /undefined|NaN|null/)
    assert.match(text, /FORM GST RFD-08 \[See rule 92\(3\)\]/)
    assert.match(text, new RegExp(ground.replace(/[()]/g, '\\$&')))
    assert.match(text, new RegExp(`₹${amount}`))
    assert.match(text, /Ground 1: /)
    assert.match(text, /by 05\.10\.2026/)                 // fifteen days after 20.09.2026
    assert.match(text, /rejected under rule 92\(3\) of the CGST Rules/)
    assert.doesNotMatch(text, /Drafting note|Worked example/)
    assert.equal(blocks.filter(b => b.t === 'sign').length, 1)
    assert.match(text, /Statement 1 of RFD-01/)
  })
}

test('reply due fifteen days after the notice date', () => {
  assert.equal(replyDue('2026-09-20'), '2026-10-05')
  assert.equal(replyDue('2026-12-25'), '2027-01-09')
  assert.equal(replyDue(''), '')
})

test('T1: head-wise effect of the single ground and the recomputation', () => {
  const { text } = build(t1())
  assert.match(text, /CGST ₹3,059, SGST ₹3,059/)
  assert.match(text, /Refund by formula/)
  assert.match(text, /58,882/)
  assert.match(text, /₹58,882, is not proposed|₹58,882, is not/)
})

test('Variant C and the DRC-01 only where provisional refund was paid in excess (T4)', () => {
  const t4n = build(t4()).text, t1n = build(t1()).text, t7n = build(t7()).text
  assert.match(t4n, /4\.1A You are also required to show cause why refund of \*\*₹1,000\*\*/)
  assert.match(t4n, /section 54 read with section 74A\(1\), with interest under section 50/)
  assert.match(t4n, /rule 142\(1\)\(a\)/)
  assert.match(t4n, /Adjudication cell/)
  assert.match(t4n, /Turnover of zero-rated supply/)
  for (const t of [t1n, t7n]) {
    assert.doesNotMatch(t, /4\.1A|DRC-01|Adjudication cell/)
  }
  assert.doesNotMatch(t4n + t1n + t7n, /74\(1\) \/ 74A\(1\)\]|ineligible under Ground/)   // no Variant B
})

test('T7: the credit affected is listed in the annexure', () => {
  const { text } = build(t7())
  assert.match(text, /TDS credit/)
  assert.match(text, /balance as on 01\.09\.2026/)
  assert.match(text, /Excess balance in the electronic cash ledger/)
})

test('noticeReady lists what is missing', () => {
  const c = emptyCase('T1')
  assert.deepEqual(noticeReady(c, compute(c)), ['Notice No.', 'Notice date', 'At least one ground with its text and amount', 'Hearing date'])
  const ok = t1()
  assert.deepEqual(noticeReady(ok, compute(ok)), [])
  ok.notice.hearing = '2026-10-01'
  assert.ok(noticeReady(ok, compute(ok)).some(x => /sixteenth day/.test(x)))
  const t = t4(); t.notice.drc01 = ''
  assert.ok(noticeReady(t, compute(t)).some(x => /DRC-01/.test(x)))
})

test('an empty case still drafts, with blanks and no undefined', () => {
  const c = emptyCase('T8')
  c.grounds = [{ text: 'Something', amount: 500 }]
  const text = JSON.stringify(buildNotice(c, compute(c)))
  assert.doesNotMatch(text, /undefined|NaN|null/)
  assert.ok(blanks(buildNotice(c, compute(c))).includes('Notice No.'))
})

test('the notice makes a Word file titled Notice (RFD-08)', async () => {
  const { orderToBuffer } = await import('./word.js')
  const c = t4()
  const buf = await orderToBuffer(buildNotice(c, compute(c)), OFFICE, { title: 'Notice (RFD-08)' })
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
  const old = await orderToBuffer(buildNotice(c, compute(c)))   // backward compatible
  assert.equal(old.subarray(0, 2).toString(), 'PK')
})
