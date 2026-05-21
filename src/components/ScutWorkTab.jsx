// src/components/ScutWorkTab.jsx
import { useMemo } from 'react'
import { todayStr } from '../lib/dateUtils'
import SectionHeader from './SectionHeader'
import TaskCard      from './TaskCard'
import styles        from './ScutWorkTab.module.css'

export default function ScutWorkTab({ catFilter, taskData }) {
  const { tasks, isCompletedToday, toggleDailyComplete, updateNotes, extendTask } = taskData
  const today = todayStr()

  const scutTasks = useMemo(() =>
    tasks.filter(t =>
      t.status === 'scut-work' &&
      (catFilter === 'all' || t.category === catFilter)
    ), [tasks, catFilter])

  // Pending: not completed AND (no due_date OR due_date <= today)
  // Unfinished tasks (auto-rolled over from previous days) sorted to TOP
  const pendingRaw = scutTasks.filter(t =>
    !isCompletedToday(t.id) &&
    (!t.due_date || t.due_date <= today)
  )
  const pending = [
    ...pendingRaw.filter(t => t.is_unfinished),   // unfinished first
    ...pendingRaw.filter(t => !t.is_unfinished),  // regular pending after
  ]

  // Completed today
  const completed = scutTasks.filter(t => isCompletedToday(t.id))

  // Scheduled: not completed AND due_date strictly in the future
  const scheduled = scutTasks.filter(t =>
    !isCompletedToday(t.id) &&
    t.due_date &&
    t.due_date > today
  )

  if (!scutTasks.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>⚙️</div>
      <p>No scut-work tasks yet. Add them in Task Master.</p>
    </div>
  )

  return (
    <div>
      {/* Pending */}
      <SectionHeader label="Pending" count={pending.length} accent="#f59e0b" />
      <div className={styles.list}>
        {pending.map(t => (
          <TaskCard key={t.id} task={t}
            completed={false}
            scheduled={false}
            onToggleComplete={toggleDailyComplete}
            onEditNotes={updateNotes}
            onExtend={extendTask}
            showExtend={true}
            showDueDate={true}
          />
        ))}
        {pending.length === 0 && <p className={styles.noneMsg}>All caught up! ✨</p>}
      </div>

      {/* Completed today */}
      {completed.length > 0 && (
        <>
          <SectionHeader label="Completed Today" count={completed.length} accent="#22c55e" />
          <div className={styles.list}>
            {completed.map(t => (
              <TaskCard key={t.id} task={t}
                completed={true}
                scheduled={false}
                onToggleComplete={toggleDailyComplete}
                onEditNotes={updateNotes}
                onExtend={extendTask}
                showExtend={false}
                showDueDate={true}
              />
            ))}
          </div>
        </>
      )}

      {/* Scheduled — faded */}
      {scheduled.length > 0 && (
        <>
          <SectionHeader label="Scheduled" count={scheduled.length} accent="#8b5cf6" />
          <div className={styles.list}>
            {scheduled.map(t => (
              <TaskCard key={t.id} task={t}
                completed={false}
                scheduled={true}
                onToggleComplete={toggleDailyComplete}
                onEditNotes={updateNotes}
                onExtend={extendTask}
                showExtend={true}
                showDueDate={true}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
