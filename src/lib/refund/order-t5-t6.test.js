// The orders for templates T5 and T6, built from the made-up worked examples in their annexures.
// Run with: npm test. Never put a real taxpayer's figures in this repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute, words } from './compute.js'
import { emptyCase, confirmsFor } from './fields.js'
import { buildT5 } from './order-t5.js'
import { buildT6 } from './order-t6.js'
import { orderToBuffer } from './word.js'

function make(cat, v, rows = {}) {
  const c = emptyCase(cat)
  Object.assign(c.v, { legal_name: 'Example Services Pvt. Ltd.', filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', risk: 'not low-risk', ...v })
  c.rows = rows
  c.confirm = Object.fromEntries(confirmsFor(cat).map(x => [x.key, true]))
  return c
}
const answer = (c, amount) => {
  c.notice = { no: 'RFD08/1', date: '2026-09-20', reply: '2026-10-01', hearing: '2026-10-05', attended: 'authorised representative', drc01: c.notice.drc01, recovery_sec: '74A' }
  c.grounds = [{ title: 'Ground', text: 'Ground stated', amount, reply: 'Reply', verified: 'Checked', finding: 'Not accepted', outcome: 'rejected' }]
  return c
}
const text = (blocks) => JSON.stringify(blocks)
const common = async (blocks, admissible) => {
  const s = text(blocks)
  for (const bad of ['undefined', 'NaN', 'null']) assert.ok(!s.includes(bad), `"${bad}" in the order`)
  assert.ok(s.includes(words(admissible)), 'admissible amount in words')
  assert.ok(!s.includes('PMT-03'), 'no PMT-03 re-credit in this category')
  const buf = await orderToBuffer(blocks)
  assert.equal(Buffer.from(buf).subarray(0, 2).toString(), 'PK')
}

test('T5 order: late invoice out, excess provisional refund recovered', async () => {
  const c = make('T5', {
    supply_desc: 'software development services', supply_hsn: '998314', recipients: 'one recipient in Singapore', agreement: 'agreement dated 01.04.2024',
    claimed_igst: 180000, prov_igst: 162000, risk: 'low-risk', rfd04_no: 'P/1', rfd04_date: '2026-09-15', rfd05_date: '2026-09-16', tax_gstr1: 180000, tax_3b: 180000,
  }, { taxinv: [
    { inv: 'A', inv_date: '2026-06-01', value: 500000, igst: 90000, in_gstr1: 'yes', firc: 'F1', firc_date: '2026-07-01', advance: 'after supply', export: 'yes' },
    { inv: 'B', inv_date: '2026-06-10', value: 300000, igst: 54000, in_gstr1: 'yes', firc: 'F2', firc_date: '2026-07-10', advance: 'after supply', export: 'yes' },
    { inv: 'C', inv_date: '2024-06-01', value: 200000, igst: 36000, in_gstr1: 'yes', firc: 'F3', firc_date: '2024-07-01', advance: 'after supply', export: 'yes' },
  ] })
  c.notice.drc01 = 'DRC-01/1'
  answer(c, 36000)
  const r = compute(c)
  assert.equal(r.total.admissible, 144000)
  assert.equal(r.total.excess, 18000)
  const blocks = buildT5(c, r)
  const s = text(blocks)
  await common(blocks, 144000)
  assert.ok(s.includes('1,44,000'))
  assert.ok(/confirm ₹18,000 .*as refund erroneously paid/.test(s), 'excess recovery para')
  assert.ok(s.includes('S. No. 3') && s.includes('beyond two years'), 'late invoice named with its reason')
  assert.ok(s.includes('section 54(8)(a)'))
})

test('T5 order: a supply that is not an export gets para 8.4', async () => {
  const c = make('T5', { claimed_igst: 144000, tax_gstr1: 144000, tax_3b: 144000 }, { taxinv: [
    { inv: 'A', inv_date: '2026-06-01', value: 500000, igst: 90000, in_gstr1: 'yes', firc_date: '2026-07-01', export: 'yes' },
    { inv: 'B', inv_date: '2026-06-10', value: 300000, igst: 54000, in_gstr1: 'yes', firc_date: '2026-07-10', export: 'no' },
  ] })
  answer(c, 54000)
  const r = compute(c)
  const blocks = buildT5(c, r)
  await common(blocks, 90000)
  assert.ok(text(blocks).includes('8.4 As the supplies at S. No. 2 are held not to be exports of services'))
})

test('T6 order: tax collected and unauthorised invoices out, adjustment, CA certificate', async () => {
  const row = (inv, igst, extra = {}) => ({ inv, inv_date: '2026-07-05', unit: 'SEZ unit 1', desc: 'machined parts', value: igst * 5, igst, endorsement: 'E', authorised: 'yes', collected: 'no', in_gstr1: 'yes', ...extra })
  const c = make('T6', { claimed_igst: 234000, tax_gstr1: 234000, tax_3b: 234000, goods_or_services: 'goods', sez_name: 'an example SEZ', ue_doc: 'CA / CMA certificate (above ₹2 lakh)' }, { seztax: [
    row('A', 108000), row('B', 72000), row('C', 18000, { collected: 'yes' }), row('D', 36000, { authorised: 'no' }),
  ] })
  c.order.adj_igst = 50000; c.order.adj_ref = 'demand ID'
  answer(c, 54000)
  const r = compute(c)
  assert.equal(r.total.net, 130000)
  const blocks = buildT6(c, r)
  const s = text(blocks)
  await common(blocks, 180000)
  for (const fig of ['1,80,000', '50,000', '1,30,000']) assert.ok(s.includes(fig), fig)
  assert.ok(s.includes('certificate of a Chartered Accountant / Cost Accountant under rule 89(2)(m)'))
  assert.ok(s.includes('8.4 The supplies at S. No. 4 of Table 1 are not for the authorised operations'))
  assert.ok(s.includes('Explanation (ii) to rule 89'))
  assert.ok(s.includes('section 54(8)(e)'))
})

test('T6 order: cess claimed, declaration chosen, no blanks for unjust enrichment', async () => {
  const c = make('T6', { claimed_igst: 90000, claimed_cess: 10000, ue_doc: 'declaration (up to ₹2 lakh)', goods_or_services: 'services' }, { seztax: [
    { inv: 'S1', inv_date: '2026-07-05', igst: 90000, cess: 10000, endorsement: 'E', authorised: 'yes', collected: 'no', in_gstr1: 'yes' },
  ] })
  const r = compute(c)
  const blocks = buildT6(c, r)
  const s = text(blocks)
  await common(blocks, 100000)
  assert.ok(s.includes('the declaration under rule 89(2)(l) (claim up to two lakh rupees)'))
  assert.ok(s.includes('Cess ₹10,000'))
})
