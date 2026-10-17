// The speaking orders for templates T2, T3 and T4, built from the worked examples of the templates
// (made-up figures, as in categories.test.js). Run with: npm test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { compute, words } from './compute.js'
import { emptyCase, confirmsFor } from './fields.js'
import { orderToBuffer } from './word.js'
import { buildT2 } from './order-t2.js'
import { buildT3 } from './order-t3.js'
import { buildT4 } from './order-t4.js'

function make(cat, v, rows = {}) {
  const c = emptyCase(cat)
  Object.assign(c.v, { legal_name: 'Example Exports Private Limited', filed: '2026-09-10', ack: '2026-09-12', from: '2026-07', to: '2026-07', risk: 'not low-risk', ...v })
  c.rows = rows
  c.confirm = Object.fromEntries(confirmsFor(cat).map(x => [x.key, true]))
  return c
}
const answer = (c, amount) => {
  c.notice = { no: 'RFD08/1', date: '2026-09-20', reply: '2026-10-01', hearing: '2026-10-05', attended: 'authorised representative', drc01: c.notice.drc01 }
  c.grounds = [{ title: 'Ground', text: 'Ground stated', amount, reply: 'Reply', verified: 'Checked', finding: 'Not accepted', outcome: 'rejected' }]
  return c
}

async function check(build, c, figures) {
  const r = compute(c)
  const blocks = build(c, r)
  const text = JSON.stringify(blocks)
  for (const bad of ['undefined', 'NaN', 'null']) assert.doesNotMatch(text, new RegExp(bad), `"${bad}" in the order`)
  assert.ok(text.includes(`Rupees ${words(r.total.admissible)} only`), 'admissible amount in words')
  for (const f of figures) assert.ok(text.includes(f), `figure ${f} in the order`)
  if (r.total.rejected > 0) assert.match(text, /PMT-03/)
  assert.doesNotMatch(text, /Drafting note/)
  const buf = await orderToBuffer(blocks)
  assert.equal(buf.subarray(0, 2).toString(), 'PK')
  return { r, blocks, text }
}

test('T2 order: exports of goods, a time-barred shipping bill left out but kept in the Adjusted Total Turnover', async () => {
  const c = answer(make('T2', {
    exporter: 'manufacturer-exporter', supply_desc: 'machined steel parts', supply_hsn: '8483',
    zr_goods: 1680000, ato: 2180000, net_itc: 250000, itc_4a: 300000, itc_capital: 40000, itc_blocked: 10000,
    claimed_igst: 180000, end_igst: 200000, at_filing_igst: 190000, drawback: 'none', export_duty: 'no',
  }, { exports: [
    { inv: 'E/1', inv_value: 1000000, sb: 'SB 1', egm: '2026-07-10', fob: 980000 },
    { inv: 'E/2', inv_value: 500000, sb: 'SB 2', egm: '2026-07-20', fob: 510000 },
    { inv: 'E/3', inv_value: 200000, sb: 'SB 3', egm: '2024-08-01', fob: 200000 },
  ] }), 10275)
  const { text } = await check(buildT2, c, ['1,69,725', '1,69,724.77', '14,80,000', '21,80,000', '10,275', '9.6 **Realisation of export proceeds.**'])
  assert.match(text, /beyond two years on the date of filing/)
  assert.match(text, /SB 3[^"]*","2,00,000","beyond two years[^"]*","Yes"/)   // left out, kept in the ATO
  assert.match(text, /reconciles with GSTR-3B[^"]*₹3,00,000 − capital goods ₹40,000 − blocked or ineligible credit ₹10,000 = ₹2,50,000\./)
  assert.match(text, /section 54\(8\)\(a\)/)
})

test('T3 order: exports of services, rule 89(4)(D) turnover', async () => {
  const c = answer(make('T3', {
    supply_desc: 'software development services', supply_hsn: '998314', recipients: 'one recipient in Singapore', agreement: 'agreement dated 01.04.2026',
    zr_services: 1200000, d_a: 1200000, d_b: 300000, d_c: 200000, ato: 2000000, net_itc: 240000,
    claimed_igst: 160000, end_igst: 200000, at_filing_igst: 200000,
  }, { remits: [{ inv: 'S/1', inv_date: '2026-07-05', inv_value: 1000000, firc: 'F1', firc_date: '2026-07-25', realised: 1000000, advance: 'after supply' }] }), 4000)
  const { text } = await check(buildT3, c, ['1,56,000', '13,00,000', '20,00,000', '4,000', '1,56,000.00'])
  assert.match(text, /\(a\) \+ \(b\) − \(c\)","\*\*13,00,000\*\*/)
  assert.match(text, /All remittances have relevant dates on or after 25\.07\.2026/)
})

test('T4 order: SEZ supplies, unendorsed invoice out, excess provisional refund recovered', async () => {
  const c = make('T4', {
    sez_name: 'Example Unit, Example SEZ', supply_desc: 'electrical panels', supply_hsn: '8537',
    goods_or_services: 'goods', zr_goods: 900000, ato: 1500000, net_itc: 150000, risk: 'low-risk',
    claimed_igst: 90000, end_igst: 100000, at_filing_igst: 100000, prov_igst: 81000, rfd04_no: 'P/1', rfd04_date: '2026-09-15', rfd05_date: '2026-09-16',
  }, { sez: [
    { inv: 'Z/1', inv_date: '2026-07-04', value: 800000, endorsement: 'END/1', authorised: 'yes' },
    { inv: 'Z/2', inv_date: '2026-07-14', value: 100000, endorsement: '', authorised: 'yes' },
  ] })
  c.notice.drc01 = 'DRC-01 ref'
  answer(c, 10000)
  const { text, r } = await check(buildT4, c, ['80,000', '81,000', '90,000.00', '10,000'])
  assert.equal(r.total.excess, 1000)
  assert.match(text, /exceeds the amount found admissible, ₹80,000, by ₹1,000/)
  assert.match(text, /DRC-07/)
  assert.match(text, /No amount is payable to the applicant under this order/)
  assert.match(text, /no endorsement of the specified officer/)
  assert.match(text, /remain[s]? in the Adjusted Total Turnover/)
  assert.match(text, /section 54\(8\)\(b\)/)
})
