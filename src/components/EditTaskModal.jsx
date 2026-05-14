// src/components/EditTaskModal.jsx
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './EditTaskModal.module.css'
import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants'

export default function EditTaskModal({ task, onClose, onSave }) {
  const [form, setForm]     = useState({ ...task })
  const [saving, setSaving] = useState(false)

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const { error } = await onSave(task.id, form)
    setSaving(false)
    if (error) { toast.error('Could not update task'); return }
    toast.success('Task updated!')
    onClose()
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>

        <div className={styles.header}>
          <h2 className={styles.title}>Edit Task</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <label className={styles.label}>Task Title *</label>
          <input
            className={styles.input}
            placeholder="What needs to be done?"
            value={form.title}
            onChange={e => set('title', e.target.value)}
            autoFocus
          />

          <div className={styles.row2}>
            <div>
              <label className={styles.label}>Category</label>
              <select className={styles.select} value={form.category} onChange={e => set('category', e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
              </select>
            </div>
            <div>
              <label className={styles.label}>Priority</label>
              <select className={styles.select} value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
          </div>

          <label className={styles.label}>Status</label>
          <select className={styles.select} value={form.status} onChange={e => set('status', e.target.value)}>
            {Object.entries(STATUSES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
          </select>

          <div className={styles.row2}>
            <div>
              <label className={styles.label}>Due Date</label>
              <input className={styles.input} type="date" value={form.due_date ?? ''} onChange={e => set('due_date', e.target.value)} />
            </div>
            <div>
              <label className={styles.label}>Follow-up Date</label>
              <input className={styles.input} type="date" value={form.followup_date ?? ''} onChange={e => set('followup_date', e.target.value)} />
            </div>
          </div>

          <label className={styles.label}>Notes</label>
          <textarea
            className={styles.textarea}
            placeholder="Any context, reminders, or details…"
            value={form.notes ?? ''}
            onChange={e => set('notes', e.target.value)}
          />
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
