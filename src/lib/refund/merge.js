// Refund Desk: what Claude read from one document, added to the case. The first document to give
// a figure fills it, with its source ("GSTR-3B July 2026 p.2"); a different figure for the same
// field from another document is kept beside it as "also found", for the officer to choose.
// Never overwrites what the officer typed.
import { FIELD, TABLES } from './fields.js'
import { num } from './compute.js'

const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 }
const pad = (n) => String(n).padStart(2, '0')

export function parseDate(s) {
  s = String(s || '').trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s)
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s)   // Indian order: day first
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s,-]+(\d{4})$/.exec(s)
  if (m && MON[m[2].toLowerCase()]) return `${m[3]}-${pad(MON[m[2].toLowerCase()])}-${pad(m[1])}`
  return ''
}

export function parseMonth(s) {
  s = String(s || '').trim()
  let m = /^(\d{4})-(\d{1,2})(?:-\d{1,2})?$/.exec(s)
  if (m) return `${m[1]}-${pad(m[2])}`
  m = /^([A-Za-z]{3})[A-Za-z]*[\s,'-]+(\d{4})$/.exec(s)
  if (m && MON[m[1].toLowerCase()]) return `${m[2]}-${pad(MON[m[1].toLowerCase()])}`
  m = /^(\d{1,2})[/-](\d{4})$/.exec(s) || /^(\d{2})(\d{4})$/.exec(s)   // 07/2026, 072026 (portal style)
  if (m) return `${m[2]}-${pad(m[1])}`
  return ''
}

export function parseValue(f, raw) {
  if (raw === null || raw === undefined || String(raw).trim() === '') return null
  if (f.type === 'money' || f.type === 'rate') return num(String(raw).replace(/%/g, ''))
  if (f.type === 'date') return parseDate(raw) || null
  if (f.type === 'month') return parseMonth(raw) || null
  if (f.type === 'choice') { const x = String(raw).trim().toLowerCase(); return f.options.includes(x) ? x : null }
  return String(raw).trim()
}

const same = (a, b) => typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1 : String(a) === String(b)
// One row of a table, each cell parsed by its column's type (amounts as numbers, dates ISO)
const parseRow = (row, cols) => Object.fromEntries(cols.map(col => {
  const x = parseValue(col, row[col.key])
  return [col.key, x ?? '']
}))

// c: the case; read: { kind, fields, rows: { tableKey: [...] } } from the server; doc: the file's name
export function mergeRead(c, read, doc) {
  const next = { ...c, v: { ...c.v }, src: { ...c.src }, alt: { ...(c.alt || {}) }, rows: { ...(c.rows || {}) } }
  const kind = (read.kind || doc || 'document').trim()
  let added = 0
  for (const x of read.fields || []) {
    const f = FIELD[x.key]
    if (!f) continue
    const value = parseValue(f, x.value)
    if (value === null) continue
    const src = `${kind}${x.page ? ` p.${x.page}` : ''}`
    const have = next.v[x.key]
    if (have === undefined || have === null || have === '' || (x.key === 'return_type' && !next.src.return_type)) {
      next.v[x.key] = value; next.src[x.key] = src; added++
    } else if (!same(have, value) && !(next.alt[x.key] || []).some(a => same(a.value, value))) {
      next.alt[x.key] = [...(next.alt[x.key] || []), { value, src }]
    }
  }
  // A table is filled from the first document that lists its lines; later documents do not add to it
  for (const [key, list] of Object.entries(read.rows || {})) {
    const t = TABLES[key]
    if (!t || !t.cats.includes(c.cat || 'T1') || next.rows[key]?.length || !list?.length) continue
    next.rows[key] = list.map(r => parseRow(r, t.cols))
    next.src[`rows.${key}`] = kind
    added += list.length
  }
  // An earlier notice or order on the claim: its grounds start the case's grounds (only when there
  // are none yet), and its notice number and date fill the notice where blank
  const grounds = (read.grounds || []).filter(g => String(g?.text || '').trim())
  if (grounds.length && !(next.grounds || []).length) {
    next.grounds = grounds.map(g => ({ title: String(g.title || '').trim(), text: String(g.text).trim(), amount: num(g.amount) ?? '', from: kind }))
    added += grounds.length
  }
  if (read.notice) {
    const n = { ...(next.notice || {}) }
    if (!n.no && read.notice.no) n.no = String(read.notice.no).trim()
    if (!n.date && read.notice.date) n.date = parseDate(read.notice.date)
    next.notice = n
  }
  return { c: next, added, kind }
}
