// src/components/EditTaskModal.jsx
// Edit every field of one task: title, category, status, dates, priority, follow-up, notes
import { useState } from 'react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import TaskExtraFields from './TaskExtraFields'
import styles from './AddTaskModal.module.css'

export default function EditTaskModal({ task, onClose, onSave, onDelete }) {
  const [row, setRow] = useState({
    title:      task.title,
    category:   task.category,
    status:     task.status,
    due_date:   task.due_date   || '',
    notes:      task.notes      || '',
    important:  !!task.important,
    urgent:     !!task.urgent,
    waiting_on: task.waiting_on || '',
    follow_up:  task.follow_up  || '',
  })
  const [saving, setSaving]       = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (f, v) => setRow(prev => ({ ...prev, [f]: v }))
  const needsDue = row.status !== 'routine'

  const handleSave = async () => {
    if (!row.title.trim()) { toast.error('Title is required'); return }
    if (needsDue && !row.due_date) { toast.error('Pick a due date for this status'); return }
    setSaving(true)
    const waiting = row.waiting_on.trim()
    const patch = {
      title:      row.title.trim(),
      category:   row.category,
      status:     row.status,
      due_date:   needsDue ? row.due_date : null,
      notes:      row.notes.trim() || null,
      important:  row.important,
      urgent:     row.urgent,
      waiting_on: waiting || null,
      follow_up:  waiting ? (row.follow_up || format(addDays(new Date(), 2), 'yyyy-MM-dd')) : null,
    }
    // Moving the date later counts as postponing
    if (task.due_date && patch.due_date && patch.due_date > task.due_date) {
      patch.postponed = (task.postponed || 0) + 1
    }
    const { error } = await onSave(task.id, patch)
    setSaving(false)
    if (error) toast.error(`Save failed: ${error.message}`)
    else { toast.success('Task updated'); onClose() }
  }

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    const { error } = await onDelete(task.id)
    if (error) toast.error('Could not delete')
    else { toast.success('Task deleted'); onClose() }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Edit Task</h2>
            <p className={styles.sub}>Postponed {task.postponed || 0}× so far</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className={styles.body}>
          <div className={`${styles.row} ${styles.rowFilled}`}>
            <div className={styles.field}>
              <label className={styles.label}>Title</label>
              <input className={styles.input} value={row.title} onChange={e => set('title', e.target.value)} autoFocus />
            </div>

            <div className={styles.rowLine2}>
              <div className={styles.field}>
                <label className={styles.label}>Category</label>
                <div className={styles.segmented}>
                  {[['work','💼 Work'],['personal','🏠 Personal']].map(([v, l]) => (
                    <button key={v} type="button"
                      className={`${styles.seg} ${row.category === v ? styles.segActive : ''}`}
                      onClick={() => set('category', v)}
                    >{l}</button>
                  ))}
                </div>
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Status</label>
                <div className={styles.segmented}>
                  {[['routine','🔁 Routine'],['scut-work','⚙️ Scut'],['mission','🎯 Mission']].map(([v, l]) => (
                    <button key={v} type="button"
                      className={`${styles.seg} ${row.status === v ? styles.segActive : ''}`}
                      onClick={() => set('status', v)}
                    >{l}</button>
                  ))}
                </div>
              </div>
            </div>

            <TaskExtraFields row={row} onChange={set} />

            <div className={styles.rowLine3}>
              <div className={styles.field}>
                <label className={styles.label}>Due Date</label>
                <input type="date" className={styles.input} value={row.due_date}
                  onChange={e => set('due_date', e.target.value)} disabled={!needsDue} />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Notes</label>
                <input className={styles.input} value={row.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes…" />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleDelete}
            style={confirmDel ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}>
            {confirmDel ? 'Tap again to delete' : '🗑 Delete'}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
