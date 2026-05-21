// src/components/AddTaskModal.jsx
import { useState } from 'react'
import toast from 'react-hot-toast'
import { EMPTY_FORM } from '../lib/constants'
import styles from './AddTaskModal.module.css'

const makeRow = () => ({ ...EMPTY_FORM, _id: Math.random() })
const makeRows = (n) => Array.from({ length: n }, makeRow)

function needsDue(status) {
  return status === 'scut-work' || status === 'mission'
}

function validateRow(row) {
  const e = {}
  if (!row.title.trim()) e.title    = 'Required'
  if (!row.category)     e.category = 'Required'
  if (!row.status)       e.status   = 'Required'
  if (needsDue(row.status) && !row.due_date) e.due_date = 'Required for this status'
  return e
}

export default function AddTaskModal({ onClose, onSave, onSaveBulk }) {
  const [rows, setRows]     = useState(makeRows(5))
  const [errors, setErrors] = useState([])
  const [saving, setSaving] = useState(false)

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r))
    setErrors(prev => {
      const next = [...prev]
      if (next[idx]) next[idx] = { ...next[idx], [field]: undefined }
      return next
    })
  }

  const addRow = () => setRows(prev => [...prev, makeRow()])

  const removeRow = (idx) => {
    if (rows.length <= 1) return
    setRows(prev => prev.filter((_, i) => i !== idx))
    setErrors(prev => prev.filter((_, i) => i !== idx))
  }

  const filledRows = rows.filter(r => r.title.trim())

  const handleSave = async () => {
    if (!filledRows.length) {
      toast.error('Enter at least one task title')
      return
    }

    // Validate filled rows
    const newErrors = rows.map(() => ({}))
    let hasError = false
    rows.forEach((row, idx) => {
      if (!row.title.trim()) return
      const e = validateRow(row)
      if (Object.keys(e).length) { newErrors[idx] = e; hasError = true }
    })
    if (hasError) { setErrors(newErrors); return }

    setSaving(true)

    const payloads = filledRows.map(row => ({
      title:    row.title.trim(),
      category: row.category,
      status:   row.status,
      due_date: needsDue(row.status) ? (row.due_date || null) : null,
      notes:    row.notes.trim() || null,
    }))

    let saveError = null

    try {
      if (onSaveBulk && payloads.length >= 1) {
        // Always use bulk path — handles both single and multiple
        const result = await onSaveBulk(payloads)
        if (result.error) saveError = result.error
      } else if (onSave) {
        // Fallback: sequential single inserts
        for (const payload of payloads) {
          const result = await onSave(payload)
          if (result.error) { saveError = result.error; break }
        }
      } else {
        saveError = { message: 'No save handler provided — check App.jsx' }
      }
    } catch (err) {
      console.error('AddTaskModal unexpected error:', err)
      saveError = { message: err.message || 'Unexpected error' }
    }

    setSaving(false)

    if (saveError) {
      // FIX: show the actual error message so you can diagnose it
      const msg = saveError.message || saveError.details || JSON.stringify(saveError)
      console.error('Save error details:', saveError)
      toast.error(`Save failed: ${msg}`, { duration: 6000 })
    } else {
      toast.success(`${payloads.length} task${payloads.length > 1 ? 's' : ''} added!`)
      onClose()
    }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Add Tasks</h2>
            <p className={styles.sub}>Fill rows below — blank rows are skipped automatically</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          {rows.map((row, idx) => (
            <TaskRow
              key={row._id}
              row={row}
              idx={idx}
              errors={errors[idx] || {}}
              total={rows.length}
              onChange={(field, value) => updateRow(idx, field, value)}
              onRemove={() => removeRow(idx)}
            />
          ))}
          <button className={styles.addRowBtn} onClick={addRow}>
            + Add another row
          </button>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            className={styles.saveBtn}
            onClick={handleSave}
            disabled={saving || !filledRows.length}
          >
            {saving
              ? 'Saving…'
              : `Save ${filledRows.length > 0 ? filledRows.length : ''} Task${filledRows.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Single task row ────────────────────────────────────────────
function TaskRow({ row, idx, errors, total, onChange, onRemove }) {
  const hasDue = needsDue(row.status)
  const filled = row.title.trim().length > 0

  return (
    <div className={`${styles.row} ${filled ? styles.rowFilled : ''}`}>

      <div className={styles.rowHeader}>
        <span className={styles.rowNum}>{idx + 1}</span>
        {total > 1 && (
          <button className={styles.removeBtn} onClick={onRemove} title="Remove row">✕</button>
        )}
      </div>

      {/* Title */}
      <div className={styles.field}>
        <label className={styles.label}>Title <span className={styles.req}>*</span></label>
        <input
          className={`${styles.input} ${errors.title ? styles.inputErr : ''}`}
          placeholder="What needs to be done?"
          value={row.title}
          onChange={e => onChange('title', e.target.value)}
          autoFocus={idx === 0}
        />
        {errors.title && <span className={styles.err}>{errors.title}</span>}
      </div>

      {/* Category + Status */}
      <div className={styles.rowLine2}>
        <div className={styles.field}>
          <label className={styles.label}>Category <span className={styles.req}>*</span></label>
          <div className={styles.segmented}>
            {[['work','💼 Work'],['personal','🏠 Personal']].map(([v, l]) => (
              <button key={v} type="button"
                className={`${styles.seg} ${row.category === v ? styles.segActive : ''}`}
                onClick={() => onChange('category', v)}
              >{l}</button>
            ))}
          </div>
          {errors.category && <span className={styles.err}>{errors.category}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Status <span className={styles.req}>*</span></label>
          <div className={styles.segmented}>
            {[['routine','🔁 Routine'],['scut-work','⚙️ Scut'],['mission','🎯 Mission']].map(([v, l]) => (
              <button key={v} type="button"
                className={`${styles.seg} ${row.status === v ? styles.segActive : ''}`}
                onClick={() => onChange('status', v)}
              >{l}</button>
            ))}
          </div>
          {errors.status && <span className={styles.err}>{errors.status}</span>}
        </div>
      </div>

      {/* Due date + Notes */}
      <div className={styles.rowLine3}>
        <div className={styles.field}>
          <label className={styles.label}>
            Due Date {hasDue ? <span className={styles.req}>*</span> : <span className={styles.hint}>(N/A for Routine)</span>}
          </label>
          <input
            type="date"
            className={`${styles.input} ${errors.due_date ? styles.inputErr : ''}`}
            value={row.due_date}
            onChange={e => onChange('due_date', e.target.value)}
            disabled={!hasDue}
          />
          {errors.due_date && <span className={styles.err}>{errors.due_date}</span>}
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Notes <span className={styles.hint}>(optional)</span></label>
          <input
            className={styles.input}
            placeholder="Any notes…"
            value={row.notes}
            onChange={e => onChange('notes', e.target.value)}
          />
        </div>
      </div>
    </div>
  )
}
