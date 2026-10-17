// Refund Desk: the facts of one refund claim, for each of the office's eight refund categories
// (templates T1 to T8). Each field is read from the documents by Claude, then checked and
// corrected by the officer. The same lists drive the reading (netlify/functions/jarvis-refund.mjs),
// the review screen and the order, so a field added here shows up everywhere. No AI does any
// arithmetic: see compute.js.
//
// type: text | money (rupees) | rate (per cent) | date (YYYY-MM-DD) | month (YYYY-MM) | choice
// cats: the categories that use the field (all when left out)

export const HEADS = ['igst', 'cgst', 'sgst', 'cess']
export const HEAD_LABEL = { igst: 'IGST', cgst: 'CGST', sgst: 'SGST', cess: 'Cess' }

// law: shown under the title; docs: what to add on the Documents step
export const CATS = {
  T1: { label: 'Inverted duty structure', short: 'Inverted duty', law: 's.54(3)(ii), rule 89(5)',
    docs: 'RFD-01 with Statement 1 and Annexure-B, GSTR-1, GSTR-3B and GSTR-2B of the period, the credit ledger, RFD-02 and RFD-04' },
  T2: { label: 'Export of goods under LUT (unutilised ITC)', short: 'Export of goods, LUT', law: 's.54(3)(i), s.16(3) IGST Act, rule 89(4)',
    docs: 'RFD-01 with Statements 3 and 3A, the shipping bills or ICEGATE EGM report, export invoices, the LUT, GSTR-1 (Table 6A), GSTR-3B, GSTR-2B, the credit ledger, RFD-02 and RFD-04' },
  T3: { label: 'Export of services under LUT (unutilised ITC)', short: 'Export of services, LUT', law: 's.54(3)(i), s.16(3) IGST Act, rule 89(4)',
    docs: 'RFD-01 with Statements 3 and 3A, export invoices, FIRCs or e-BRCs, the agreements, the LUT, GSTR-1, GSTR-3B, GSTR-2B, the credit ledger, RFD-02 and RFD-04' },
  T4: { label: 'Supplies to SEZ under LUT (unutilised ITC)', short: 'SEZ supplies, LUT', law: 's.54(3)(i), s.16(1)(b) and 16(3) IGST Act, rule 89(4)',
    docs: 'RFD-01 with Statements 5 and 5A, the endorsed SEZ invoices, the Letter of Approval, the LUT, GSTR-1 (Table 6B), GSTR-3B, GSTR-2B, the credit ledger, RFD-02 and RFD-04' },
  T5: { label: 'Export of services with IGST paid', short: 'Services exported with IGST', law: 's.54(1), s.16(4) IGST Act',
    docs: 'RFD-01 with Statement 2, export invoices, FIRCs or e-BRCs, GSTR-1 (Table 6A), GSTR-3B, RFD-02 and RFD-04' },
  T6: { label: 'Supplies to SEZ with IGST paid', short: 'SEZ supplies with IGST', law: 's.54(1), s.16(1)(b) and 16(4) IGST Act',
    docs: 'RFD-01 with Statement 4, the endorsed SEZ invoices, the Letter of Approval, the rule 89(2)(f) declaration, the unjust enrichment declaration or CA / CMA certificate, GSTR-1 (Table 6B), GSTR-3B, RFD-02 and RFD-04' },
  T7: { label: 'Excess balance in the electronic cash ledger', short: 'Cash ledger balance', law: 's.49(6), proviso to s.54(1)',
    docs: 'RFD-01, the electronic cash ledger, the challans (CPIN / CIN), TDS / TCS credit statements and GSTR-3B' },
  T8: { label: 'Pre-deposit or tax paid, after an appellate order', short: 'After appeal (pre-deposit)', law: 's.54(1), s.54(8)(e), s.115',
    docs: 'RFD-01, the order-in-original, APL-01, the pre-deposit and DRC-03 entries, the Electronic Liability Register Part II, the appellate order and the unjust enrichment declaration or CA / CMA certificate' },
}
export const ITC_CATS = ['T1', 'T2', 'T3', 'T4']        // refund of unutilised credit: formula, ledger, PMT-03
export const R89_4 = ['T2', 'T3', 'T4']                 // rule 89(4) formula
export const TAX_CATS = ['T5', 'T6']                    // refund of IGST paid on a zero-rated supply
export const PROV_CATS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']   // provisional refund under s.54(6) / Instruction 06/2025
export const MONTHLY_LIMIT = ['T1', 'T4', 'T6']         // relevant date is the GSTR-3B due date (clauses (e) and (ba))
const ALL = Object.keys(CATS)
const not = (...xs) => ALL.filter(k => !xs.includes(k))

const heads = (key, label, group, read, cats, only = HEADS) => only.map(h => ({
  key: `${key}_${h}`, label: `${label}: ${HEAD_LABEL[h]}`, group, type: 'money', read, cats,
}))

export const GROUPS = [
  { key: 'applicant', label: 'Applicant' },
  { key: 'supply',    label: 'The supplies' },
  { key: 'claim',     label: 'The application (RFD-01)' },
  { key: 'appeal',    label: 'The appeal and the appellate order' },
  { key: 'formula',   label: 'Formula figures' },
  { key: 'itc',       label: 'Credit (reconciliation)' },
  { key: 'ledger',    label: 'Electronic credit ledger' },
  { key: 'cash',      label: 'Electronic cash ledger' },
  { key: 'tax',       label: 'Tax paid on the supplies' },
  { key: 'cess',      label: 'Compensation cess (only if claimed)' },
  { key: 'prov',      label: 'Provisional refund (RFD-04)' },
]

export const FIELDS = [
  // Applicant
  { key: 'legal_name',  label: 'Legal name', group: 'applicant', type: 'text', read: 'Legal name of the applicant' },
  { key: 'trade_name',  label: 'Trade name', group: 'applicant', type: 'text', read: 'Trade name, if different' },
  { key: 'gstin',       label: 'GSTIN', group: 'applicant', type: 'text', read: '15-character GSTIN of the applicant' },
  { key: 'address',     label: 'Principal place of business', group: 'applicant', type: 'text', read: 'Address of the principal place of business' },

  // The supplies
  { key: 'outward',     label: 'Outward supplies (description)', group: 'supply', type: 'text', read: 'What the applicant supplies (the inverted-rated outputs), in a few words', cats: ['T1'] },
  { key: 'outward_hsn', label: 'Outward HSN', group: 'supply', type: 'text', read: 'HSN code(s) of the inverted-rated outward supplies', cats: ['T1'] },
  { key: 'output_rate', label: 'Output tax rate (%)', group: 'supply', type: 'rate', read: 'GST rate on the inverted-rated outward supplies, in per cent', cats: ['T1'] },
  { key: 'inputs',      label: 'Principal inputs (description)', group: 'supply', type: 'text', read: 'The principal inputs, in a few words', cats: ['T1'] },
  { key: 'input_hsn',   label: 'Input HSN', group: 'supply', type: 'text', read: 'HSN code(s) of the principal inputs', cats: ['T1'] },
  { key: 'input_rate',  label: 'Principal input tax rate (%)', group: 'supply', type: 'rate', read: 'GST rate on the principal inputs, in per cent', cats: ['T1'] },
  { key: 'supply_desc', label: 'Goods / services supplied', group: 'supply', type: 'text', read: 'Description of the goods or services exported or supplied to the SEZ', cats: ['T2', 'T3', 'T4', 'T5', 'T6'] },
  { key: 'supply_hsn',  label: 'HSN / SAC', group: 'supply', type: 'text', read: 'HSN or SAC of the goods or services', cats: ['T2', 'T3', 'T4', 'T5', 'T6'] },
  { key: 'exporter',    label: 'Manufacturer or merchant exporter', group: 'supply', type: 'choice', options: ['manufacturer-exporter', 'merchant exporter'], read: 'Whether the applicant is a manufacturer-exporter or a merchant exporter', cats: ['T2'] },
  { key: 'recipients',  label: 'Recipient(s) and country', group: 'supply', type: 'text', read: 'Number of recipients outside India and their country or countries', cats: ['T3', 'T5'] },
  { key: 'agreement',   label: 'Agreement(s)', group: 'supply', type: 'text', read: 'Agreement(s) with the recipient, with dates', cats: ['T3', 'T5'] },
  { key: 'sez_name',    label: 'SEZ unit(s) / developer and the Zone', group: 'supply', type: 'text', read: 'Name of the SEZ unit or developer and of the Special Economic Zone', cats: ['T4', 'T6'] },
  { key: 'lut_arn',     label: 'LUT ARN', group: 'supply', type: 'text', read: 'ARN of the Letter of Undertaking (LUT)', cats: ['T2', 'T3', 'T4'] },
  { key: 'lut_date',    label: 'LUT date', group: 'supply', type: 'date', read: 'Date of the LUT', cats: ['T2', 'T3', 'T4'] },
  { key: 'lut_fy',      label: 'LUT for financial year', group: 'supply', type: 'text', read: 'Financial year the LUT covers, e.g. 2026-27', cats: ['T2', 'T3', 'T4'] },
  { key: 'drawback',    label: 'Drawback claimed', group: 'supply', type: 'choice', options: ['none', 'customs portion only', 'including central tax'], read: 'Drawback claimed on the shipping bills: none, customs portion only, or including central tax', cats: ['T2'] },
  { key: 'export_duty', label: 'Goods subject to export duty', group: 'supply', type: 'choice', options: ['no', 'yes'], read: 'Whether the exported goods are subject to export duty', cats: ['T2'] },
  { key: 'goods_or_services', label: 'Goods or services', group: 'supply', type: 'choice', options: ['goods', 'services'], read: 'Whether the supplies to the SEZ are of goods or of services', cats: ['T4', 'T6'] },
  { key: 'ue_doc',      label: 'Unjust enrichment document', group: 'claim', type: 'choice', options: ['declaration (up to ₹2 lakh)', 'CA / CMA certificate (above ₹2 lakh)', 'not filed'], read: 'Declaration under rule 89(2)(l) or certificate under rule 89(2)(m) filed', cats: ['T6', 'T8'] },
  { key: 'cash_reason', label: 'Why the cash balance arose (as stated)', group: 'cash', type: 'text', read: 'The reason the applicant gives for the balance in the electronic cash ledger', cats: ['T7'] },

  // The application
  { key: 'arn',         label: 'ARN of RFD-01', group: 'claim', type: 'text', read: 'ARN of the refund application in FORM GST RFD-01' },
  { key: 'filed',       label: 'Date of filing (ARN date)', group: 'claim', type: 'date', read: 'Date on which RFD-01 was filed' },
  { key: 'ack',         label: 'RFD-02 acknowledgement date', group: 'claim', type: 'date', read: 'Date of the acknowledgement in FORM GST RFD-02' },
  { key: 'from',        label: 'Period from', group: 'claim', type: 'month', read: 'First month of the claim period', cats: not('T7', 'T8') },
  { key: 'to',          label: 'Period to', group: 'claim', type: 'month', read: 'Last month of the claim period', cats: not('T7', 'T8') },
  { key: 'balance_on',  label: 'Balance claimed as on', group: 'claim', type: 'date', read: 'Date as on which the cash ledger balance is claimed', cats: ['T7'] },
  { key: 'return_type', label: 'GSTR-3B filed', group: 'claim', type: 'choice', options: ['monthly', 'quarterly'], read: 'monthly, or quarterly (QRMP scheme)', cats: MONTHLY_LIMIT },
  { key: 'excluded_days', label: 'Days excluded for an earlier RFD-03 (proviso to rule 90(3))', group: 'claim', type: 'money', read: 'Only if an earlier application for this period was returned by RFD-03: days from that filing to the RFD-03', cats: not('T7') },
  { key: 'debit_no',    label: 'Debit entry No. (rule 89(3))', group: 'claim', type: 'text', read: 'Debit entry number in the electronic credit or cash ledger for the amount claimed', cats: [...ITC_CATS, 'T7'] },
  { key: 'debit_date',  label: 'Debit entry date', group: 'claim', type: 'date', read: 'Date of that debit entry', cats: [...ITC_CATS, 'T7'] },
  ...heads('claimed', 'Amount claimed', 'claim', 'Refund claimed in RFD-01 under this head, in rupees', not('T5'), HEADS),
  ...heads('claimed', 'Amount claimed', 'claim', 'Refund claimed in RFD-01 under this head, in rupees', ['T5'], ['igst']),

  // T8: the appeal
  { key: 'oio',          label: 'Order-in-original No. and date', group: 'appeal', type: 'text', read: 'Number and date of the order-in-original', cats: ['T8'] },
  { key: 'oio_by',       label: 'Passed by', group: 'appeal', type: 'text', read: 'Authority that passed the order-in-original', cats: ['T8'] },
  { key: 'oio_tax',      label: 'Tax confirmed in it', group: 'appeal', type: 'money', read: 'Tax demand confirmed by the order-in-original', cats: ['T8'] },
  { key: 'oio_ground',   label: 'Ground of the demand (one line)', group: 'appeal', type: 'text', read: 'The ground of the demand in one line', cats: ['T8'] },
  { key: 'apl_arn',      label: 'APL-01 ARN and date', group: 'appeal', type: 'text', read: 'ARN and date of the appeal in FORM GST APL-01', cats: ['T8'] },
  { key: 'pd_date',      label: 'Pre-deposit paid on', group: 'appeal', type: 'date', read: 'Date the pre-deposit under section 107(6) was paid', cats: ['T8'] },
  { key: 'pd_mode',      label: 'Pre-deposit paid from', group: 'appeal', type: 'choice', options: ['cash ledger', 'credit ledger'], read: 'Ledger the pre-deposit was debited from', cats: ['T8'] },
  ...heads('pd', 'Pre-deposit (row (a))', 'appeal', 'Pre-deposit paid under section 107(6) or 112(8), this head', ['T8']),
  { key: 'op_date',      label: 'Other amounts paid on', group: 'appeal', type: 'date', read: 'Date other amounts were paid towards the demand (DRC-03)', cats: ['T8'] },
  { key: 'op_mode',      label: 'Other amounts paid from', group: 'appeal', type: 'choice', options: ['cash ledger', 'credit ledger'], read: 'Ledger the other amounts were paid from', cats: ['T8'] },
  ...heads('op', 'Other amounts paid (row (b))', 'appeal', 'Other amounts paid towards the demand, this head', ['T8']),
  { key: 'ao',           label: 'Appellate order No. and date', group: 'appeal', type: 'text', read: 'Number and date of the order of the Appellate Authority or Tribunal', cats: ['T8'] },
  { key: 'ao_by',        label: 'Appellate authority', group: 'appeal', type: 'text', read: 'The Appellate Authority or Tribunal that passed it', cats: ['T8'] },
  { key: 'ao_comm',      label: 'Appellate order communicated on', group: 'appeal', type: 'date', read: 'Date the appellate order was communicated to the applicant (relevant date)', cats: ['T8'] },
  { key: 'ao_result',    label: 'Result of the appeal', group: 'appeal', type: 'choice', options: ['set aside in full', 'allowed in part', 'remanded'], read: 'Whether the appeal set aside the demand in full, allowed it in part, or remanded the matter', cats: ['T8'] },
  { key: 'dept',         label: "Department's position", group: 'appeal', type: 'choice', options: ['accepted on review', 'department has appealed', 'review period open'], read: 'Whether the department accepted the appellate order, appealed, or the review period is still open', cats: ['T8'] },
  ...heads('nr', 'Not refundable (row (c))', 'appeal', 'Part of the amounts paid that the appellate order does not require to be refunded, this head', ['T8']),
  { key: 'nr_from',      label: 'Row (c) met first from', group: 'appeal', type: 'choice', options: ['pre-deposit', 'other amounts'], read: 'Whether the amount not refundable is met first from the pre-deposit or from the other amounts', cats: ['T8'] },
  { key: 'int_rate',     label: 'Interest rate under s.115 (%)', group: 'appeal', type: 'rate', read: 'Rate of interest adopted under section 115 (6 or 9)', cats: ['T8'] },
  { key: 'credit_date',  label: 'Expected date of credit to the bank', group: 'appeal', type: 'date', read: 'Expected date the refund will be credited, for working out interest', cats: ['T8'] },

  // Formula, T1 (rule 89(5))
  { key: 'A', label: 'A. Turnover of inverted rated supply', group: 'formula', type: 'money', read: 'Turnover of inverted rated supply of goods and services for the period (Statement 1 of RFD-01)', cats: ['T1'] },
  { key: 'B', label: 'B. Adjusted Total Turnover', group: 'formula', type: 'money', read: 'Adjusted Total Turnover for the period (Statement 1 / GSTR-3B 3.1(a)+(b))', cats: ['T1'] },
  { key: 'C', label: 'C. Net ITC (inputs only)', group: 'formula', type: 'money', read: 'Net ITC: credit availed on inputs only during the period (Statement 1)', cats: ['T1'] },
  { key: 'D', label: 'D. ITC on inputs and input services', group: 'formula', type: 'money', read: 'ITC availed on inputs and input services (no capital goods) during the period', cats: ['T1'] },
  { key: 'E', label: 'E. Tax payable on inverted rated supply', group: 'formula', type: 'money', read: 'Tax payable on the inverted rated supply (Statement 1)', cats: ['T1'] },
  // Formula, T2 to T4 (rule 89(4)), as claimed in RFD-01
  { key: 'zr_goods',    label: 'Turnover of zero-rated supply of goods (as claimed)', group: 'formula', type: 'money', read: 'Turnover of zero-rated supply of goods in Statement 3A / RFD-01', cats: ['T2', 'T4'] },
  { key: 'zr_services', label: 'Turnover of zero-rated supply of services (as claimed)', group: 'formula', type: 'money', read: 'Turnover of zero-rated supply of services in Statement 3A / RFD-01', cats: R89_4 },
  { key: 'ato',         label: 'Adjusted Total Turnover', group: 'formula', type: 'money', read: 'Adjusted Total Turnover for the period', cats: R89_4 },
  { key: 'net_itc',     label: 'Net ITC (inputs and input services)', group: 'formula', type: 'money', read: 'Net ITC: credit on inputs and input services availed during the period', cats: R89_4 },
  { key: 'd_a', label: 'Services: all payments received in the period', group: 'formula', type: 'money', read: 'Rule 89(4)(D)(a): all payments received during the period for zero-rated supply of services, including advances', cats: ['T3', 'T4'] },
  { key: 'd_b', label: 'Services: completed against earlier advances', group: 'formula', type: 'money', read: 'Rule 89(4)(D)(b): services completed during the period for which advance was received earlier', cats: ['T3', 'T4'] },
  { key: 'd_c', label: 'Services: advances for work not completed', group: 'formula', type: 'money', read: 'Rule 89(4)(D)(c): advances received during the period for services not completed', cats: ['T3', 'T4'] },

  { key: 'itc_4a',        label: 'ITC availed, GSTR-3B Table 4A(1) to 4A(5)', group: 'itc', type: 'money', read: 'Total ITC availed in GSTR-3B Table 4A(1) to 4A(5) for the period (all heads, excluding cess)', cats: ITC_CATS },
  { key: 'itc_services',  label: 'ITC on input services', group: 'itc', type: 'money', read: 'ITC on input services in the period', cats: ['T1'] },
  { key: 'itc_capital',   label: 'ITC on capital goods', group: 'itc', type: 'money', read: 'ITC on capital goods in the period', cats: ITC_CATS },
  { key: 'itc_blocked',   label: 'Blocked / ineligible ITC (s.17(5), s.16(4))', group: 'itc', type: 'money', read: 'Credit blocked by section 17(5) or barred by section 16(4) included in Table 4A', cats: ITC_CATS },
  { key: 'itc_2b',        label: 'ITC as per GSTR-2B', group: 'itc', type: 'money', read: 'ITC reflected in GSTR-2B for the period or earlier periods (inputs only for inverted duty)', cats: ITC_CATS },
  { key: 'exempt',        label: 'Exempt / nil-rated supplies (kept out of turnover)', group: 'itc', type: 'money', read: 'Value of exempt and nil-rated supplies in the period', cats: ITC_CATS },
  { key: 'zero_rated',    label: 'Exports and SEZ supplies (in B, not in A)', group: 'itc', type: 'money', read: 'Value of zero-rated supplies (exports, SEZ) in the period', cats: ['T1'] },

  ...heads('end', 'Balance at end of period', 'ledger', 'Balance in the electronic credit ledger at the end of the tax period, this head', ITC_CATS),
  ...heads('at_filing', 'Balance at filing', 'ledger', 'Balance in the electronic credit ledger at the time of filing RFD-01, this head', ITC_CATS),
  ...heads('cash', 'Cash ledger balance at filing', 'cash', 'Balance in the electronic cash ledger on the date of filing, this head', ['T7']),

  { key: 'tax_gstr1', label: 'IGST shown in GSTR-1 (Table 6A / 6B)', group: 'tax', type: 'money', read: 'Integrated tax on these zero-rated supplies shown in GSTR-1 Table 6A (exports) or 6B (SEZ) for the period', cats: TAX_CATS },
  { key: 'tax_3b',    label: 'IGST paid in GSTR-3B Table 3.1(b)', group: 'tax', type: 'money', read: 'Integrated tax on zero-rated supplies declared and paid in GSTR-3B Table 3.1(b)', cats: TAX_CATS },

  { key: 'cess_C', label: 'Cess: Net ITC of cess on inputs', group: 'cess', type: 'money', read: 'Cess credit availed on inputs (only if cess is claimed)', cats: ITC_CATS },
  { key: 'cess_D', label: 'Cess: credit on inputs and input services', group: 'cess', type: 'money', read: 'Cess credit on inputs and input services (only if cess is claimed)', cats: ['T1'] },
  { key: 'cess_E', label: 'Cess payable on inverted rated supply', group: 'cess', type: 'money', read: 'Cess payable on the inverted rated supply (only if cess is claimed)', cats: ['T1'] },

  { key: 'risk',      label: 'System risk category', group: 'prov', type: 'choice', options: ['low-risk', 'not low-risk', 'barred'], read: 'Risk category shown by the system: low-risk, not low-risk, or barred (no Aadhaar authentication, notified goods)', cats: PROV_CATS },
  { key: 'rfd04_no',   label: 'RFD-04 No.', group: 'prov', type: 'text', read: 'Number of the provisional refund order in FORM GST RFD-04, if any', cats: PROV_CATS },
  { key: 'rfd04_date', label: 'RFD-04 date', group: 'prov', type: 'date', read: 'Date of RFD-04', cats: PROV_CATS },
  { key: 'rfd05_date', label: 'RFD-05 date (provisional payment)', group: 'prov', type: 'date', read: 'Date of the payment order RFD-05 for the provisional refund', cats: PROV_CATS },
  ...heads('prov', 'Provisional refund paid', 'prov', 'Provisional refund paid under this head, in rupees', PROV_CATS),
]

// One entry per key. A key used by two entries (claimed_igst) gets the union of their categories.
export const FIELD = {}
for (const f of FIELDS) {
  const had = FIELD[f.key]
  FIELD[f.key] = had ? { ...had, cats: had.cats && f.cats ? [...new Set([...had.cats, ...f.cats])] : undefined } : f
}
export const fieldsFor = (cat) => {
  const seen = new Set()
  return FIELDS.filter(f => (!f.cats || f.cats.includes(cat)) && !seen.has(f.key) && seen.add(f.key))
}

// Tables of the order, by category. lim: the column that gives the relevant date of a row.
const yesNo = ['yes', 'no']
export const INPUT_TYPES = ['input', 'input service', 'capital goods', 'blocked']
export const TABLES = {
  inputs: { label: 'Table 1: inputs', cats: ['T1'], cols: [
    { key: 'hsn', label: 'HSN', type: 'text' }, { key: 'desc', label: 'Description', type: 'text' },
    { key: 'rate', label: 'Rate %', type: 'rate' }, { key: 'value', label: 'Taxable value', type: 'money' },
    { key: 'itc', label: 'ITC availed', type: 'money' }, { key: 'kind', label: 'Type', type: 'choice', options: INPUT_TYPES },
  ] },
  outputs: { label: 'Table 2: outward supplies', cats: ['T1'], cols: [
    { key: 'hsn', label: 'HSN', type: 'text' }, { key: 'desc', label: 'Description', type: 'text' },
    { key: 'rate', label: 'Rate %', type: 'rate' }, { key: 'value', label: 'Taxable value', type: 'money' },
    { key: 'tax', label: 'Tax', type: 'money' }, { key: 'inverted', label: 'Inverted?', type: 'choice', options: ['yes', 'no: rate not lower', 'no: zero-rated', 'no: exempt', 'no: excluded by notification'] },
  ] },
  exports: { label: 'Table 1: shipping bills', cats: ['T2'], cols: [
    { key: 'inv', label: 'Invoice No. and date', type: 'text' }, { key: 'inv_value', label: 'Invoice value', type: 'money' },
    { key: 'sb', label: 'Shipping bill No. and date', type: 'text' }, { key: 'port', label: 'Port', type: 'text' },
    { key: 'egm', label: 'EGM date (relevant date)', type: 'date' }, { key: 'fob', label: 'FOB value', type: 'money' },
    { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
  remits: { label: 'Table 1: invoices and remittances', cats: ['T3'], cols: [
    { key: 'inv', label: 'Invoice No.', type: 'text' }, { key: 'inv_date', label: 'Invoice date', type: 'date' },
    { key: 'inv_value', label: 'Invoice value', type: 'money' }, { key: 'firc', label: 'FIRC / e-BRC No.', type: 'text' },
    { key: 'firc_date', label: 'Remittance date', type: 'date' }, { key: 'realised', label: 'Amount realised', type: 'money' },
    { key: 'advance', label: 'Payment', type: 'choice', options: ['after supply', 'advance'] }, { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
  sez: { label: 'Table 1: invoices to the SEZ', cats: ['T4'], cols: [
    { key: 'inv', label: 'Invoice No.', type: 'text' }, { key: 'inv_date', label: 'Invoice date', type: 'date' },
    { key: 'unit', label: 'SEZ unit (GSTIN)', type: 'text' }, { key: 'desc', label: 'Goods / services', type: 'text' },
    { key: 'value', label: 'Taxable value', type: 'money' }, { key: 'endorsement', label: 'Endorsement (No. and date)', type: 'text' },
    { key: 'authorised', label: 'Authorised operations?', type: 'choice', options: yesNo }, { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
  taxinv: { label: 'Table 1: invoices, tax paid and remittances', cats: ['T5'], cols: [
    { key: 'inv', label: 'Invoice No.', type: 'text' }, { key: 'inv_date', label: 'Invoice date', type: 'date' },
    { key: 'value', label: 'Taxable value', type: 'money' }, { key: 'igst', label: 'IGST paid', type: 'money' },
    { key: 'in_gstr1', label: 'In GSTR-1 6A?', type: 'choice', options: yesNo }, { key: 'firc', label: 'FIRC / e-BRC No.', type: 'text' },
    { key: 'firc_date', label: 'Remittance date', type: 'date' }, { key: 'advance', label: 'Payment', type: 'choice', options: ['after supply', 'advance'] },
    { key: 'export', label: 'Export of services?', type: 'choice', options: yesNo }, { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
  seztax: { label: 'Table 1: invoices to the SEZ, with tax', cats: ['T6'], cols: [
    { key: 'inv', label: 'Invoice No.', type: 'text' }, { key: 'inv_date', label: 'Invoice date', type: 'date' },
    { key: 'unit', label: 'SEZ unit (GSTIN)', type: 'text' }, { key: 'desc', label: 'Goods / services', type: 'text' },
    { key: 'value', label: 'Taxable value', type: 'money' }, { key: 'igst', label: 'IGST paid', type: 'money' }, { key: 'cess', label: 'Cess paid', type: 'money' },
    { key: 'endorsement', label: 'Endorsement (No. and date)', type: 'text' }, { key: 'authorised', label: 'Authorised operations?', type: 'choice', options: yesNo },
    { key: 'collected', label: 'Tax collected from the SEZ?', type: 'choice', options: yesNo }, { key: 'in_gstr1', label: 'In GSTR-1 6B?', type: 'choice', options: yesNo },
    { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
  cashrows: { label: 'Table 1: what the cash balance is made of', cats: ['T7'], cols: [
    { key: 'entry', label: 'Challan (CPIN / CIN) or TDS / TCS credit, and date', type: 'text' },
    { key: 'head', label: 'Head', type: 'choice', options: HEADS }, { key: 'minor', label: 'Minor head', type: 'choice', options: ['tax', 'interest', 'penalty', 'fee', 'others'] },
    { key: 'credited', label: 'Amount credited', type: 'money' }, { key: 'used', label: 'Used later', type: 'money' },
    { key: 'claimed', label: 'Unutilised and claimed', type: 'money' }, { key: 'refundable', label: 'Refundable?', type: 'choice', options: yesNo },
    { key: 'remarks', label: 'Remarks', type: 'text' },
  ] },
}
export const tablesFor = (cat) => Object.entries(TABLES).filter(([, t]) => t.cats.includes(cat)).map(([key, t]) => ({ key, ...t }))
// Kept for older code paths that only know inverted duty
export const INPUT_COLS = TABLES.inputs.cols
export const OUTPUT_COLS = TABLES.outputs.cols

// What the officer confirms by hand: things no document read can settle
export const CONFIRMS = [
  { key: 'returns',     cats: not('T7', 'T8'), text: 'All returns due up to the date of the application are filed', law: 'para 6 of Circular 125/44/2019-GST' },
  { key: 'undertaking', cats: ITC_CATS, text: 'The undertaking about section 16(2)(c) is filed online', law: 'para 2.4 of Circular 197/09/2023-GST' },
  { key: 'no_overlap',  text: 'Back-office refund history shows no other claim for this period, these invoices or this amount', law: 'Circular 125/44/2019-GST' },
  { key: 'notification', cats: ['T1'], text: 'The outward supplies are not in Notification 5/2017-CT(R) (goods) or 15/2017-CT(R) (services), as amended', law: 'first proviso to s.54(3)(ii)' },
  { key: 'same_goods',  cats: ['T1'], text: 'Inputs and outputs are not the same goods with a rate change over time (or a concessional rate notification applies)', law: 'paras 3.2 and 3.3 of Circular 135/05/2020-GST as substituted by Circular 173/05/2022-GST' },
  { key: 'lut',         cats: ['T2', 'T3', 'T4'], text: 'The LUT was valid for the financial year of every invoice', law: 'rule 96A; para 44 of Circular 125/44/2019-GST' },
  { key: 'icegate',     cats: ['T2'], text: 'Each shipping bill, EGM date and FOB value checked on ICEGATE and matched with GSTR-1 Table 6A', law: 'para 18 of Circular 125/44/2019-GST' },
  { key: 'domestic',    cats: ['T2', 'T4'], text: 'No like goods supplied domestically at a value making 1.5 times that value lower than the export value', law: 'rule 89(4)(C)' },
  { key: 'export_2_6',  cats: ['T3', 'T5'], text: 'Each condition of section 2(6) of the IGST Act is met (recipient abroad, place of supply outside India under s.13, payment in foreign exchange, not merely establishments of a distinct person)', law: 's.2(6) and s.13 of the IGST Act; Circulars 159/15/2021, 161/17/2021, 202/14/2023' },
  { key: 'endorsed',    cats: ['T4', 'T6'], text: "Every invoice bears the specified officer's endorsement and is for authorised operations in the Letter of Approval", law: 'proviso to rule 89(1); rule 89(2)(d) and (e)' },
  { key: 'not_collected', cats: ['T4', 'T6'], text: 'Declaration under rule 89(2)(f) filed: tax not collected from the SEZ unit / developer', law: 'rule 89(2)(f)' },
  { key: 'tax_matches', cats: TAX_CATS, text: 'Tax in GSTR-1 agrees with GSTR-3B Table 3.1(b) and the claim; none of it later reduced by a credit note or amendment', law: 'rule 89(2)(c)' },
  { key: 'gstr2b',      cats: ITC_CATS, text: 'Credit taken is in GSTR-2B of the period or an earlier period; no s.17(5) or s.16(4) credit included', law: 'para 1.3 of Circular 197/09/2023-GST' },
  { key: 'suppliers',   cats: ITC_CATS, text: 'Supplier risk checked (large suppliers, cancelled or non-filing suppliers, DIGIT)', law: 'refund SOP' },
  { key: 'cash_source', cats: ['T7'], text: 'Every credit in the cash ledger checked; the balance is not tax for an unfiled return, not a deposit during an inquiry awaiting DRC-03, and not a pre-deposit', law: 's.49(6); Circular 166/22/2021-GST' },
  { key: 'own_account', cats: ['T7'], text: "All deposits were made from the applicant's own bank account", law: 'rule 92(4)' },
  { key: 'payments',    cats: ['T8'], text: 'The pre-deposit and other payments verified in the ledger and in the Electronic Liability Register Part II against the demand ID', law: 'rule 89(2)(a)' },
  { key: 'dues',        text: 'No confirmed dues not stayed (or they are adjusted / withheld in para 9.2)', law: 's.54(10) and 54(11)' },
  { key: 'bank',        text: 'Bank account in RFD-01 is in the registration and validated on the portal', law: 'rule 92(4)' },
  { key: 'aadhaar',     text: 'Aadhaar authentication under rule 10B done', law: 'rule 10B; Notification 14/2025-CT' },
]
export const confirmsFor = (cat) => CONFIRMS.filter(x => !x.cats || x.cats.includes(cat))

export const emptyCase = (cat = 'T1') => ({
  cat,                              // refund category: T1 to T8
  v: { return_type: 'monthly', ...(cat === 'T8' && { int_rate: 6 }) },   // field values
  src: {},                          // where each value came from ("GSTR-3B p.2")
  alt: {},                          // a different figure for the same field in another document
  edited: {},                       // figures the officer corrected: what was read, and from where
  rows: {},                         // the category's tables: { inputs: [...], outputs: [...], exports: [...], ... }
  confirm: {},                      // officer's ticks
  // RFD-08 notice, RFD-09 reply and hearing. relied: documents relied on in the notice; drc01,
  // recovery_sec, penalty: only where the notice also proposes recovery (excess provisional refund)
  notice: { no: '', date: '', rfn: '', reply: '', hearing: '', time: '', attended: '', docs: '', relied: '', drc01: '', recovery_sec: '', penalty: '' },
  grounds: [],                      // [{ title, text, amount, affected, reply, verified, finding, outcome, effect, para }]
  // dues: date the s.54(10) dues were checked; adj_*: amount adjusted under s.54(10)(b) in this order,
  // against adj_ref (demand ID or order)
  order: { no: '', date: '', rfn: '', range: '', dues: '', adj_ref: '', adj_igst: '', adj_cgst: '', adj_sgst: '', adj_cess: '' },
})
