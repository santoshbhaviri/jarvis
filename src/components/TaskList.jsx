// src/components/TaskList.jsx
import TaskCard  from './TaskCard'
import styles    from './TaskList.module.css'

export default function TaskList({
  tasks, allEmpty, loading, error,
  onStatusChange, onEdit, onDelete, onAddClick,
}) {
  if (loading) return (
    <div className={styles.center}>
      <div className={styles.spinner} />
      <p>Loading tasks…</p>
    </div>
  )

  if (error) return (
    <div className={`${styles.center} ${styles.error}`}>
      <span>⚠️</span>
      <p>Could not load tasks: {error}</p>
    </div>
  )

  if (allEmpty) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>📋</div>
      <h3>No tasks yet</h3>
      <p>Click <strong>+ Add Tasks</strong> to get started</p>
      <button className={styles.emptyBtn} onClick={onAddClick}>+ Add Tasks</button>
    </div>
  )

  if (!tasks.length) return (
    <div className={styles.empty}>
      <div className={styles.emptyIcon}>📭</div>
      <p>No tasks match your filters</p>
    </div>
  )

  return (
    <ul className={styles.list}>
      {tasks.map(task => (
        <TaskCard
          key={task.id}
          task={task}
          onStatusChange={onStatusChange}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  )
}
