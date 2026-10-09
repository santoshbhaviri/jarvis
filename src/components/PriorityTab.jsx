// src/components/PriorityTab.jsx
// Eisenhower grid: every open scut-work and mission task by importance and urgency
import { QUADRANTS, quadrantOf } from '../lib/constants'
import { openTasks, byPriority } from '../lib/selectors'
import TaskCard from './TaskCard'
import styles   from './PriorityTab.module.css'

export default function PriorityTab({ catFilter, taskData }) {
  const { tasks, toggleDailyComplete, updateNotes, extendTask } = taskData
  const open = openTasks(tasks.filter(t => catFilter === 'all' || t.category === catFilter))

  return (
    <div>
      <p className={styles.intro}>Use ⚙︎ on a task to mark it Important or Urgent. Spend most of your time in <b>Do now</b> and <b>Schedule</b>.</p>
      <div className={styles.grid}>
        {[1, 2, 3, 4].map(q => {
          const items = open.filter(t => quadrantOf(t) === q).sort(byPriority)
          return (
            <section key={q} className={styles.quad} style={{ '--q': QUADRANTS[q].color }}>
              <header className={styles.qHead}>
                <span className={styles.qDot} />
                <h3 className={styles.qTitle}>{QUADRANTS[q].label}</h3>
                <span className={styles.qCount}>{items.length}</span>
              </header>
              <p className={styles.qSub}>{QUADRANTS[q].sub}</p>
              <div className={styles.list}>
                {items.map(t => (
                  <TaskCard key={t.id} task={t}
                    onToggleComplete={toggleDailyComplete}
                    onEditNotes={updateNotes}
                    onExtend={(task, d) => extendTask(task, d, task.status === 'mission')}
                    showExtend={true}
                    showDueDate={true}
                  />
                ))}
                {items.length === 0 && <p className={styles.none}>Empty</p>}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
