// src/components/TaskRow.jsx
// One task in the Today list: tick it off, star it, open it to edit
import { formatDisplay } from '../lib/dateUtils'
import { CATEGORIES } from '../lib/constants'
import styles from './TaskRow.module.css'

export default function TaskRow({ task, done = false, showDate = false, onToggle, onStar, onEdit }) {
  const cat = CATEGORIES[task.category]
  return (
    <div className={`${styles.row} ${done ? styles.done : ''} ${task.important && !done ? styles.important : ''}`}>
      <button
        className={`${styles.check} ${done ? styles.checked : ''}`}
        onClick={() => onToggle(task, !done)}
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
      >{done && '✓'}</button>

      <button className={styles.body} onClick={() => onEdit(task)}>
        <span className={styles.title}>{task.title}</span>
        <span className={styles.meta}>
          {cat && <span className={styles.chip} style={{ color: cat.color }}>{cat.icon} {cat.label}</span>}
          {showDate && task.due_date && <span className={styles.chip}>📅 {formatDisplay(task.due_date)}</span>}
          {!done && task.is_unfinished && task.postponed > 0 && (
            <span className={`${styles.chip} ${styles.carried}`}>
              ↪ Carried over{task.postponed > 1 ? ` · ${task.postponed} days` : ''}
            </span>
          )}
          {task.notes && <span className={styles.chip}>📝 {task.notes}</span>}
        </span>
      </button>

      {!done && (
        <button
          className={`${styles.star} ${task.important ? styles.starOn : ''}`}
          onClick={() => onStar(task)}
          aria-pressed={!!task.important}
          title={task.important ? 'Remove highlight' : 'Highlight as important'}
        >{task.important ? '★' : '☆'}</button>
      )}
    </div>
  )
}
