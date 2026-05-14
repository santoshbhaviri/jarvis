// src/pages/Dashboard.jsx
import { useState } from 'react'
import { useTasks }   from '../hooks/useTasks'
import { useFilters } from '../hooks/useFilters'
import Header         from '../components/Header'
import StatsBar       from '../components/StatsBar'
import AlertBanner    from '../components/AlertBanner'
import FilterBar      from '../components/FilterBar'
import TabBar         from '../components/TabBar'
import TaskList       from '../components/TaskList'
import BulkAddModal   from '../components/BulkAddModal'
import EditTaskModal  from '../components/EditTaskModal'
import styles         from './Dashboard.module.css'
import { today, daysLeft } from '../lib/dateUtils'

export default function Dashboard() {
  const { tasks, loading, error, addTasks, updateTask, updateStatus, deleteTask } = useTasks()
  const filters = useFilters(tasks)

  const [showBulk, setShowBulk]   = useState(false)
  const [editTask, setEditTask]   = useState(null)

  const todayStr       = today()
  const overdueList    = tasks.filter(t => daysLeft(t.due_date) < 0 && t.status !== 'done')
  const followupToday  = tasks.filter(t => t.followup_date === todayStr && t.status !== 'done')

  return (
    <div className={styles.page}>
      <Header onAddClick={() => setShowBulk(true)} />

      <main className={styles.main}>
        <StatsBar tasks={tasks} />

        <AlertBanner overdueList={overdueList} followupToday={followupToday} />

        <TabBar
          counts={filters.counts}
          active={filters.tab}
          onChange={filters.setTab}
        />

        <FilterBar
          category={filters.category} onCategory={filters.setCategory}
          priority={filters.priority} onPriority={filters.setPriority}
          status={filters.status}     onStatus={filters.setStatus}
          search={filters.search}     onSearch={filters.setSearch}
        />

        <TaskList
          tasks={filters.filtered}
          allEmpty={tasks.length === 0}
          loading={loading}
          error={error}
          onStatusChange={updateStatus}
          onEdit={setEditTask}
          onDelete={deleteTask}
          onAddClick={() => setShowBulk(true)}
        />
      </main>

      {showBulk && (
        <BulkAddModal
          onClose={() => setShowBulk(false)}
          onSave={addTasks}
        />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask}
          onClose={() => setEditTask(null)}
          onSave={updateTask}
        />
      )}
    </div>
  )
}
