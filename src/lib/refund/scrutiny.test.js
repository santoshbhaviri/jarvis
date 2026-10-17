// The Check step's scrutiny and reading an earlier notice. Run with: npm test.
// Made-up figures only: never put a real taxpayer's figures in this repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute } from './compute.js'
import { emptyCase } from './fields.js'
import { mergeRead } from './merge.js'
import { workingLines, points, buildScrutiny } from './scrutiny.js'
import { orderToBuffer } from './word.js'

// The T1 worked example (compute.test.js): ₹65,000 claimed, ₹58,882 admissible
function t1() {
  const c = emptyCase('T1')
  Object.assign(c.v, {
    arn: 'AA3609260000001', filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', output_rate: 12, input_rate: 18,
    A: 3000000, B: 3000000, C: 385000, D: 425000, E: 360000,
    itc_4a: 525000, itc_services: 40000, itc_capital: 100000, itc_blocked: 0,
    claimed_igst: 15000, claimed_cgst: 25000, claimed_sgst: 25000,
    end_igst: 20000, end_cgst: 25000, end_sgst: 25000,
    at_filing_igst: 15000, at_filing_cgst: 25000, at_filing_sgst: 25000, risk: 'not low-risk',
  })
  c.src = { A: 'RFD-01 Statement 1 p.1', claimed_igst: 'RFD-01 p.1' }
  return c
}

test('scrutiny: working, points and the sheet for the T1 example', async () => {
  const c = t1()
  c.alt = { A: [{ value: 3100000, src: 'GSTR-3B July 2026 p.1' }] }
  c.edited = { claimed_igst: { value: 16000, src: 'RFD-01 p.1' } }
  const r = compute(c)
  const lines = workingLines(c, r)
  assert.ok(lines.some(([l]) => /Maximum refund/.test(l)))
  const pts = points(c, r)
  assert.ok(pts.some(p => /GSTR-3B July 2026 p\.1/.test(p.text)), 'a figure that differs between documents is listed')
  assert.ok(pts.some(p => p.law === 'your correction'))
  assert.ok(!pts.some(p => p.law === 'rule 92(3)'), 'the notice and hearing are left to the draft')
  const blocks = buildScrutiny(c, r)
  const text = JSON.stringify(blocks)
  assert.match(text, /SCRUTINY SHEET/)
  assert.match(text, /58,882/)
  assert.doesNotMatch(text, /undefined|NaN/)
  const buf = await orderToBuffer(blocks, undefined, { title: 'Scrutiny sheet' })
  assert.ok(buf.length > 1000)
})

test('scrutiny: an empty case does not break', () => {
  const c = emptyCase('T2')
  const r = compute(c)
  assert.deepEqual(workingLines(c, r), [])
  assert.doesNotMatch(JSON.stringify(buildScrutiny(c, r)), /undefined|NaN/)
})

test('an earlier notice fills the grounds and the notice number', () => {
  const c = emptyCase('T1')
  const read = { kind: 'RFD-08 notice', fields: [{ key: 'claimed_igst', value: '15000', page: 1, quote: '' }],
    grounds: [{ title: 'Excess claim', text: 'The refund admissible under rule 89(5) is less than claimed.', amount: '6,118' }, { title: '', text: ' ', amount: null }],
    notice: { no: 'RFD08/2026/1', date: '20/09/2026' } }
  const { c: next } = mergeRead(c, read, 'notice.pdf')
  assert.equal(next.grounds.length, 1)
  assert.equal(next.grounds[0].amount, 6118)
  assert.equal(next.grounds[0].from, 'RFD-08 notice')
  assert.equal(next.notice.no, 'RFD08/2026/1')
  assert.equal(next.notice.date, '2026-09-20')
  assert.equal(next.v.claimed_igst, 15000)
  // grounds you already have are never replaced
  const again = mergeRead(next, { ...read, grounds: [{ title: 'Other', text: 'Other ground', amount: '1' }] }, 'x').c
  assert.equal(again.grounds[0].title, 'Excess claim')
})
