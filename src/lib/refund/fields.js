// Refund Desk: the facts of one inverted-duty refund claim (template T1).
// Each field is read from the documents by Claude, then checked and corrected by the officer.
// The same list drives the reading (netlify/functions/jarvis-refund.mjs), the review screen and
// the order, so a field added here shows up everywhere. No AI does any arithmetic: see compute.js.
//
// type: text | money (rupees) | rate (per cent) | date (YYYY-MM-DD) | month (YYYY-MM) | choice

export const HEADS = ['igst', 'cgst', 'sgst', 'cess']
export const HEAD_LABEL = { igst: 'IGST', cgst: 'CGST', sgst: 'SGST', cess: 'Cess' }

const heads = (key, label, group, read) => HEADS.map(h => ({
  key: `${key}_${h}`, label: `${label}: ${HEAD_LABEL[h]}`, group, type: 'money', read,
}))

export const GROUPS = [
  { key: 'applicant', label: 'Applicant and supplies' },
  { key: 'claim',     label: 'The application (RFD-01)' },
  { key: 'formula',   label: 'Rule 89(5) figures' },
  { key: 'itc',       label: 'Credit (reconciliation)' },
  { key: 'ledger',    label: 'Electronic credit ledger' },
  { key: 'cess',      label: 'Compensation cess (only if claimed)' },
  { key: 'prov',      label: 'Provisional refund (RFD-04)' },
]

export const FIELDS = [
  { key: 'legal_name',  label: 'Legal name', group: 'applicant', type: 'text', read: 'Legal name of the applicant' },
  { key: 'trade_name',  label: 'Trade name', group: 'applicant', type: 'text', read: 'Trade name, if different' },
  { key: 'gstin',       label: 'GSTIN', group: 'applicant', type: 'text', read: '15-character GSTIN of the applicant' },
  { key: 'address',     label: 'Principal place of business', group: 'applicant', type: 'text', read: 'Address of the principal place of business' },
  { key: 'outward',     label: 'Outward supplies (description)', group: 'applicant', type: 'text', read: 'What the applicant supplies (the inverted-rated outputs), in a few words' },
  { key: 'outward_hsn', label: 'Outward HSN', group: 'applicant', type: 'text', read: 'HSN code(s) of the inverted-rated outward supplies' },
  { key: 'output_rate', label: 'Output tax rate (%)', group: 'applicant', type: 'rate', read: 'GST rate on the inverted-rated outward supplies, in per cent' },
  { key: 'inputs',      label: 'Principal inputs (description)', group: 'applicant', type: 'text', read: 'The principal inputs, in a few words' },
  { key: 'input_hsn',   label: 'Input HSN', group: 'applicant', type: 'text', read: 'HSN code(s) of the principal inputs' },
  { key: 'input_rate',  label: 'Principal input tax rate (%)', group: 'applicant', type: 'rate', read: 'GST rate on the principal inputs, in per cent' },

  { key: 'arn',         label: 'ARN of RFD-01', group: 'claim', type: 'text', read: 'ARN of the refund application in FORM GST RFD-01' },
  { key: 'filed',       label: 'Date of filing (ARN date)', group: 'claim', type: 'date', read: 'Date on which RFD-01 was filed' },
  { key: 'ack',         label: 'RFD-02 acknowledgement date', group: 'claim', type: 'date', read: 'Date of the acknowledgement in FORM GST RFD-02' },
  { key: 'from',        label: 'Period from', group: 'claim', type: 'month', read: 'First month of the claim period' },
  { key: 'to',          label: 'Period to', group: 'claim', type: 'month', read: 'Last month of the claim period' },
  { key: 'return_type', label: 'GSTR-3B filed', group: 'claim', type: 'choice', options: ['monthly', 'quarterly'], read: 'monthly, or quarterly (QRMP scheme)' },
  { key: 'excluded_days', label: 'Days excluded for an earlier RFD-03 (proviso to rule 90(3))', group: 'claim', type: 'money', read: 'Only if an earlier application for this period was returned by RFD-03: days from that filing to the RFD-03' },
  { key: 'debit_no',    label: 'Debit entry No. (rule 89(3))', group: 'claim', type: 'text', read: 'Debit entry number in the electronic credit ledger for the amount claimed' },
  { key: 'debit_date',  label: 'Debit entry date', group: 'claim', type: 'date', read: 'Date of that debit entry' },
  ...heads('claimed', 'Amount claimed', 'claim', 'Refund claimed in RFD-01 under this head, in rupees'),

  { key: 'A', label: 'A. Turnover of inverted rated supply', group: 'formula', type: 'money', read: 'Turnover of inverted rated supply of goods and services for the period (Statement 1 of RFD-01)' },
  { key: 'B', label: 'B. Adjusted Total Turnover', group: 'formula', type: 'money', read: 'Adjusted Total Turnover for the period (Statement 1 / GSTR-3B 3.1(a)+(b))' },
  { key: 'C', label: 'C. Net ITC (inputs only)', group: 'formula', type: 'money', read: 'Net ITC: credit availed on inputs only during the period (Statement 1)' },
  { key: 'D', label: 'D. ITC on inputs and input services', group: 'formula', type: 'money', read: 'ITC availed on inputs and input services (no capital goods) during the period' },
  { key: 'E', label: 'E. Tax payable on inverted rated supply', group: 'formula', type: 'money', read: 'Tax payable on the inverted rated supply (Statement 1)' },

  { key: 'itc_4a',        label: 'ITC availed, GSTR-3B Table 4A(1) to 4A(5)', group: 'itc', type: 'money', read: 'Total ITC availed in GSTR-3B Table 4A(1) to 4A(5) for the period (all heads, excluding cess)' },
  { key: 'itc_services',  label: 'ITC on input services', group: 'itc', type: 'money', read: 'ITC on input services in the period' },
  { key: 'itc_capital',   label: 'ITC on capital goods', group: 'itc', type: 'money', read: 'ITC on capital goods in the period' },
  { key: 'itc_blocked',   label: 'Blocked / ineligible ITC (s.17(5), s.16(4))', group: 'itc', type: 'money', read: 'Credit blocked by section 17(5) or barred by section 16(4) included in Table 4A' },
  { key: 'itc_2b',        label: 'ITC on inputs as per GSTR-2B', group: 'itc', type: 'money', read: 'ITC on inputs reflected in GSTR-2B for the period or earlier periods' },
  { key: 'exempt',        label: 'Exempt / nil-rated supplies (kept out of B)', group: 'itc', type: 'money', read: 'Value of exempt and nil-rated supplies in the period' },
  { key: 'zero_rated',    label: 'Exports and SEZ supplies (in B, not in A)', group: 'itc', type: 'money', read: 'Value of zero-rated supplies (exports, SEZ) in the period' },

  ...heads('end', 'Balance at end of period', 'ledger', 'Balance in the electronic credit ledger at the end of the tax period, this head'),
  ...heads('at_filing', 'Balance at filing', 'ledger', 'Balance in the electronic credit ledger at the time of filing RFD-01, this head'),

  { key: 'cess_C', label: 'Cess: Net ITC of cess on inputs', group: 'cess', type: 'money', read: 'Cess credit availed on inputs (only if cess is claimed)' },
  { key: 'cess_D', label: 'Cess: credit on inputs and input services', group: 'cess', type: 'money', read: 'Cess credit on inputs and input services (only if cess is claimed)' },
  { key: 'cess_E', label: 'Cess payable on inverted rated supply', group: 'cess', type: 'money', read: 'Cess payable on the inverted rated supply (only if cess is claimed)' },

  { key: 'risk',      label: 'System risk category', group: 'prov', type: 'choice', options: ['low-risk', 'not low-risk', 'barred'], read: 'Risk category shown by the system: low-risk, not low-risk, or barred (no Aadhaar authentication, notified goods)' },
  { key: 'rfd04_no',   label: 'RFD-04 No.', group: 'prov', type: 'text', read: 'Number of the provisional refund order in FORM GST RFD-04, if any' },
  { key: 'rfd04_date', label: 'RFD-04 date', group: 'prov', type: 'date', read: 'Date of RFD-04' },
  { key: 'rfd05_date', label: 'RFD-05 date (provisional payment)', group: 'prov', type: 'date', read: 'Date of the payment order RFD-05 for the provisional refund' },
  ...heads('prov', 'Provisional refund paid', 'prov', 'Provisional refund paid under this head, in rupees'),
]

export const FIELD = Object.fromEntries(FIELDS.map(f => [f.key, f]))

// Rate-wise tables (Tables 1 and 2 of the order)
export const INPUT_TYPES = ['input', 'input service', 'capital goods', 'blocked']
export const INPUT_COLS = [
  { key: 'hsn', label: 'HSN', type: 'text' }, { key: 'desc', label: 'Description', type: 'text' },
  { key: 'rate', label: 'Rate %', type: 'rate' }, { key: 'value', label: 'Taxable value', type: 'money' },
  { key: 'itc', label: 'ITC availed', type: 'money' }, { key: 'kind', label: 'Type', type: 'choice', options: INPUT_TYPES },
]
export const OUTPUT_COLS = [
  { key: 'hsn', label: 'HSN', type: 'text' }, { key: 'desc', label: 'Description', type: 'text' },
  { key: 'rate', label: 'Rate %', type: 'rate' }, { key: 'value', label: 'Taxable value', type: 'money' },
  { key: 'tax', label: 'Tax', type: 'money' }, { key: 'inverted', label: 'Inverted?', type: 'choice', options: ['yes', 'no: rate not lower', 'no: zero-rated', 'no: exempt', 'no: excluded by notification'] },
]

// What the officer confirms by hand: things no document read can settle (template paras 4 and 9)
export const CONFIRMS = [
  { key: 'returns',     text: 'All GSTR-1 and GSTR-3B returns due up to the date of the application are filed', law: 'para 6 of Circular 125/44/2019-GST' },
  { key: 'undertaking', text: 'The undertaking about section 16(2)(c) is filed online', law: 'para 2.4 of Circular 197/09/2023-GST' },
  { key: 'no_overlap',  text: 'Back-office refund history shows no other claim for this period in any category', law: 'Circular 125/44/2019-GST' },
  { key: 'notification', text: 'The outward supplies are not in Notification 5/2017-CT(R) (goods) or 15/2017-CT(R) (services), as amended', law: 'first proviso to s.54(3)(ii)' },
  { key: 'same_goods',  text: 'Inputs and outputs are not the same goods with a rate change over time (or a concessional rate notification applies)', law: 'paras 3.2 and 3.3 of Circular 135/05/2020-GST as substituted by Circular 173/05/2022-GST' },
  { key: 'gstr2b',      text: 'Credit taken is in GSTR-2B of the period or an earlier period; no s.17(5) or s.16(4) credit included', law: 'para 1.3 of Circular 197/09/2023-GST' },
  { key: 'suppliers',   text: 'Supplier risk checked (large suppliers, cancelled or non-filing suppliers, DIGIT)', law: 'refund SOP' },
  { key: 'dues',        text: 'No confirmed dues not stayed (or they are adjusted / withheld in para 9.2)', law: 's.54(10) and 54(11)' },
  { key: 'bank',        text: 'Bank account in RFD-01 is in the registration and validated on the portal', law: 'rule 92(4)' },
  { key: 'aadhaar',     text: 'Aadhaar authentication under rule 10B done', law: 'rule 10B; Notification 14/2025-CT' },
]

export const emptyCase = () => ({
  v: { return_type: 'monthly' },   // field values
  src: {},                          // where each value came from ("GSTR-3B p.2")
  alt: {},                          // a different figure for the same field in another document
  edited: {},                       // figures the officer corrected: what was read, and from where
  inputs: [],                       // Table 1 rows
  outputs: [],                      // Table 2 rows
  confirm: {},                      // officer's ticks
  notice: { no: '', date: '', reply: '', hearing: '', attended: '' },   // RFD-08, RFD-09 and hearing
  grounds: [],                      // [{ text, amount, reply, verified, finding, outcome }]
  order: { no: '', date: '', rfn: '', range: '', dues: '' },   // dues: date s.54(10) dues were checked
})
