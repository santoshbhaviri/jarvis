// src/components/RoutineTab.jsx
import { useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import toast from 'react-hot-toast'
import { getAllMonthDates, getMonthStartDow, todayStr } from '../lib/dateUtils'
import SectionHeader from './SectionHeader'
import styles from './RoutineTab.module.css'

export default function RoutineTab({ catFilter, taskData }) {
  const {
    tasks, isCompletedToday, isRoutineDone,
    toggleDailyComplete, updateNotes,
  } = taskData

  const today         = todayStr()
  const allMonthDates = useMemo(() => getAllMonthDates(), [])
  const monthStartDow = useMemo(() => getMonthStartDow(), [])
  const monthLabel    = useMemo(() => format(new Date(), 'MMMM yyyy'), [])

  const routineTasks = useMemo(() =>
    tasks.filter(t =>
      t.status === 'routine' &&
      (catFilter === 'all' || t.category === catFilter)
    ), [tasks, catFilter])

  const pending   = routineTasks.filter(t => !isCompletedToday(t.id))
  const completed = routineTasks.filter(t =>  isCompletedToday(t.id))

  if (!routineTasks.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>🔁</div>
      <p>No routine tasks yet. Add them in Task Master.</p>
    </div>
  )

  const cardProps = {
    allMonthDates, monthStartDow, monthLabel, today,
    isRoutineDone, onToggleComplete: toggleDailyComplete, onEditNotes: updateNotes,
  }

  return (
    <div>
      <SectionHeader label="Pending" count={pending.length} accent="#06b6d4" />
      <div className={styles.list}>
        {pending.map(task => (
          <RoutineCard key={task.id} task={task} completed={false} {...cardProps} />
        ))}
        {pending.length === 0 && <p className={styles.allDone}>🎉 All routine tasks done today!</p>}
      </div>

      {completed.length > 0 && (
        <>
          <SectionHeader label="Completed Today" count={completed.length} accent="#22c55e" />
          <div className={styles.list}>
            {completed.map(task => (
              <RoutineCard key={task.id} task={task} completed={true} {...cardProps} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ── Individual Routine Card ────────────────────────────────────
function RoutineCard({
  task, allMonthDates, monthStartDow, monthLabel, today,
  isRoutineDone, onToggleComplete, onEditNotes, completed,
}) {
  const [showCalendar, setShowCalendar] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [notesVal, setNotesVal]         = useState(task.notes || '')
  const [saving, setSaving]             = useState(false)

  const doneCount  = allMonthDates.filter(d => isRoutineDone(task.id, d)).length
  const totalSoFar = allMonthDates.filter(d => d <= today).length

  const handleSaveNotes = async () => {
    setSaving(true)
    const { error } = await onEditNotes(task.id, notesVal)
    setSaving(false)
    if (error) toast.error('Could not save notes')
    else { toast.success('Notes saved!'); setEditingNotes(false) }
  }

  const DOW_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

  return (
    <div className={`${styles.routineCard} ${completed ? styles.completedCard : ''}`}>

      {/* ── Top row ── */}
      <div className={styles.cardTop}>
        <button
          className={`${styles.checkbox} ${completed ? styles.checked : ''}`}
          onClick={() => onToggleComplete(task.id)}
          title={completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {completed && <span className={styles.checkMark}>✓</span>}
        </button>

        <div className={styles.cardInfo}>
          <span className={styles.cardTitle}>{task.title}</span>
          <div className={styles.meta}>
            <span className={styles.catBadge} style={{
              background: task.category === 'work' ? '#eef2ff' : '#fdf2f8',
              color:      task.category === 'work' ? '#6366f1' : '#ec4899',
            }}>
              {task.category === 'work' ? '💼' : '🏠'} {task.category}
            </span>
            <span className={styles.streakBadge}>
              🔥 {doneCount}/{totalSoFar} · {monthLabel}
            </span>
          </div>
        </div>

        <div className={styles.topActions}>
          <button
            className={`${styles.calBtn} ${showCalendar ? styles.calBtnActive : ''}`}
            onClick={() => setShowCalendar(s => !s)}
            title={showCalendar ? 'Hide calendar' : 'View full month'}
          >
            {showCalendar ? '▲' : '📅'}
          </button>
          <button
            className={`${styles.editBtn} ${editingNotes ? styles.editBtnActive : ''}`}
            onClick={() => setEditingNotes(e => !e)}
            title="Edit notes"
          >✏️</button>
        </div>
      </div>

      {/* ── Horizontal scrollable bubble strip ── */}
      <div className={styles.stripWrap}>
        <div className={styles.strip}>
          {allMonthDates.map(date => {
            const done     = isRoutineDone(task.id, date)
            const isToday  = date === today
            const isFuture = date > today
            const isPast   = date < today
            const dayNum   = parseInt(date.split('-')[2], 10)
            const dayName  = format(parseISO(date), 'EEE')

            const bubbleClass = [
              styles.bubble,
              done            ? styles.bubbleDone   : '',
              isPast && !done ? styles.bubbleMissed : '',
              isToday         ? styles.bubbleToday  : '',
              isFuture        ? styles.bubbleFuture : '',
            ].filter(Boolean).join(' ')

            return (
              <span key={date} className={styles.bubbleWrap} title={date}>
                <span className={styles.bubbleDayName}>{dayName}</span>
                {/* FIX: always show the date number — color coding conveys done/missed */}
                <span className={bubbleClass}>{dayNum}</span>
              </span>
            )
          })}
        </div>
      </div>

      {/* ── Expandable full month calendar ── */}
      {showCalendar && (
        <div className={styles.calendarWrap}>
          <div className={styles.calendarLabel}>{monthLabel}</div>

          <div className={styles.calendarHeader}>
            {DOW_LABELS.map(d => (
              <span key={d} className={styles.dowLabel}>{d}</span>
            ))}
          </div>

          <div className={styles.calendarGrid}>
            {Array.from({ length: monthStartDow }).map((_, i) => (
              <span key={`pad-${i}`} className={styles.padCell} />
            ))}

            {allMonthDates.map(date => {
              const done     = isRoutineDone(task.id, date)
              const isToday  = date === today
              const isFuture = date > today
              const isPast   = date < today
              const dayNum   = parseInt(date.split('-')[2], 10)

              const cls = [
                styles.dayCell,
                done             ? styles.dayCellDone   : '',
                isPast && !done  ? styles.dayCellMissed : '',
                isToday          ? styles.dayCellToday  : '',
                isFuture         ? styles.dayCellFuture : '',
              ].filter(Boolean).join(' ')

              return (
                // FIX: always show date number in calendar cells too
                <span key={date} className={cls} title={date}>
                  <span className={styles.dayNum}>{dayNum}</span>
                </span>
              )
            })}
          </div>
        </div>
      )}

      {task.notes && !editingNotes && (
        <p className={styles.notes}>📝 {task.notes}</p>
      )}

      {editingNotes && (
        <div className={styles.editNotes}>
          <textarea
            className={styles.notesInput}
            value={notesVal}
            onChange={e => setNotesVal(e.target.value)}
            placeholder="Add notes…"
            rows={2}
            autoFocus
          />
          <div className={styles.notesActions}>
            <button className={styles.cancelSmall} onClick={() => { setEditingNotes(false); setNotesVal(task.notes || '') }}>
              Cancel
            </button>
            <button className={styles.saveSmall} onClick={handleSaveNotes} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
