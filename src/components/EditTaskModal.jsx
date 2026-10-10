// src/components/EditTaskModal.jsx
// Edit one task (title, day, highlight, notes) or one habit (title, weekly goal)
import { useState } from 'react'
import toast from 'react-hot-toast'
import { X, Star, Briefcase, House, Trash2 } from 'lucide-react'
import { todayStr } from '../lib/dateUtils'
import styles from './EditTaskModal.module.css'

export default function EditTaskModal({ task, onClose, onSave, onDelete }) {
  const isHabit = task.status === 'routine'
  const [row, setRow] = useState({
    title:           task.title,
    category:        task.category,
    due_date:        task.due_date || todayStr(),
    notes:           task.notes || '',
    important:       !!task.important,
    target_per_week: task.target_per_week || '',
  })
  const [saving, setSaving]         = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const set = (f, v) => setRow(prev => ({ ...prev, [f]: v }))

  const handleSave = async () => {
    if (!row.title.trim()) { toast.error('Title is required'); return }
    setSaving(true)
    const patch = isHabit
      ? { title: row.title.trim(), target_per_week: Number(row.target_per_week) || null }
      : {
          title:     row.title.trim(),
          category:  row.category,
          due_date:  row.due_date || todayStr(),
          notes:     row.notes.trim() || null,
          important: row.important,
        }
    const { error } = await onSave(task.id, patch)
    setSaving(false)
    if (error) toast.error(`Save failed: ${error.message}`)
    else { toast.success('Saved'); onClose() }
  }

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return }
    const { error } = await onDelete(task.id)
    if (error) toast.error('Could not delete')
    else { toast.success(isHabit ? 'Habit deleted' : 'Task deleted'); onClose() }
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="edit-title">
        <div className={styles.header}>
          <div>
            <h2 className={styles.title} id="edit-title">{isHabit ? 'Edit habit' : 'Edit task'}</h2>
            {!isHabit && task.postponed > 0 && (
              <p className={styles.sub}>Carried over {task.postponed} day{task.postponed > 1 ? 's' : ''} so far</p>
            )}
          </div>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        <div className={styles.body}>
          <div className={`${styles.row} ${styles.rowFilled}`}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="e-title">{isHabit ? 'Habit' : 'Task'}</label>
              <input id="e-title" className={styles.input} value={row.title} onChange={e => set('title', e.target.value)} />
            </div>

            {isHabit ? (
              <div className={styles.field}>
                <label className={styles.label}>Goal</label>
                <div className={styles.segmented}>
                  {[['', 'Every day'], ...[1, 2, 3, 4, 5, 6].map(n => [n, `${n}× a week`])].map(([v, l]) => (
                    <button key={l} type="button"
                      className={`${styles.seg} ${String(row.target_per_week) === String(v) ? styles.segActive : ''}`}
                      onClick={() => set('target_per_week', v)}
                    >{l}</button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.rowLine2}>
                  <div className={styles.field}>
                    <label className={styles.label} htmlFor="e-date">Day</label>
                    <input id="e-date" type="date" className={styles.input} value={row.due_date}
                      min={todayStr()} onChange={e => set('due_date', e.target.value)} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>Highlight</label>
                    <div className={styles.segmented}>
                      <button type="button" aria-pressed={row.important}
                        className={`${styles.seg} ${row.important ? styles.segActive : ''}`}
                        onClick={() => set('important', !row.important)}
                      ><Star size={14} />Important</button>
                    </div>
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Category</label>
                  <div className={styles.segmented}>
                    {[['work', 'Work', Briefcase], ['personal', 'Personal', House]].map(([v, l, Icon]) => (
                      <button key={v} type="button"
                        className={`${styles.seg} ${row.category === v ? styles.segActive : ''}`}
                        onClick={() => set('category', v)}
                      ><Icon size={14} />{l}</button>
                    ))}
                  </div>
                </div>
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="e-notes">Notes</label>
                  <input id="e-notes" className={styles.input} value={row.notes}
                    onChange={e => set('notes', e.target.value)} placeholder="Any notes…" />
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <button className={styles.cancelBtn} onClick={handleDelete}
            style={confirmDel ? { color: 'var(--danger)', borderColor: 'var(--danger)' } : undefined}>
            {confirmDel ? 'Tap again to delete' : <><Trash2 size={15} />Delete</>}
          </button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
