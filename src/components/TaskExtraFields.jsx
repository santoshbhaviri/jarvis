// src/components/TaskExtraFields.jsx
// Priority + follow-up fields, shared by AddTaskModal and EditTaskModal
import styles from './AddTaskModal.module.css'

export default function TaskExtraFields({ row, onChange }) {
  return (
    <>
      <div className={styles.field}>
        <label className={styles.label}>Priority <span className={styles.hint}>(decides the Priorities grid)</span></label>
        <div className={styles.segmented}>
          {[['important', '⭐ Important'], ['urgent', '⏰ Urgent']].map(([f, l]) => (
            <button key={f} type="button" aria-pressed={!!row[f]}
              className={`${styles.seg} ${row[f] ? styles.segActive : ''}`}
              onClick={() => onChange(f, !row[f])}
            >{l}</button>
          ))}
        </div>
      </div>

      <div className={styles.rowLine3}>
        <div className={styles.field}>
          <label className={styles.label}>Follow up with <span className={styles.hint}>(optional)</span></label>
          <input
            className={styles.input}
            placeholder="Person or office, e.g. Tahsildar"
            value={row.waiting_on || ''}
            onChange={e => onChange('waiting_on', e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>Follow-up date</label>
          <input
            type="date"
            className={styles.input}
            value={row.follow_up || ''}
            onChange={e => onChange('follow_up', e.target.value)}
            disabled={!row.waiting_on?.trim()}
          />
        </div>
      </div>
    </>
  )
}
