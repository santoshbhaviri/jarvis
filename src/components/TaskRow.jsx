// src/components/TaskRow.jsx
// One task in the Today list: tick it off, star it, open it to edit
import { format, parseISO } from 'date-fns'
import styles from './TaskRow.module.css'

export default function TaskRow({ task, done = false, showDate = false, onToggle, onStar, onEdit }) {
  const carried = !done && task.is_unfinished && task.postponed > 0
  const [first, ...more] = (task.notes || '').split('\n')
  const repeat = first.startsWith('↻ ') ? first : null
  const note = (repeat ? more.join('\n') : task.notes || '').trim()
  const waiting = !done && task.follow_up ? `⏳ ${task.waiting_on || 'Follow up'}` : null
  const hasMeta = (showDate && task.due_date) || carried || repeat || note || waiting
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
            {repeat && <span className={styles.chip}>{repeat}</span>}
            {waiting && <span className={styles.chip}>{waiting}</span>}
            {note && <span className={styles.chip}>📝 {note}</span>}
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
