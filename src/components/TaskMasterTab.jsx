import { useState } from 'react'
import toast from 'react-hot-toast'
import { CATEGORIES, STATUSES } from '../lib/constants'
import { formatDisplay } from '../lib/dateUtils'
import SectionHeader from './SectionHeader'
import styles from './TaskMasterTab.module.css'

export default function TaskMasterTab({ taskData, onAdd }) {
  const { tasks, deleteTask, loading } = taskData
  const [search, setSearch] = useState('')

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase())
  )

  const grouped = {
    routine:    filtered.filter(t => t.status === 'routine'),
    'scut-work':filtered.filter(t => t.status === 'scut-work'),
    mission:    filtered.filter(t => t.status === 'mission'),
  }

  const handleDelete = async (task) => {
    if (!confirm(`Delete "${task.title}"?`)) return
    const { error } = await deleteTask(task.id)
    if (error) toast.error('Could not delete')
    else toast.success('Task deleted')
  }

  return (
    <div className={styles.wrap}>
      {/* Header bar */}
      <div className={styles.topBar}>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            className={styles.search}
            placeholder="Search all tasks…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button className={styles.addBtn} onClick={onAdd}>+ Add Task</button>
      </div>

      {loading && <p className={styles.loading}>Loading…</p>}

      {/* Grouped by status */}
      {Object.entries(grouped).map(([status, list]) => {
        if (!list.length) return null
        const st = STATUSES[status]
        return (
          <div key={status}>
            <SectionHeader label={st.label} count={list.length} accent={st.color} />
            <div className={styles.list}>
              {list.map(task => (
                <MasterRow key={task.id} task={task} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        )
      })}

      {!loading && !filtered.length && (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👑</div>
          <p>No tasks yet. Hit <strong>+ Add Task</strong> to begin.</p>
        </div>
      )}
    </div>
  )
}

function MasterRow({ task, onDelete }) {
  const cat = CATEGORIES[task.category]
  const st  = STATUSES[task.status]

  return (
    <div className={styles.row}>
      <div className={styles.rowLeft}>
        <div className={styles.rowTitle}>
          {task.title}
          {task.is_extended && <span className={styles.extTag}>Extended</span>}
          {task.completed_at && <span className={styles.extTag}>Finished {formatDisplay(task.completed_at.slice(0, 10))}</span>}
        </div>
        <div className={styles.rowMeta}>
          <span className={styles.badge} style={{ background: cat.bg, color: cat.color }}>
            {cat.icon} {cat.label}
          </span>
          <span className={styles.badge} style={{ background: st.bg, color: st.color }}>
            {st.label}
          </span>
          {task.due_date && (
            <span className={styles.dateTag}>📅 {formatDisplay(task.due_date)}</span>
          )}
        </div>
        {task.notes && <p className={styles.rowNotes}>{task.notes}</p>}
      </div>
      <button className={styles.delBtn} onClick={() => onDelete(task)} title="Delete task">🗑</button>
    </div>
  )
}
