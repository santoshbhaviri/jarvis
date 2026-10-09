// src/components/TaskCard.jsx
import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CATEGORIES, STATUSES, QUADRANTS, quadrantOf } from '../lib/constants'
import { formatDisplay, dueBadge, todayStr } from '../lib/dateUtils'
import { useTaskActions } from '../lib/taskActions'
import styles from './TaskCard.module.css'

export default function TaskCard({
  task,
  completed   = false,
  scheduled   = false,
  onToggleComplete,
  onEditNotes,
  onExtend,
  showDueDate = false,
  showExtend  = false,
}) {
  const [editingNotes, setEditingNotes]       = useState(false)
  const [notesVal, setNotesVal]               = useState(task.notes || '')
  const [showExtendInput, setShowExtendInput] = useState(false)
  const [extendDate, setExtendDate]           = useState('')
  const [saving, setSaving]                   = useState(false)
  const { toggleFocus, markChased, openEdit } = useTaskActions()

  // Sync textarea when task.notes changes externally
  useEffect(() => {
    if (!editingNotes) setNotesVal(task.notes || '')
  }, [task.notes, editingNotes])

  const cat = CATEGORIES[task.category]
  const st  = STATUSES[task.status]
  const db  = dueBadge(task.due_date)
  const q   = quadrantOf(task)
  const today     = todayStr()
  const isFocus   = task.focus_date === today
  const chaseDue  = task.waiting_on && task.follow_up && task.follow_up <= today && !completed

  const handleSaveNotes = async () => {
    setSaving(true)
    const { error } = await onEditNotes(task.id, notesVal)
    setSaving(false)
    if (error) toast.error('Could not save notes')
    else { toast.success('Notes saved!'); setEditingNotes(false) }
  }

  const handleCancelNotes = () => {
    setEditingNotes(false)
    setNotesVal(task.notes || '')
  }

  const handleExtend = async () => {
    if (!extendDate) { toast.error('Pick a date'); return }
    setSaving(true)
    const { error } = await onExtend(task, extendDate)
    setSaving(false)
    if (error) toast.error('Could not extend task')
    else {
      toast.success('Task moved to Scheduled!')
      setShowExtendInput(false)
      setExtendDate('')
    }
  }

  const cardClass = [
    styles.card,
    completed         ? styles.completed  : '',
    scheduled         ? styles.scheduled  : '',
    task.is_unfinished ? styles.unfinished : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={cardClass}>
      <div className={styles.top}>

        {/* Checkbox */}
        <button
          className={`${styles.checkbox} ${completed ? styles.checked : ''}`}
          onClick={() => onToggleComplete(task.id)}
          title={completed ? 'Mark incomplete' : 'Mark complete'}
        >
          {completed && <span className={styles.checkMark}>✓</span>}
        </button>

        <div className={styles.content}>
          <div className={styles.titleRow}>
            <span className={styles.title}>{task.title}</span>
            {/* Unfinished tag — highest priority, shown first */}
            {task.is_unfinished && <span className={styles.unfinishedTag}>Unfinished</span>}
            {task.is_extended   && !task.is_unfinished && <span className={styles.extTag}>Extended</span>}
            {scheduled          && <span className={styles.scheduledTag}>Scheduled</span>}
            {isFocus            && <span className={styles.focusTag}>★ Focus</span>}
          </div>

          <div className={styles.badges}>
            <span className={styles.catBadge} style={{ background: cat.bg, color: cat.color }}>
              {cat.icon} {cat.label}
            </span>
            <span className={styles.stBadge} style={{ background: st.bg, color: st.color }}>
              {st.label}
            </span>
            {q !== 4 && (
              <span className={styles.prioBadge} style={{ color: QUADRANTS[q].color, borderColor: QUADRANTS[q].color }}>
                {q === 1 ? 'Important · Urgent' : q === 2 ? 'Important' : 'Urgent'}
              </span>
            )}
            {task.waiting_on && (
              <span className={`${styles.waitBadge} ${chaseDue ? styles.waitDue : ''}`}>
                👤 {task.waiting_on}{task.follow_up ? ` · ${formatDisplay(task.follow_up)}` : ''}
              </span>
            )}
            {task.postponed >= 2 && !completed && (
              <span className={styles.postBadge}>Postponed {task.postponed}×</span>
            )}
            {showDueDate && task.due_date && (
              <span
                className={styles.dueDateBadge}
                style={{ background: db?.bg || '#1f2237', color: db?.color || '#a0a8c8' }}
              >
                📅 {formatDisplay(task.due_date)}
                {db && ` · ${db.text}`}
              </span>
            )}
            {!showDueDate && db && (
              <span className={styles.dueDateBadge} style={{ background: db.bg, color: db.color }}>
                {db.text}
              </span>
            )}
          </div>

          {task.notes && !editingNotes && (
            <p className={styles.notes}>📝 {task.notes}</p>
          )}
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          {toggleFocus && !completed && (
            <button
              className={`${styles.iconBtn} ${isFocus ? styles.iconBtnActive : ''}`}
              title={isFocus ? "Remove from today's Top 3" : "Add to today's Top 3"}
              aria-pressed={isFocus}
              onClick={() => toggleFocus(task)}
            >{isFocus ? '★' : '☆'}</button>
          )}
          {chaseDue && markChased && (
            <button
              className={styles.iconBtn}
              title="I followed up. Remind me again in 2 days"
              onClick={async () => { const { error } = await markChased(task); if (!error) toast.success('Next follow-up in 2 days') }}
            >📞</button>
          )}
          {openEdit && (
            <button className={styles.iconBtn} title="Edit task" onClick={() => openEdit(task)}>⚙︎</button>
          )}
          <button
            className={`${styles.iconBtn} ${editingNotes ? styles.iconBtnActive : ''}`}
            title="Edit notes"
            onClick={() => setEditingNotes(e => !e)}
          >✏️</button>
          {showExtend && !completed && (
            <button
              className={`${styles.iconBtn} ${showExtendInput ? styles.iconBtnActive : ''}`}
              title={scheduled ? 'Re-schedule' : 'Extend task'}
              onClick={() => setShowExtendInput(e => !e)}
            >📅</button>
          )}
        </div>
      </div>

      {/* Edit notes */}
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
            <button className={styles.cancelSmall} onClick={handleCancelNotes}>Cancel</button>
            <button className={styles.saveSmall} onClick={handleSaveNotes} disabled={saving}>
              {saving ? '…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Extend / reschedule */}
      {showExtendInput && (
        <div className={styles.extendRow}>
          <span className={styles.extLabel}>
            {scheduled ? 'Reschedule to:' : 'Extend to:'}
          </span>
          <input
            type="date"
            className={styles.extInput}
            value={extendDate}
            onChange={e => setExtendDate(e.target.value)}
          />
          <button className={styles.saveSmall} onClick={handleExtend} disabled={saving}>
            {saving ? '…' : 'Confirm'}
          </button>
          <button className={styles.cancelSmall} onClick={() => { setShowExtendInput(false); setExtendDate('') }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
