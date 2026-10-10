// src/App.jsx
import { useState, useEffect, useCallback } from 'react'
import { useAuth }      from './hooks/useAuth'
import { useTasks }     from './hooks/useTasks'
import { useTheme }     from './hooks/useTheme'
import { useReminders } from './hooks/useReminders'
import Header        from './components/Header'
import TabNav        from './components/TabNav'
import TodayTab      from './components/TodayTab'
import TrackerTab    from './components/TrackerTab'
import DoneTab       from './components/DoneTab'
import SearchTab     from './components/SearchTab'
import AssistTab     from './components/AssistTab'
import EvolveTab     from './components/EvolveTab'
import { isReady, listUpdates } from './lib/server'
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
  const [updates, setUpdates]     = useState(null)    // changes Claude built, waiting for you
  const [ghReady, setGhReady]     = useState(null)    // GitHub key added in Netlify

  const loadUpdates = useCallback(async () => {
    const ok = await isReady('jarvis-github')
    setGhReady(ok)
    if (!ok) return
    const res = await listUpdates()
    if (!res.error) setUpdates(res)
  }, [])
  useEffect(() => { loadUpdates() }, [loadUpdates])
  const waiting = updates?.updates?.length || 0

  const taskData  = useTasks()
  const reminders = useReminders(taskData.tasks, taskData.loading)

  // Keep the modal in sync with the latest saved copy of the task
  const editingTask = editing && (taskData.tasks.find(t => t.id === editing.id) || editing)

  return (
    <div className={styles.app}>
      <Header isDark={isDark} onToggleTheme={onToggleTheme} reminders={reminders} onSignOut={onSignOut} />
      <TabNav active={activeTab} onChange={setActiveTab} badges={{ evolve: waiting }} />

      <main className={styles.main}>
        {activeTab === 'today' && <InstallBanner />}
        {taskData.offline && (
          <p className={styles.offline}>Offline{taskData.pending ? ` · ${taskData.pending} change${taskData.pending > 1 ? 's' : ''} will sync` : ''}</p>
        )}
        {taskData.error && <p className={styles.error}>Could not load tasks: {taskData.error}</p>}
        {taskData.loading && !taskData.tasks.length && <p className={styles.loading}>Loading…</p>}

        {activeTab === 'today'   && <TodayTab   taskData={taskData} onEdit={setEditing} />}
        {activeTab === 'tracker' && <TrackerTab taskData={taskData} onEdit={setEditing} />}
        {activeTab === 'search'  && <SearchTab />}
        {activeTab === 'assist'  && <AssistTab  taskData={taskData} />}
        {activeTab === 'evolve'  && <EvolveTab  data={updates} ready={ghReady} onChanged={loadUpdates} />}
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
