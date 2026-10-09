// src/components/TaskRow.jsx
// One task in the Today list: tick it off, star it, open it to edit
import { format, parseISO } from 'date-fns'
import styles from './TaskRow.module.css'

export default function TaskRow({ task, done = false, showDate = false, onToggle, onStar, onEdit }) {
  const carried = !done && task.is_unfinished && task.postponed > 0
  const hasMeta = (showDate && task.due_date) || carried || task.notes
  return (
    <div className={`${styles.row} ${done ? styles.done : ''} ${task.important && !done ? styles.important : ''}`}>
      <button
        className={`${styles.check} ${done ? styles.checked : ''}`}
        onClick={() => onToggle(task, !done)}
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
      >{done && '✓'}</button>

      <button className={styles.body} onClick={() => onEdit(task)}>
        <span className={styles.title}>{task.title}</span>
        {hasMeta && (
          <span className={styles.meta}>
            {showDate && task.due_date && <span className={styles.chip}>{format(parseISO(task.due_date), 'EEE d MMM')}</span>}
            {carried && <span className={`${styles.chip} ${styles.carried}`}>↪ {task.postponed} day{task.postponed > 1 ? 's' : ''}</span>}
            {task.notes && <span className={styles.chip}>📝 {task.notes}</span>}
          </span>
        )}
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
