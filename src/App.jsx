// src/App.jsx
import { useState } from 'react'
import { useAuth }      from './hooks/useAuth'
import { useTasks }     from './hooks/useTasks'
import { useTheme }     from './hooks/useTheme'
import { useReminders } from './hooks/useReminders'
import Header        from './components/Header'
import TabNav        from './components/TabNav'
import TodayTab      from './components/TodayTab'
import TrackerTab    from './components/TrackerTab'
import DoneTab       from './components/DoneTab'
import EditTaskModal from './components/EditTaskModal'
import InstallBanner from './components/InstallBanner'
import LoginScreen   from './components/LoginScreen'
import styles        from './App.module.css'

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
  const [editing, setEditing]     = useState(null)

  const taskData  = useTasks()
  const reminders = useReminders(taskData.tasks, taskData.loading)

  // Keep the modal in sync with the latest saved copy of the task
  const editingTask = editing && (taskData.tasks.find(t => t.id === editing.id) || editing)

  return (
    <div className={styles.app}>
      <Header isDark={isDark} onToggleTheme={onToggleTheme} reminders={reminders} onSignOut={onSignOut} />
      <TabNav active={activeTab} onChange={setActiveTab} />

      <main className={styles.main}>
        <InstallBanner />
        {taskData.error && <p className={styles.error}>Could not load tasks: {taskData.error}</p>}
        {taskData.loading && !taskData.tasks.length && <p className={styles.loading}>Loading…</p>}

        {activeTab === 'today'   && <TodayTab   taskData={taskData} onEdit={setEditing} />}
        {activeTab === 'tracker' && <TrackerTab taskData={taskData} onEdit={setEditing} />}
        {activeTab === 'done'    && <DoneTab    taskData={taskData} />}
      </main>

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditing(null)}
          onSave={taskData.updateTask}
          onDelete={taskData.deleteTask}
        />
      )}
    </div>
  )
}
