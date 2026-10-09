// src/App.jsx
import { useState, useMemo } from 'react'
import { useAuth }      from './hooks/useAuth'
import { useTasks }     from './hooks/useTasks'
import { useTheme }     from './hooks/useTheme'
import { useReminders } from './hooks/useReminders'
import { TaskActionsContext } from './lib/taskActions'
import Header          from './components/Header'
import TabNav          from './components/TabNav'
import RadioFilter     from './components/RadioFilter'
import QuickCapture    from './components/QuickCapture'
import TodayTab        from './components/TodayTab'
import PriorityTab     from './components/PriorityTab'
import RoutineTab      from './components/RoutineTab'
import ScutWorkTab     from './components/ScutWorkTab'
import MissionTab      from './components/MissionTab'
import InsightsTab     from './components/InsightsTab'
import TaskMasterTab   from './components/TaskMasterTab'
import AddTaskModal    from './components/AddTaskModal'
import EditTaskModal   from './components/EditTaskModal'
import LoginScreen     from './components/LoginScreen'
import styles          from './App.module.css'

export default function App() {
  const auth = useAuth()
  const { isDark, toggle } = useTheme()

  if (auth.session === undefined) return null   // checking saved login
  if (!auth.session) return <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />
  // key: a different account gets a fresh task list
  return <Workspace key={auth.user.id} isDark={isDark} onToggleTheme={toggle} onSignOut={auth.signOut} />
}

function Workspace({ isDark, onToggleTheme, onSignOut }) {
  const [activeTab, setActiveTab] = useState('today')
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(null)

  const taskData  = useTasks()
  const reminders = useReminders(taskData.tasks, taskData.loading)

  const actions = useMemo(() => ({
    toggleFocus: taskData.toggleFocus,
    markChased:  taskData.markChased,
    openEdit:    setEditing,
  }), [taskData.toggleFocus, taskData.markChased])

  const showFilter = activeTab !== 'taskmaster'
  // Keep the modal in sync with the latest saved copy of the task
  const editingTask = editing && (taskData.tasks.find(t => t.id === editing.id) || editing)

  return (
    <TaskActionsContext.Provider value={actions}>
      <div className={styles.app}>
        <Header isDark={isDark} onToggleTheme={onToggleTheme} reminders={reminders} onSignOut={onSignOut} />
        <TabNav active={activeTab} onChange={setActiveTab} />

        <main className={styles.main}>
          <QuickCapture onAdd={taskData.addTask} onEdit={setEditing} />

          {taskData.error && <p className={styles.error}>Could not load tasks: {taskData.error}</p>}

          {showFilter && (
            <RadioFilter value={catFilter} onChange={setCatFilter} />
          )}

          {activeTab === 'today'      && <TodayTab      catFilter={catFilter} taskData={taskData} onOpenTab={setActiveTab} />}
          {activeTab === 'priorities' && <PriorityTab   catFilter={catFilter} taskData={taskData} />}
          {activeTab === 'routine'    && <RoutineTab    catFilter={catFilter} taskData={taskData} />}
          {activeTab === 'scut-work'  && <ScutWorkTab   catFilter={catFilter} taskData={taskData} />}
          {activeTab === 'mission'    && <MissionTab    catFilter={catFilter} taskData={taskData} />}
          {activeTab === 'insights'   && <InsightsTab   catFilter={catFilter} taskData={taskData} />}
          {activeTab === 'taskmaster' && (
            <TaskMasterTab taskData={taskData} onAdd={() => setShowAdd(true)} />
          )}
        </main>

        {showAdd && (
          <AddTaskModal
            onClose={() => setShowAdd(false)}
            onSave={taskData.addTask}
            onSaveBulk={taskData.addTasks}
          />
        )}

        {editingTask && (
          <EditTaskModal
            task={editingTask}
            onClose={() => setEditing(null)}
            onSave={taskData.updateTask}
            onDelete={taskData.deleteTask}
          />
        )}
      </div>
    </TaskActionsContext.Provider>
  )
}
