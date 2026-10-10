// src/components/TodayTab.jsx
// The day's plan: a box to add tasks (type or speak), the one thing to do next, what else is left today (unfinished tasks
// carry over by themselves), what got done, and anything planned for later days.
// After 8 pm an evening wrap-up asks what to do with what's left.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { todayStr } from '../lib/dateUtils'
import { ruleOf, nextAfter } from '../lib/repeat'
import { doneDay } from '../hooks/useTasks'
import SectionHeader from './SectionHeader'
import TaskRow       from './TaskRow'
import AddTasks      from './AddTasks'
import styles        from './TodayTab.module.css'

export default function TodayTab({ taskData, onEdit }) {
  const { tasks, setDone, updateTask, moveTask, deleteTask, addTask } = taskData
  const [showLater, setShowLater] = useState(true)
  const [skipped, setSkipped]     = useState([])     // "Later" on the Now card, for this visit
  const [wrapped, setWrapped]     = useState(() => { try { return localStorage.getItem(WRAP_KEY) === todayStr() } catch { return false } })
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

  const evening  = new Date().getHours() >= WRAP_HOUR && todo.length > 0 && !wrapped
  const now      = !evening && (todo.find(t => !skipped.includes(t.id)) || null)
  // During the wrap-up the left-over tasks are listed there, not twice
  const rest     = evening ? [] : now ? todo.filter(t => t.id !== now.id) : todo
  const finishWrap = () => { try { localStorage.setItem(WRAP_KEY, today) } catch { /* private mode */ } setWrapped(true) }

  return (
    <div>
      <AddTasks taskData={taskData} />
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
        {now && (
          <div className={styles.now}>
            <span className={styles.nowLabel}>Next</span>
            <button className={styles.nowTitle} onClick={() => onEdit(now)}>{now.important ? '★ ' : ''}{now.title}</button>
            <div className={styles.nowActions}>
              <button className={styles.nowDone} onClick={() => setDone(now, true)}>Done</button>
              {todo.length > 1 && <button className={styles.nowLater} onClick={() => setSkipped(s => [...s, now.id])}>Later</button>}
            </div>
          </div>
        )}
      </div>

      {evening && (
        <Wrapup todo={todo} onDone={finishWrap}
          moveTask={moveTask} deleteTask={deleteTask} addTask={addTask} setDone={setDone} />
      )}

      {rest.length > 0 && <SectionHeader label={now ? 'Also today' : 'To do'} count={rest.length} accent="var(--accent)" />}
      <div className={styles.list}>
        {rest.map(t => <TaskRow key={t.id} task={t} {...rowProps} />)}
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

const WRAP_HOUR = 20                  // 8 pm
const WRAP_KEY  = 'jarvis-wrapup-done'

// Evening wrap-up: for each task left today, done, tomorrow, or drop it
function Wrapup({ todo, onDone, moveTask, deleteTask, addTask, setDone }) {
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const drop = async (t) => {
    const { error } = await deleteTask(t.id)
    if (error) { toast.error('Could not drop'); return }
    const rule = ruleOf(t)   // a repeating task skips just this time
    if (rule) await addTask({ ...t, due_date: nextAfter(rule, format(new Date(), 'yyyy-MM-dd')) })
    toast((tt) => (
      <span className={styles.toast}>Dropped <button onClick={() => { toast.dismiss(tt.id); addTask(t) }}>Undo</button></span>
    ), { duration: 4000 })
  }
  const allTomorrow = async () => { for (const t of todo) await moveTask(t, tomorrow); onDone() }
  return (
    <div className={styles.wrap}>
      <div className={styles.wrapHead}>
        <strong>Evening wrap-up</strong>
        <span>{todo.length} left</span>
      </div>
      {todo.map(t => (
        <div key={t.id} className={styles.wrapRow}>
          <span className={styles.wrapTitle}>{t.title}</span>
          <button onClick={() => setDone(t, true)} aria-label={`${t.title} done`}>✓</button>
          <button onClick={() => moveTask(t, tomorrow)}>Tomorrow</button>
          <button className={styles.wrapDrop} onClick={() => drop(t)}>Drop</button>
        </div>
      ))}
      <div className={styles.wrapFoot}>
        <button className={styles.nowDone} onClick={allTomorrow}>All to tomorrow</button>
        <button className={styles.nowLater} onClick={onDone}>Close</button>
      </div>
    </div>
  )
}
