// The orders for templates T7 and T8, built from the worked examples in their annexures (made-up
// figures only). Run with: npm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute, words } from './compute.js'
import { emptyCase, confirmsFor } from './fields.js'
import { buildT7 } from './order-t7.js'
import { buildT8 } from './order-t8.js'
import { orderToBuffer } from './word.js'

function make(cat, v, rows = {}) {
  const c = emptyCase(cat)
  Object.assign(c.v, { legal_name: 'Example Traders', gstin: '36AAAAA0000A1Z5', arn: 'AA360926000001X', filed: '2026-09-10', ack: '2026-09-12', ...v })
  c.rows = rows
  c.confirm = Object.fromEntries(confirmsFor(cat).map(x => [x.key, true]))
  return c
}
const text = (blocks) => JSON.stringify(blocks)
const clean = (blocks) => {
  const s = text(blocks)
  for (const bad of ['undefined', 'NaN', 'null']) assert.ok(!s.includes(bad), `"${bad}" in the order`)
}
const paras = (blocks) => blocks.filter(b => b.t === 'p').map(b => b.text)

test('T7 order: cash ledger, disputed TDS credit rejected and re-credited by PMT-03, CGST adjusted', async () => {
  const c = make('T7', {
    balance_on: '2026-09-10', cash_reason: 'tax deposited by challan was later paid through the credit ledger',
    claimed_igst: 25000, claimed_cgst: 40000, claimed_sgst: 40000, cash_igst: 25000, cash_cgst: 40000, cash_sgst: 40000,
  }, { cashrows: [
    { entry: 'CPIN 1', head: 'igst', minor: 'tax', credited: 15000, used: 0, claimed: 15000, refundable: 'yes' },
    { entry: 'TDS credit', head: 'igst', minor: 'tax', credited: 10000, used: 0, claimed: 10000, refundable: 'no' },
    { entry: 'CPIN 2', head: 'cgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
    { entry: 'CPIN 2', head: 'sgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
  ] })
  c.order.adj_cgst = 8000; c.order.adj_ref = 'demand ID'
  c.notice = { ...c.notice, no: 'RFD08/1', date: '2026-09-20', reply: '2026-10-01', hearing: '2026-10-05', attended: 'authorised representative' }
  c.grounds = [{ title: 'TDS credit disputed', text: 'The deductor disputes the TDS credit of ₹10,000.', amount: 10000, reply: 'Reply', verified: 'Checked', finding: 'Not accepted', outcome: 'rejected' }]
  const r = compute(c)
  assert.equal(r.total.admissible, 95000)
  const blocks = buildT7(c, r)
  clean(blocks)
  const s = text(blocks)
  assert.ok(s.includes(words(95000)), 'admissible amount in words')
  assert.ok(s.includes('95,000') && s.includes('87,000'))
  assert.ok(paras(blocks).some(t => t.includes('PMT-03') && t.includes('re-credited to the electronic cash ledger') && t.includes('10,000')), 'PMT-03 re-credit of 10,000 to the cash ledger')
  assert.ok(!s.includes('5.2'), 'no provisional refund para')
  const buf = await orderToBuffer(blocks)
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
})

test('T8 order: pre-deposit refunded in cash with section 115 interest, head by head', async () => {
  const c = make('T8', {
    oio: 'OIO/01/2025 dated 10.12.2025', oio_by: 'the Additional Commissioner', oio_tax: 1000000, oio_ground: 'credit availed on ineligible invoices',
    apl_arn: 'AD360126000001Y dated 15.01.2026', ao: 'OIA/05/2026 dated 05.06.2026', ao_by: 'Commissioner (Appeals)',
    ao_comm: '2026-06-12', filed: '2026-07-01', ack: '2026-07-03', ao_result: 'set aside in full', dept: 'accepted on review',
    pd_date: '2026-01-15', pd_mode: 'cash ledger', pd_cgst: 50000, pd_sgst: 50000,
    claimed_cgst: 50000, claimed_sgst: 50000, credit_date: '2026-08-20', int_rate: 6, ue_doc: 'declaration (up to ₹2 lakh)',
  })
  const r = compute(c)
  assert.equal(r.total.interest, 3568)
  const blocks = buildT8(c, r)
  clean(blocks)
  const s = text(blocks)
  assert.ok(s.includes(words(100000)), 'admissible amount in words')
  assert.ok(s.includes('1,00,000') && s.includes('1,784') && s.includes('3,568') && s.includes('217'))
  assert.ok(s.includes('Legal / Review'), 'extra copy')
  assert.ok(!s.includes('subject to the outcome of any appeal'), 'accepted on review: no subject-to-appeal para')
  const buf = await orderToBuffer(blocks)
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
})

test('T8 order: department has appealed, partial relief from other amounts', () => {
  const c = make('T8', {
    ao_comm: '2026-06-12', filed: '2026-07-01', ao_result: 'allowed in part', dept: 'department has appealed',
    pd_date: '2026-01-15', pd_mode: 'cash ledger', pd_cgst: 50000, pd_sgst: 50000,
    op_date: '2026-02-01', op_mode: 'credit ledger', op_cgst: 100000, op_sgst: 100000,
    nr_cgst: 105000, nr_sgst: 105000, nr_from: 'pre-deposit',
    claimed_cgst: 45000, claimed_sgst: 45000, credit_date: '2026-08-20', ue_doc: 'declaration (up to ₹2 lakh)',
  })
  const r = compute(c)
  const blocks = buildT8(c, r)
  clean(blocks)
  const s = text(blocks)
  assert.ok(s.includes('90,000'))
  assert.ok(s.includes('subject to the outcome of any appeal by the department'))
  assert.ok(s.includes('PMT-03 (rule 92(1A))'), 'credit part re-credited')
  assert.ok(s.includes('No part of the pre-deposit is refunded'))
})
