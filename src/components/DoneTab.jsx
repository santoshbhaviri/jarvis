// src/components/DoneTab.jsx
// The Done bin: every task finished in the last 30 days, grouped by day.
// Older ones are deleted automatically (see BIN_DAYS in useTasks).
import { useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { todayStr } from '../lib/dateUtils'
import { doneDay, BIN_DAYS } from '../hooks/useTasks'
import SectionHeader from './SectionHeader'
import styles        from './DoneTab.module.css'

export default function DoneTab({ taskData }) {
  const { tasks, restoreTask, deleteTask } = taskData
  const [armed, setArmed] = useState(null)   // id waiting for a second tap to delete
  const today = todayStr()

  const finished = tasks
    .filter(t => t.status !== 'routine' && t.completed_at)
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))

  const byDay = finished.reduce((acc, t) => {
    const d = doneDay(t); (acc[d] ||= []).push(t); return acc
  }, {})

  const label = (d) => {
    const n = differenceInCalendarDays(parseISO(today), parseISO(d))
    return n === 0 ? 'Today' : n === 1 ? 'Yesterday' : format(parseISO(d), 'EEEE d MMM')
  }

  const restore = async (t) => {
    const { error } = await restoreTask(t)
    if (error) toast.error('Could not restore')
    else toast.success('Moved back to today')
  }
  const remove = async (t) => {
    if (armed !== t.id) { setArmed(t.id); return }
    const { error } = await deleteTask(t.id)
    setArmed(null)
    if (error) toast.error('Could not delete')
  }

  if (!finished.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>✅</div>
      <p>Tasks you finish show up here for {BIN_DAYS} days, then they are deleted automatically.</p>
    </div>
  )

  return (
    <div>
      <p className={styles.intro}>
        {finished.length} task{finished.length > 1 ? 's' : ''} finished in the last {BIN_DAYS} days.
        Each is deleted automatically {BIN_DAYS} days after you finish it.
      </p>
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <SectionHeader label={label(day)} count={list.length} accent="#22c55e" />
          <ul className={styles.list}>
            {list.map(t => {
              const left = BIN_DAYS - differenceInCalendarDays(new Date(), new Date(t.completed_at))
              return (
                <li key={t.id} className={styles.item}>
                  <span className={styles.tick}>✓</span>
                  <div className={styles.body}>
                    <span className={styles.title}>{t.title}</span>
                    <span className={styles.meta}>
                      Done {format(new Date(t.completed_at), 'h:mm a')}
                      {t.postponed > 0 && ` · carried over ${t.postponed} day${t.postponed > 1 ? 's' : ''}`}
                      {` · deleted in ${Math.max(left, 0)} day${left === 1 ? '' : 's'}`}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={() => restore(t)} title="Not done after all: move it back to today">↩ Restore</button>
                    <button className={`${styles.btn} ${styles.del} ${armed === t.id ? styles.armed : ''}`}
                      onClick={() => remove(t)}
                      onBlur={() => setArmed(a => a === t.id ? null : a)}>
                      {armed === t.id ? 'Delete now?' : '🗑'}
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
