// src/components/TodayTab.jsx
// The day's plan: what to do today (unfinished tasks carry over by themselves),
// what got done, and anything already planned for later days.
import { useState } from 'react'
import { format } from 'date-fns'
import { todayStr } from '../lib/dateUtils'
import { doneDay } from '../hooks/useTasks'
import SectionHeader from './SectionHeader'
import TaskRow       from './TaskRow'
import styles        from './TodayTab.module.css'

export default function TodayTab({ taskData, onEdit }) {
  const { tasks, setDone, updateTask } = taskData
  const [showLater, setShowLater] = useState(true)
  const today    = todayStr()

  const mine  = tasks.filter(t => t.status !== 'routine')
  // Highlighted first, then carried-over, then in the order they were added
  const order = (a, b) => (b.important - a.important) || ((b.is_unfinished ? 1 : 0) - (a.is_unfinished ? 1 : 0))
  const todo  = mine.filter(t => !t.completed_at && t.due_date <= today).sort(order)
  const done  = mine.filter(t => t.completed_at && doneDay(t) === today)
  const later = mine.filter(t => !t.completed_at && t.due_date > today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))

  const total = todo.length + done.length
  const pct   = total ? Math.round(done.length * 100 / total) : 0
  const star  = (t) => updateTask(t.id, { important: !t.important })
  const rowProps = { onToggle: setDone, onStar: star, onEdit }

  return (
    <div>
      <div className={styles.dayCard}>
        <div className={styles.dayTop}>
          <div>
            <div className={styles.dayName}>{format(new Date(), 'EEEE')}</div>
            <div className={styles.dayDate}>{format(new Date(), 'd MMMM yyyy')}</div>
          </div>
          <div className={styles.score}>
            <span className={styles.scoreN}>{done.length}<small>/{total}</small></span>
            <span className={styles.scoreL}>done</span>
          </div>
        </div>
        <div className={styles.bar} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      <SectionHeader label="To do" count={todo.length} accent="var(--accent)" />
      <div className={styles.list}>
        {todo.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
        {todo.length === 0 && total > 0 && <p className={styles.none}>All done for today. 🎉</p>}
        {total === 0 && <p className={styles.none}>Nothing planned. Tap the Jarvis button to add.</p>}
      </div>

      {done.length > 0 && (
        <>
          <SectionHeader label="Done" count={done.length} accent="var(--done)" />
          <div className={styles.list}>
            {done.map(t => <TaskRow key={t.id} task={t} done {...rowProps} />)}
          </div>
        </>
      )}

      {later.length > 0 && (
        <>
          <button className={styles.laterToggle} onClick={() => setShowLater(s => !s)} aria-expanded={showLater}>
            <SectionHeader label="Later" count={later.length} accent="var(--text3)" />
          </button>
          {showLater && (
            <div className={styles.list}>
              {later.map(t => (
                <TaskRow key={t.id} task={t} showDate {...rowProps} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
