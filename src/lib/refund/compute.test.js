// Run with: npm test. Made-up figures only: never put a real taxpayer's figures in this repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute, limitation, dueDate, inr, words } from './compute.js'
import { emptyCase, CONFIRMS } from './fields.js'

// The worked example in the annexure of template T1
function example(extra = {}) {
  const c = emptyCase()
  Object.assign(c.v, {
    filed: '2026-09-10', from: '2026-07', to: '2026-07', output_rate: 12, input_rate: 18,
    A: 3000000, B: 3000000, C: 385000, D: 425000, E: 360000,
    itc_4a: 525000, itc_services: 40000, itc_capital: 100000, itc_blocked: 0,
    claimed_igst: 15000, claimed_cgst: 25000, claimed_sgst: 25000,
    end_igst: 20000, end_cgst: 25000, end_sgst: 25000,
    at_filing_igst: 15000, at_filing_cgst: 25000, at_filing_sgst: 25000,
    risk: 'not low-risk', ...extra,
  })
  c.confirm = Object.fromEntries(CONFIRMS.map(x => [x.key, true]))
  return c
}

test('rule 89(5) on the T1 worked example', () => {
  const r = compute(example())
  assert.equal(r.steps.i, 385000)
  assert.equal(r.steps.iii.toFixed(2), '326117.65')   // the ratio is not rounded
  assert.equal(r.steps.maxRefund, 58882)
  assert.equal(r.steps.admissible, 58882)
  assert.equal(r.steps.rejected, 6118)
  assert.deepEqual([r.heads.igst.admissible, r.heads.cgst.admissible, r.heads.sgst.admissible], [15000, 21941, 21941])
  assert.deepEqual([r.heads.cgst.rejected, r.heads.sgst.rejected], [3059, 3059])
})

test('a rejection is blocked until the RFD-08 notice and findings are in', () => {
  const c = example()
  let r = compute(c)
  assert.equal(r.ready, false)
  assert.ok(r.flags.some(f => f.law === 'rule 92(3)'))
  c.notice = { no: 'X/1', date: '2026-09-20', reply: '2026-10-01', hearing: '2026-10-05', attended: 'authorised representative' }
  c.grounds = [{ text: 'Refund exceeds the formula', amount: 6118, reply: 'Agreed', verified: 'Statement 1', finding: 'Not accepted', outcome: 'rejected' }]
  r = compute(c)
  assert.equal(r.ready, true, r.flags.filter(f => f.level === 'stop').map(f => f.text).join('; '))
})

test('a rejection larger than the notice proposed is refused', () => {
  const c = example()
  c.notice = { no: 'X/1', date: '2026-09-20' }
  c.grounds = [{ text: 'g', amount: 1000, finding: 'f', outcome: 'rejected' }]
  assert.ok(compute(c).flags.some(f => /proposed only/.test(f.text)))
})

test('full sanction needs no notice', () => {
  const c = example({ claimed_igst: 15000, claimed_cgst: 21941, claimed_sgst: 21941 })
  const r = compute(c)
  assert.equal(r.total.rejected, 0)
  assert.equal(r.ready, true, r.flags.filter(f => f.level === 'stop').map(f => f.text).join('; '))
})

test('ledger balance caps the refund', () => {
  const r = compute(example({ at_filing_igst: 0, at_filing_cgst: 20000, at_filing_sgst: 20000 }))
  assert.equal(r.steps.admissible, 40000)
  assert.deepEqual([r.heads.igst.admissible, r.heads.cgst.admissible, r.heads.sgst.admissible], [0, 20000, 20000])
})

test('no inversion when output rate is not lower', () => {
  assert.ok(compute(example({ output_rate: 18 })).flags.some(f => /no inversion/.test(f.text)))
})

test('net ITC reconciliation is flagged', () => {
  assert.ok(compute(example({ itc_capital: 90000 })).flags.some(f => /does not reconcile/.test(f.text)))
})

test('limitation: two years from the GSTR-3B due date', () => {
  assert.equal(dueDate('2024-03').toISOString().slice(0, 10), '2024-04-20')
  assert.equal(dueDate('2024-02', 'quarterly').toISOString().slice(0, 10), '2024-04-22')
  const [m] = limitation({ from: '2024-03', to: '2024-03', filed: '2026-04-20' })
  assert.equal(m.ends, '2026-04-20')
  assert.equal(m.inTime, true)
  const [late] = limitation({ from: '2024-03', to: '2024-03', filed: '2026-04-21' })
  assert.equal(late.inTime, false)
})

test('time-barred months stop the draft', () => {
  const r = compute(example({ from: '2024-01', to: '2024-03', filed: '2026-03-01' }))
  assert.ok(r.flags.some(f => f.level === 'stop' && /beyond two years/.test(f.text)))
})

test('head below ₹1,000 is not paid', () => {
  const r = compute(example({ claimed_igst: 500, end_igst: 500, at_filing_igst: 500, claimed_cgst: 21941, claimed_sgst: 21941 }))
  assert.equal(r.heads.igst.admissible, 0)
  assert.equal(r.heads.igst.notPaid, 500)
})

test('cess uses its own formula', () => {
  const r = compute(example({ claimed_cess: 5000, end_cess: 9000, at_filing_cess: 9000, cess_C: 10000, cess_D: 12000, cess_E: 6000 }))
  // 30,00,000 × 10,000 ÷ 30,00,000 − 6,000 × 10,000 ÷ 12,000 = 10,000 − 5,000
  assert.equal(r.cess.admissible, 5000)
  assert.equal(r.heads.cess.admissible, 5000)
})

test('Indian number format and words', () => {
  assert.equal(inr(5888200), '58,88,200')
  assert.equal(inr(326117.647, 2), '3,26,117.65')
  assert.equal(words(58882), 'Fifty Eight Thousand Eight Hundred and Eighty Two')
  assert.equal(words(123456789), 'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred and Eighty Nine')
})

test('the order is built, names every blank, and makes a Word file', async () => {
  const { buildOrder, blanks } = await import('./order.js')
  const { orderToBuffer } = await import('./word.js')
  const c = example({ claimed_igst: 15000, claimed_cgst: 21941, claimed_sgst: 21941, legal_name: 'Example Private Limited' })
  const blocks = buildOrder(c, compute(c))
  const text = JSON.stringify(blocks)
  assert.match(text, /Rupees Fifty Eight Thousand Eight Hundred and Eighty Two only/)
  assert.match(text, /no notice in FORM GST RFD-08 was required/)
  assert.doesNotMatch(text, /PMT-03/)   // nothing rejected, so no re-credit para
  assert.ok(blanks(blocks).includes('Order No.'))
  const buf = await orderToBuffer(blocks)
  assert.equal(buf.subarray(0, 2).toString(), 'PK')   // a .docx is a zip
})

test('a document read fills empty fields and keeps a different figure aside', async () => {
  const { mergeRead, parseMonth, parseDate } = await import('./merge.js')
  assert.equal(parseDate('10/09/2026'), '2026-09-10')
  assert.equal(parseMonth('July 2026'), '2026-07')
  assert.equal(parseMonth('072026'), '2026-07')
  let c = emptyCase()
  c = mergeRead(c, { kind: 'Statement 1', fields: [{ key: 'B', value: '3000000', page: 2 }] }, 'a.pdf').c
  c = mergeRead(c, { kind: 'GSTR-3B', fields: [{ key: 'B', value: '3,10,000.00', page: 1 }] }, 'b.pdf').c
  assert.equal(c.v.B, 3000000)
  assert.equal(c.src.B, 'Statement 1 p.2')
  assert.deepEqual(c.alt.B, [{ value: 310000, src: 'GSTR-3B p.1' }])
})
