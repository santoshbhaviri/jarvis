// The worked examples in the annexures of templates T2 to T8, with their made-up figures.
// Run with: npm test. Never put a real taxpayer's figures in this repository.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute } from './compute.js'
import { emptyCase, confirmsFor } from './fields.js'

function make(cat, v, rows = {}) {
  const c = emptyCase(cat)
  Object.assign(c.v, { filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', risk: 'not low-risk', ...v })
  c.rows = rows
  c.confirm = Object.fromEntries(confirmsFor(cat).map(x => [x.key, true]))
  return c
}
const stops = (r) => r.flags.filter(f => f.level === 'stop').map(f => f.text)
const answer = (c, amount) => {
  c.notice = { no: 'RFD08/1', date: '2026-09-20', reply: '2026-10-01', hearing: '2026-10-05', attended: 'authorised representative', drc01: c.notice.drc01 }
  c.grounds = [{ title: 'Ground', text: 'Ground stated', amount, reply: 'Reply', verified: 'Checked', finding: 'Not accepted', outcome: 'rejected' }]
  return c
}

test('T2: exports of goods, lower of FOB and invoice, a time-barred bill stays in the turnover', () => {
  const c = make('T2', {
    zr_goods: 1680000, ato: 2180000, net_itc: 250000, itc_4a: 300000, itc_capital: 40000, itc_blocked: 10000,
    claimed_igst: 180000, end_igst: 200000, at_filing_igst: 190000, drawback: 'none', export_duty: 'no',
  }, { exports: [
    { inv: 'E/1', inv_value: 1000000, sb: 'SB 1', egm: '2026-07-10', fob: 980000 },
    { inv: 'E/2', inv_value: 500000, sb: 'SB 2', egm: '2026-07-20', fob: 510000 },
    { inv: 'E/3', inv_value: 200000, sb: 'SB 3', egm: '2024-08-01', fob: 200000 },
  ] })
  const r = compute(c)
  assert.equal(r.steps.numerator, 1480000)
  assert.equal(r.steps.excluded, 200000)
  assert.equal(r.steps.maxRefund, 169725)
  assert.equal(r.total.admissible, 169725)
  assert.equal(r.total.rejected, 10275)
  assert.ok(r.flags.some(f => /SB 3/.test(f.text) && /stays in the Adjusted Total Turnover/.test(f.text)))
  assert.equal(r.ready, false)
  assert.equal(compute(answer(c, 10275)).ready, true, stops(compute(c)).join('; '))
})

test('T2: drawback of central tax stops the claim', () => {
  const r = compute(make('T2', { zr_goods: 100, ato: 100, net_itc: 10, drawback: 'including central tax' }, { exports: [{ inv_value: 100, fob: 100, egm: '2026-07-10' }] }))
  assert.ok(stops(r).some(t => /Drawback/.test(t)))
})

test('T3: exports of services, rule 89(4)(D) turnover', () => {
  const c = make('T3', {
    zr_services: 1200000, d_a: 1200000, d_b: 300000, d_c: 200000, ato: 2000000, net_itc: 240000,
    claimed_igst: 160000, end_igst: 200000, at_filing_igst: 200000,
  }, { remits: [{ inv: 'S/1', inv_date: '2026-07-05', inv_value: 1000000, firc: 'F1', firc_date: '2026-07-25', realised: 1000000, advance: 'after supply' }] })
  const r = compute(c)
  assert.equal(r.steps.numerator, 1300000)
  assert.equal(r.total.admissible, 156000)
  assert.equal(r.total.rejected, 4000)
})

test('T4: SEZ supplies, unendorsed invoice out, excess provisional refund recovered', () => {
  const c = make('T4', {
    goods_or_services: 'goods', zr_goods: 900000, ato: 1500000, net_itc: 150000, risk: 'low-risk',
    claimed_igst: 90000, end_igst: 100000, at_filing_igst: 100000, prov_igst: 81000, rfd04_no: 'P/1', rfd04_date: '2026-09-15', rfd05_date: '2026-09-16',
  }, { sez: [
    { inv: 'Z/1', inv_date: '2026-07-04', value: 800000, endorsement: 'END/1', authorised: 'yes' },
    { inv: 'Z/2', inv_date: '2026-07-14', value: 100000, endorsement: '', authorised: 'yes' },
  ] })
  let r = compute(c)
  assert.equal(r.steps.numerator, 800000)
  assert.equal(r.steps.asClaimed, 90000)
  assert.equal(r.total.admissible, 80000)
  assert.equal(r.total.rejected, 10000)
  assert.equal(r.total.excess, 1000)
  assert.equal(r.total.net, 0)
  assert.ok(stops(r).some(t => /DRC-01/.test(t)))
  c.notice.drc01 = 'DRC-01 ref'
  r = compute(answer(c, 10000))
  assert.equal(r.ready, true, stops(r).join('; '))
})

test('T5: services exported with IGST, a late remittance out, excess provisional refund', () => {
  const c = make('T5', { claimed_igst: 180000, prov_igst: 162000, risk: 'low-risk', tax_gstr1: 180000, tax_3b: 180000 }, { taxinv: [
    { inv: 'A', inv_date: '2026-06-01', value: 500000, igst: 90000, in_gstr1: 'yes', firc_date: '2026-07-01', advance: 'after supply', export: 'yes' },
    { inv: 'B', inv_date: '2026-06-10', value: 300000, igst: 54000, in_gstr1: 'yes', firc_date: '2026-07-10', advance: 'after supply', export: 'yes' },
    { inv: 'C', inv_date: '2024-06-01', value: 200000, igst: 36000, in_gstr1: 'yes', firc_date: '2024-07-01', advance: 'after supply', export: 'yes' },
  ] })
  const r = compute(c)
  assert.equal(r.total.admissible, 144000)
  assert.equal(r.total.rejected, 36000)
  assert.equal(r.total.excess, 18000)
  assert.equal(r.total.net, 0)
})

test('T6: SEZ supplies with IGST, tax collected and unauthorised invoices out, adjustment', () => {
  const row = (inv, igst, extra = {}) => ({ inv, inv_date: '2026-07-05', igst, endorsement: 'E', authorised: 'yes', collected: 'no', in_gstr1: 'yes', ...extra })
  const c = make('T6', { claimed_igst: 234000, ue_doc: 'CA / CMA certificate (above ₹2 lakh)' }, { seztax: [
    row('A', 108000), row('B', 72000), row('C', 18000, { collected: 'yes' }), row('D', 36000, { authorised: 'no' }),
  ] })
  c.order.adj_igst = 50000; c.order.adj_ref = 'demand ID'
  const r = compute(c)
  assert.equal(r.total.admissible, 180000)
  assert.equal(r.total.rejected, 54000)
  assert.equal(r.total.net, 130000)
  c.v.ue_doc = 'declaration (up to ₹2 lakh)'
  assert.ok(stops(compute(c)).some(t => /CA \/ CMA certificate/.test(t)))
})

test('T7: cash ledger, a disputed TDS credit out, adjustment under CGST', () => {
  const c = make('T7', {
    claimed_igst: 25000, claimed_cgst: 40000, claimed_sgst: 40000, cash_igst: 25000, cash_cgst: 40000, cash_sgst: 40000,
  }, { cashrows: [
    { entry: 'CPIN 1', head: 'igst', minor: 'tax', credited: 15000, used: 0, claimed: 15000, refundable: 'yes' },
    { entry: 'TDS credit', head: 'igst', minor: 'tax', credited: 10000, used: 0, claimed: 10000, refundable: 'no' },
    { entry: 'CPIN 2', head: 'cgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
    { entry: 'CPIN 2', head: 'sgst', minor: 'tax', credited: 40000, used: 0, claimed: 40000, refundable: 'yes' },
  ] })
  c.order.adj_cgst = 8000; c.order.adj_ref = 'demand ID'
  const r = compute(c)
  assert.equal(r.total.admissible, 95000)
  assert.equal(r.total.rejected, 10000)
  assert.equal(r.total.net, 87000)
  assert.deepEqual([r.heads.igst.net, r.heads.cgst.net, r.heads.sgst.net], [15000, 32000, 40000])
  assert.equal(r.limitation.length, 0)
})

test('T8: pre-deposit refunded in cash with s.115 interest, head by head', () => {
  const c = make('T8', {
    ao_comm: '2026-06-12', filed: '2026-07-01', ao_result: 'set aside in full', dept: 'accepted on review',
    pd_date: '2026-01-15', pd_mode: 'cash ledger', pd_cgst: 50000, pd_sgst: 50000,
    claimed_cgst: 50000, claimed_sgst: 50000, credit_date: '2026-08-20', int_rate: 6,
  })
  let r = compute(c)
  assert.equal(r.steps.days, 217)
  assert.equal(r.total.admissible, 100000)
  assert.deepEqual([r.heads.cgst.interest, r.heads.sgst.interest], [1784, 1784])
  assert.equal(r.total.interest, 3568)
  assert.equal(r.total.cash, 100000)
  c.v.int_rate = 9
  assert.equal(compute(c).total.interest, 5350)
})

test('T8: partial relief, row (c) met first from the pre-deposit', () => {
  const c = make('T8', {
    ao_comm: '2026-06-12', filed: '2026-07-01', ao_result: 'allowed in part', dept: 'accepted on review',
    pd_date: '2026-01-15', pd_mode: 'cash ledger', pd_cgst: 50000, pd_sgst: 50000,
    op_date: '2026-02-01', op_mode: 'cash ledger', op_cgst: 100000, op_sgst: 100000,
    nr_cgst: 105000, nr_sgst: 105000, nr_from: 'pre-deposit',
    claimed_cgst: 45000, claimed_sgst: 45000, credit_date: '2026-08-20',
  })
  const r = compute(c)
  assert.equal(r.total.admissible, 90000)
  assert.equal(r.total.pdRef, 0)
  assert.equal(r.total.opRef, 90000)
  assert.equal(r.total.interest, 0)       // only section 56 interest on row (b)
})
