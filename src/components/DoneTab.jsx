// src/components/DoneTab.jsx
// The Done bin: every task finished in the last 30 days, grouped by day.
// Older ones are deleted automatically (see BIN_DAYS in useTasks).
import { useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import { Check, CircleCheck, RotateCcw, Trash2 } from 'lucide-react'
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
      <CircleCheck size={40} className={styles.emptyIcon} />
      <p>Finished tasks stay here for {BIN_DAYS} days.</p>
    </div>
  )

  return (
    <div>
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <SectionHeader label={label(day)} count={list.length} accent="var(--done)" />
          <ul className={styles.list}>
            {list.map(t => {
              return (
                <li key={t.id} className={styles.item}>
                  <span className={styles.tick}><Check size={14} /></span>
                  <div className={styles.body}>
                    <span className={styles.title}>{t.title}</span>
                    <span className={styles.meta}>
                      {format(new Date(t.completed_at), 'h:mm a')}
                    </span>
                  </div>
                  <div className={styles.actions}>
                    <button className={styles.btn} onClick={() => restore(t)} title="Move back to today"><RotateCcw size={14} />Restore</button>
                    <button className={`${styles.btn} ${styles.del} ${armed === t.id ? styles.armed : ''}`}
                      onClick={() => remove(t)}
                      onBlur={() => setArmed(a => a === t.id ? null : a)}>
                      {armed === t.id ? 'Delete?' : <Trash2 size={15} aria-label="Delete" />}
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
