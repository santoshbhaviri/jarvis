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
import { isReady, listUpdates, knowledgeStatus } from './lib/server'
import { moveAll } from './lib/knowledge'
import { HOME, isTestCopy } from './lib/constants'
import EditTaskModal from './components/EditTaskModal'
import InstallBanner from './components/InstallBanner'
import LoginScreen   from './components/LoginScreen'
import styles        from './App.module.css'

const SEEN = 'jarvis-replies-seen'   // when you last read Claude's replies in Evolve

export default function App() {
  const auth = useAuth()
  const { isDark, toggle } = useTheme()

  if (auth.session === undefined) return null   // checking saved login
  return (
    <>
      {isTestCopy && <TestCopy />}
      {!auth.session
        ? <LoginScreen onSignIn={auth.signIn} onSignUp={auth.signUp} />
        // key: a different account gets a fresh task list
        : <Workspace key={auth.user.id} isDark={isDark} onToggleTheme={toggle} onSignOut={auth.signOut} />}
    </>
  )
}

// An update preview looks just like Jarvis but never changes again, so a home-screen icon
// made from one stays stuck on that version. Say so on every screen.
function TestCopy() {
  return (
    <p className={styles.testCopy}>
      Test copy of one update. Your Jarvis is <a href={`https://${HOME}`}>{HOME}</a>
    </p>
  )
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
  useEffect(() => {
    loadUpdates()
    // Coming back to Jarvis picks up Claude's new replies and updates
    const back = () => { if (document.visibilityState === 'visible') loadUpdates() }
    document.addEventListener('visibilitychange', back)
    return () => document.removeEventListener('visibilitychange', back)
  }, [loadUpdates])
  const waiting = updates?.updates?.length || 0

  // Once the setup code has run in your Supabase, your Knowledge moves there by itself
  useEffect(() => { knowledgeStatus(true).then(s => { if (s.move) moveAll() }) }, [])

  // Replies you haven't seen count on the Evolve tab until you open it. `shown` keeps the
  // earlier mark while you're on the tab, so the new ones stay marked New there.
  const [seen, setSeen]   = useState(() => { try { return localStorage.getItem(SEEN) || '' } catch { return '' } })
  const [shown, setShown] = useState(seen)
  const newest = updates?.replies?.[0]?.at || ''
  const unseen = (updates?.replies || []).filter(r => r.at > seen).length
  useEffect(() => {
    if (activeTab !== 'evolve') { setShown(seen); return }
    if (!newest || newest <= seen) return
    setShown(seen); setSeen(newest)
    try { localStorage.setItem(SEEN, newest) } catch { /* private mode */ }
  }, [activeTab, newest, seen])

  const taskData  = useTasks()
  const reminders = useReminders(taskData.tasks, taskData.loading)

  // Keep the modal in sync with the latest saved copy of the task
  const editingTask = editing && (taskData.tasks.find(t => t.id === editing.id) || editing)

  return (
    <div className={styles.app}>
      <Header isDark={isDark} onToggleTheme={onToggleTheme} reminders={reminders} onSignOut={onSignOut} />
      <TabNav active={activeTab} onChange={setActiveTab} badges={{ evolve: waiting + unseen }} />

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
        {activeTab === 'evolve'  && <EvolveTab  data={updates} ready={ghReady} onChanged={loadUpdates} seen={shown} />}
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
