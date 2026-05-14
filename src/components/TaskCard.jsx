// src/components/TaskCard.jsx
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './TaskCard.module.css'
import { PRIORITIES, CATEGORIES, STATUSES } from '../lib/constants'
import { dueBadge, formatDisplay } from '../lib/dateUtils'

export default function TaskCard({ task, onStatusChange, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const pri     = PRIORITIES[task.priority]
  const cat     = CATEGORIES[task.category]
  const db      = dueBadge(task.due_date)
  const isDone  = task.status === 'done'

  const handleStatusChange = async (e) => {
    e.stopPropagation()
    const { error } = await onStatusChange(task.id, e.target.value)
    if (error) toast.error('Could not update status')
  }

  const handleDelete = async (e) => {
    e.stopPropagation()
    if (!confirm(`Delete "${task.title}"?`)) return
    setDeleting(true)
    const { error } = await onDelete(task.id)
    if (error) { toast.error('Could not delete task'); setDeleting(false) }
    else toast.success('Task deleted')
  }

  return (
    <li className={`${styles.card} ${isDone ? styles.done : ''} ${deleting ? styles.deleting : ''}`}>
      {/* Card header — always visible */}
      <div className={styles.header} onClick={() => setExpanded(e => !e)}>
        <span className={styles.dot} style={{ background: pri.dot }} />
        <div className={styles.main}>
          <p className={styles.title}>{task.title}</p>
          <div className={styles.meta}>
            <span className={`${styles.catBadge} ${styles[task.category]}`}>
              {cat.icon} {cat.label}
            </span>
            {db && (
              <span className={styles.dueBadge} style={{ background: db.bg, color: db.color }}>
                {db.text}
              </span>
            )}
            {task.followup_date && (
              <span className={styles.followupBadge}>↻ {formatDisplay(task.followup_date)}</span>
            )}
          </div>
        </div>
        <select
          className={styles.statusSel}
          value={task.status}
          onChange={handleStatusChange}
          onClick={e => e.stopPropagation()}
        >
          {Object.entries(STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <span className={`${styles.chevron} ${expanded ? styles.open : ''}`}>›</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={styles.detail}>
          <div className={styles.detailRow}>
            <span>📅 Due: <strong>{formatDisplay(task.due_date)}</strong></span>
            <span>↻ Follow-up: <strong>{formatDisplay(task.followup_date)}</strong></span>
            <span>🎯 Priority: <strong style={{ color: pri.color }}>{pri.label}</strong></span>
          </div>
          {task.notes && <p className={styles.notes}>📝 {task.notes}</p>}
          <div className={styles.actions}>
            <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); onEdit(task) }}>
              ✏️ Edit
            </button>
            <button className={styles.delBtn} onClick={handleDelete}>
              🗑 Delete
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
