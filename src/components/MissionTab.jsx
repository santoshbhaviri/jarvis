// src/components/MissionTab.jsx
import { useMemo } from 'react'
import SectionHeader from './SectionHeader'
import TaskCard      from './TaskCard'
import styles        from './TabShared.module.css'

export default function MissionTab({ catFilter, taskData }) {
  const { tasks, isCompletedToday, isFinishedEarlier, toggleDailyComplete, updateNotes, extendTask } = taskData

  const missionTasks = useMemo(() => {
    return tasks
      .filter(t =>
        t.status === 'mission' &&
      !isFinishedEarlier(t) &&
        (catFilter === 'all' || t.category === catFilter)
      )
      .slice()  // don't mutate original array
      .sort((a, b) => {
        // Closest deadline first; no due_date goes to end
        if (!a.due_date && !b.due_date) return 0
        if (!a.due_date) return 1
        if (!b.due_date) return -1
        return a.due_date.localeCompare(b.due_date)
      })
  }, [tasks, catFilter, isFinishedEarlier])

  const pending   = missionTasks.filter(t => !isCompletedToday(t.id))
  const completed = missionTasks.filter(t =>  isCompletedToday(t.id))

  // FIX: wrap extendTask to always pass deletePrevious=true for Mission
  // This deletes the original task and creates a fresh one with the new date
  const extendMissionTask = (task, newDate) => extendTask(task, newDate, true)

  if (!missionTasks.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🎯</div>
      <p>No missions yet. Add them in Task Master.</p>
    </div>
  )

  return (
    <div>
      <SectionHeader label="Pending" count={pending.length} accent="#8b5cf6" />
      <div className={styles.list}>
        {pending.map(t => (
          <TaskCard key={t.id} task={t}
            completed={false}
            onToggleComplete={toggleDailyComplete}
            onEditNotes={updateNotes}
            onExtend={extendMissionTask}
            showExtend={true}
            showDueDate={true}
          />
        ))}
        {pending.length === 0 && (
          <p className={styles.noneMsg}>All missions accomplished! 🎯</p>
        )}
      </div>

      {completed.length > 0 && (
        <>
          <SectionHeader label="Completed Today" count={completed.length} accent="#22c55e" />
          <div className={styles.list}>
            {completed.map(t => (
              <TaskCard key={t.id} task={t}
                completed={true}
                onToggleComplete={toggleDailyComplete}
                onEditNotes={updateNotes}
                onExtend={extendMissionTask}
                showExtend={false}
                showDueDate={true}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
