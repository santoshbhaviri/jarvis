// src/components/TrackerTab.jsx
// Daily habits and goals (gym, walk, reading…): tick each day, see the week and month at a glance
import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO, startOfWeek, addDays } from 'date-fns'
import { getAllMonthDates, getMonthStartDow, todayStr } from '../lib/dateUtils'
import styles from './HabitCard.module.css'
import own    from './TrackerTab.module.css'

const ymd = (d) => format(d, 'yyyy-MM-dd')
const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

export default function TrackerTab({ taskData, onEdit }) {
  const { tasks, addTask, toggleRoutineDay, isRoutineDone } = taskData
  const [title, setTitle]   = useState('')
  const [target, setTarget] = useState('')
  const [saving, setSaving] = useState(false)

  const today         = todayStr()
  const allMonthDates = useMemo(() => getAllMonthDates(), [])
  const monthStartDow = useMemo(() => getMonthStartDow(), [])
  const weekDates     = useMemo(() => {
    const mon = startOfWeek(new Date(), { weekStartsOn: 1 })
    return Array.from({ length: 7 }, (_, i) => ymd(addDays(mon, i)))
  }, [])

  const habits = tasks.filter(t => t.status === 'routine')

  const add = async (e) => {
    e.preventDefault()
    if (!title.trim() || saving) return
    setSaving(true)
    const { error } = await addTask({ title, status: 'routine', category: 'personal', target_per_week: Number(target) || null })
    setSaving(false)
    if (error) { toast.error(`Could not add: ${error.message}`); return }
    setTitle(''); setTarget('')
    toast.success('Habit added')
  }

  const toggle = async (task, date) => {
    if (date > today) return
    const { error } = await toggleRoutineDay(task.id, date)
    if (error) toast.error('Could not save. Try again.')
  }

  return (
    <div>
      <form className={own.addForm} onSubmit={add}>
        <input className={own.input} value={title} onChange={e => setTitle(e.target.value)}
          placeholder="New habit" aria-label="New habit" />
        <select className={own.select} value={target} onChange={e => setTarget(e.target.value)} aria-label="Goal per week">
          <option value="">Every day</option>
          {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}× a week</option>)}
        </select>
        <button className={own.addBtn} disabled={!title.trim() || saving}>Add</button>
      </form>

      {habits.length === 0 && (
        <div className={own.empty}><p>Add a habit, like Gym 4× a week.</p></div>
      )}

      <div className={styles.list}>
        {habits.map(task => (
          <HabitCard key={task.id} task={task}
            today={today} weekDates={weekDates}
            allMonthDates={allMonthDates} monthStartDow={monthStartDow}
            isDone={(d) => isRoutineDone(task.id, d)}
            onToggle={(d) => toggle(task, d)}
            onEdit={() => onEdit(task)}
          />
        ))}
      </div>
    </div>
  )
}

function HabitCard({ task, today, weekDates, allMonthDates, monthStartDow, isDone, onToggle, onEdit }) {
  const [showCalendar, setShowCalendar] = useState(false)

  const doneToday  = isDone(today)
  const weekDone   = weekDates.filter(d => d <= today && isDone(d)).length
  const weekGoal   = task.target_per_week || 7
  const monthSoFar = allMonthDates.filter(d => d <= today)
  const monthDone  = monthSoFar.filter(isDone).length
  const monthGoal  = task.target_per_week
    ? Math.round(task.target_per_week * allMonthDates.length / 7)
    : allMonthDates.length
  const onTrack    = weekDone >= weekGoal

  return (
    <div className={styles.routineCard}>
      <div className={styles.cardTop}>
        <button
          className={`${own.bigCheck} ${doneToday ? own.bigChecked : ''}`}
          onClick={() => onToggle(today)}
          aria-label={doneToday ? `Undo ${task.title} for today` : `Mark ${task.title} done today`}
        >{doneToday ? '✓' : ''}</button>

        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{task.title}</span>
          <span className={own.goal}>{task.target_per_week ? `${task.target_per_week}× a week` : 'Every day'}</span>
        </div>

        <div className={styles.topActions}>
          <button className={`${styles.calBtn} ${showCalendar ? styles.calBtnActive : ''}`}
            onClick={() => setShowCalendar(s => !s)} title={showCalendar ? 'Hide month' : 'Show month'}>
            {showCalendar ? '▲' : '📅'}
          </button>
          <button className={styles.editBtn} onClick={onEdit} title="Edit or delete habit">⚙︎</button>
        </div>
      </div>

      <div className={own.stats}>
        <div className={`${own.stat} ${onTrack ? own.statGood : ''}`}>
          <span className={own.statN}>{weekDone}<small>/{weekGoal}</small></span>
          <span className={own.statL}>this week{onTrack ? ' ✓' : ''}</span>
        </div>
        <div className={own.stat}>
          <span className={own.statN}>{monthDone}<small>/{monthGoal}</small></span>
          <span className={own.statL}>in {format(new Date(), 'MMMM')}</span>
        </div>
      </div>

      {/* This week: tap a day to tick or untick it */}
      <div className={own.week}>
        {weekDates.map(date => {
          const done = isDone(date), future = date > today
          return (
            <button key={date} disabled={future} onClick={() => onToggle(date)}
              className={[own.day, done && own.dayDone, date === today && own.dayToday, future && own.dayFuture].filter(Boolean).join(' ')}
              aria-pressed={done} aria-label={`${format(parseISO(date), 'EEEE d MMM')}${done ? ', done' : ''}`}>
              <span className={own.dayName}>{format(parseISO(date), 'EEEEE')}</span>
              <span className={own.dayMark}>{done ? '✓' : format(parseISO(date), 'd')}</span>
            </button>
          )
        })}
      </div>

      {showCalendar && (
        <div className={styles.calendarWrap}>
          <div className={styles.calendarLabel}>{format(new Date(), 'MMMM yyyy')}</div>
          <div className={styles.calendarHeader}>
            {DOW_LABELS.map(d => <span key={d} className={styles.dowLabel}>{d}</span>)}
          </div>
          <div className={styles.calendarGrid}>
            {Array.from({ length: monthStartDow }).map((_, i) => <span key={`pad-${i}`} className={styles.padCell} />)}
            {allMonthDates.map(date => {
              const done = isDone(date), isFuture = date > today, isPast = date < today && date >= (task.created_at || '').slice(0, 10)
              const cls = [
                styles.dayCell,
                done ? styles.dayCellDone : '',
                isPast && !done ? styles.dayCellMissed : '',
                date === today ? styles.dayCellToday : '',
                isFuture ? styles.dayCellFuture : '',
              ].filter(Boolean).join(' ')
              return (
                <button key={date} className={`${cls} ${own.cellBtn}`} disabled={isFuture}
                  onClick={() => onToggle(date)} aria-pressed={done} title={date}>
                  <span className={styles.dayNum}>{parseInt(date.split('-')[2], 10)}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
