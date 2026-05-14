// src/components/BulkAddModal.jsx
// Desktop: spreadsheet-style table
// Mobile: stacked card rows (2-3 lines each) — no horizontal scrolling

import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './BulkAddModal.module.css'
import { CATEGORIES, PRIORITIES, STATUSES, EMPTY_TASK } from '../lib/constants'

const INITIAL_ROWS = 5

function makeRows(n) {
  return Array.from({ length: n }, () => ({ ...EMPTY_TASK, _id: Math.random() }))
}

export default function BulkAddModal({ onClose, onSave }) {
  const [rows, setRows]     = useState(makeRows(INITIAL_ROWS))
  const [saving, setSaving] = useState(false)

  const update = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
  }

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_TASK, _id: Math.random() }])

  const removeRow = (idx) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter((_, i) => i !== idx))
  }

  const validCount = rows.filter(r => r.title.trim()).length

  const handleSave = async () => {
    if (!validCount) { toast.error('Enter at least one task title'); return }
    setSaving(true)
    const { error } = await onSave(rows)
    setSaving(false)
    if (error) { toast.error(`Could not save: ${error}`); return }
    toast.success(`${validCount} task${validCount > 1 ? 's' : ''} added!`)
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div className={styles.mHeader}>
          <div>
            <h2 className={styles.mTitle}>Add New Tasks</h2>
            <p className={styles.mSub}>Fill rows below — blank rows are skipped</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── DESKTOP TABLE ── */}
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.th} style={{ width: 32 }}>#</th>
                <th className={styles.th}>Task Title *</th>
                <th className={styles.th}>Category</th>
                <th className={styles.th}>Priority</th>
                <th className={styles.th}>Status</th>
                <th className={styles.th}>Due Date</th>
                <th className={styles.th}>Follow-up</th>
                <th className={styles.th}>Notes</th>
                <th className={styles.th} style={{ width: 36 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row._id} className={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                  <td className={styles.td}>
                    <span className={styles.rowNum}>{i + 1}</span>
                  </td>
                  <td className={styles.td}>
                    <input
                      className={`${styles.tInput} ${row.title.trim() ? styles.filled : ''}`}
                      placeholder="Task title…"
                      value={row.title}
                      onChange={e => update(i, 'title', e.target.value)}
                    />
                  </td>
                  <td className={styles.td}>
                    <select className={styles.tSel} value={row.category} onChange={e => update(i, 'category', e.target.value)}>
                      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </td>
                  <td className={styles.td}>
                    <select className={styles.tSel} value={row.priority} onChange={e => update(i, 'priority', e.target.value)}>
                      <option value="high">🔴 High</option>
                      <option value="medium">🟡 Medium</option>
                      <option value="low">🟢 Low</option>
                    </select>
                  </td>
                  <td className={styles.td}>
                    <select className={styles.tSel} value={row.status} onChange={e => update(i, 'status', e.target.value)}>
                      {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                    </select>
                  </td>
                  <td className={styles.td}>
                    <input className={styles.tInput} type="date" value={row.due_date} onChange={e => update(i, 'due_date', e.target.value)} />
                  </td>
                  <td className={styles.td}>
                    <input className={styles.tInput} type="date" value={row.followup_date} onChange={e => update(i, 'followup_date', e.target.value)} />
                  </td>
                  <td className={styles.td}>
                    <input className={styles.tInput} placeholder="Notes…" value={row.notes} onChange={e => update(i, 'notes', e.target.value)} />
                  </td>
                  <td className={styles.td}>
                    <button className={styles.removeBtn} onClick={() => removeRow(i)} title="Remove row">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── MOBILE CARD ROWS ── */}
        <div className={styles.mobileRows}>
          {rows.map((row, i) => (
            <div key={row._id} className={styles.mRow}>
              <div className={styles.mRowHeader}>
                <span className={styles.rowNum}>{i + 1}</span>
                <button className={styles.removeBtn} onClick={() => removeRow(i)}>✕</button>
              </div>

              {/* Row 1: Title */}
              <input
                className={`${styles.mInput} ${row.title.trim() ? styles.filled : ''}`}
                placeholder="Task title *"
                value={row.title}
                onChange={e => update(i, 'title', e.target.value)}
              />

              {/* Row 2: Category + Priority + Status */}
              <div className={styles.mRow2}>
                <select className={styles.mSel} value={row.category} onChange={e => update(i, 'category', e.target.value)}>
                  {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
                <select className={styles.mSel} value={row.priority} onChange={e => update(i, 'priority', e.target.value)}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Med</option>
                  <option value="low">🟢 Low</option>
                </select>
                <select className={styles.mSel} value={row.status} onChange={e => update(i, 'status', e.target.value)}>
                  {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>

              {/* Row 3: Due + Follow-up dates */}
              <div className={styles.mRow2}>
                <div className={styles.mDateWrap}>
                  <label className={styles.mLabel}>Due Date</label>
                  <input className={styles.mInput} type="date" value={row.due_date} onChange={e => update(i, 'due_date', e.target.value)} />
                </div>
                <div className={styles.mDateWrap}>
                  <label className={styles.mLabel}>Follow-up</label>
                  <input className={styles.mInput} type="date" value={row.followup_date} onChange={e => update(i, 'followup_date', e.target.value)} />
                </div>
              </div>

              {/* Row 4 (optional): Notes */}
              <input
                className={styles.mInput}
                placeholder="Notes (optional)…"
                value={row.notes}
                onChange={e => update(i, 'notes', e.target.value)}
              />
            </div>
          ))}
        </div>

        {/* Add row + footer */}
        <button className={styles.addRowBtn} onClick={addRow}>+ Add another row</button>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving || !validCount}>
            {saving ? 'Saving…' : `Save ${validCount || ''} Task${validCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
