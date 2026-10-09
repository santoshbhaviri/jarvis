// src/components/TodayTab.jsx
// The daily starting point: Top 3 focus, overdue, due today, follow-ups to make
import { useMemo } from 'react'
import { todayStr } from '../lib/dateUtils'
import { quadrantOf } from '../lib/constants'
import { openTasks, byPriority, followUpsDue } from '../lib/selectors'
import SectionHeader from './SectionHeader'
import TaskCard      from './TaskCard'
import shared        from './TabShared.module.css'
import styles        from './TodayTab.module.css'

export default function TodayTab({ catFilter, taskData, onOpenTab }) {
  const { tasks, isCompletedToday, toggleDailyComplete, toggleFocus, updateNotes, extendTask } = taskData
  const today = todayStr()

  const mine = useMemo(() =>
    tasks.filter(t => catFilter === 'all' || t.category === catFilter), [tasks, catFilter])

  const open      = openTasks(mine)
  const focus     = open.filter(t => t.focus_date === today).sort(byPriority)
  // Each task shows once: focus first, then follow-ups, then by date
  const chase     = followUpsDue(mine, today).filter(t => t.focus_date !== today)
  const shown     = new Set([...focus, ...chase].map(t => t.id))
  const overdue   = open.filter(t => t.due_date && t.due_date < today && !shown.has(t.id)).sort(byPriority)
  const dueToday  = open.filter(t => t.due_date === today && !shown.has(t.id)).sort(byPriority)
  const doneToday = mine.filter(t => t.status !== 'routine' && isCompletedToday(t.id))
  const routines  = mine.filter(t => t.status === 'routine')
  const routinesLeft = routines.filter(t => !isCompletedToday(t.id)).length
  const suggestions = open
    .filter(t => t.focus_date !== today && quadrantOf(t) <= 2)
    .sort(byPriority)
    .slice(0, Math.max(0, 3 - focus.length))

  const card = (t, completed = false) => (
    <TaskCard key={t.id} task={t}
      completed={completed}
      onToggleComplete={toggleDailyComplete}
      onEditNotes={updateNotes}
      onExtend={(task, d) => extendTask(task, d, task.status === 'mission')}
      showExtend={!completed}
      showDueDate={true}
    />
  )

  const stats = [
    { n: open.filter(t => t.due_date && t.due_date < today).length, label: 'Overdue', tone: open.some(t => t.due_date && t.due_date < today) ? styles.bad : '' },
    { n: open.filter(t => t.due_date === today).length, label: 'Due today', tone: open.some(t => t.due_date === today) ? styles.warn : '' },
    { n: chase.length,    label: 'Follow-ups to make', tone: chase.length ? styles.warn : '' },
    { n: doneToday.length, label: 'Finished today',  tone: styles.good },
  ]

  return (
    <div>
      <div className={styles.stats}>
        {stats.map(s => (
          <div key={s.label} className={`${styles.stat} ${s.tone}`}>
            <span className={styles.statN}>{s.n}</span>
            <span className={styles.statL}>{s.label}</span>
          </div>
        ))}
      </div>

      <SectionHeader label="Top 3 for today" count={focus.length} accent="#f59e0b" />
      <div className={shared.list}>
        {focus.map(t => card(t))}
        {focus.length === 0 && <p className={shared.noneMsg}>Star ☆ up to three important tasks to make them today’s focus.</p>}
        {focus.length > 3 && <p className={styles.note}>More than 3 focus tasks dilutes focus. Consider un-starring some.</p>}
        {suggestions.length > 0 && (
          <div className={styles.suggest}>
            <span className={styles.suggestLabel}>Suggested:</span>
            {suggestions.map(t => (
              <button key={t.id} className={styles.suggestBtn} onClick={() => toggleFocus(t)}>☆ {t.title}</button>
            ))}
          </div>
        )}
      </div>

      {chase.length > 0 && (
        <>
          <SectionHeader label="Follow up today" count={chase.length} accent="#06b6d4" />
          <p className={styles.note}>Tap 📞 after you call or message. It reminds you again in 2 days.</p>
          <div className={shared.list}>{chase.map(t => card(t))}</div>
        </>
      )}

      {overdue.length > 0 && (
        <>
          <SectionHeader label="Overdue" count={overdue.length} accent="#ef4444" />
          <div className={shared.list}>{overdue.map(t => card(t))}</div>
        </>
      )}

      <SectionHeader label="Due today" count={dueToday.length} accent="#f59e0b" />
      <div className={shared.list}>
        {dueToday.map(t => card(t))}
        {dueToday.length === 0 && <p className={shared.noneMsg}>Nothing else is due today.</p>}
      </div>

      {routines.length > 0 && (
        <button className={styles.routineLink} onClick={() => onOpenTab('routine')}>
          🔁 {routinesLeft === 0 ? 'All routines done today' : `${routinesLeft} of ${routines.length} routines left today`} →
        </button>
      )}

      {doneToday.length > 0 && (
        <>
          <SectionHeader label="Finished today" count={doneToday.length} accent="#22c55e" />
          <div className={shared.list}>{doneToday.map(t => card(t, true))}</div>
        </>
      )}
    </div>
  )
}
