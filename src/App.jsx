// src/App.jsx
import { useState } from 'react'
import { useTasks }    from './hooks/useTasks'
import { useTheme }    from './hooks/useTheme'
import Header          from './components/Header'
import TabNav          from './components/TabNav'
import RadioFilter     from './components/RadioFilter'
import RoutineTab      from './components/RoutineTab'
import ScutWorkTab     from './components/ScutWorkTab'
import MissionTab      from './components/MissionTab'
import TaskMasterTab   from './components/TaskMasterTab'
import AddTaskModal    from './components/AddTaskModal'
import styles          from './App.module.css'

export default function App() {
  const [activeTab, setActiveTab] = useState('routine')
  const [catFilter, setCatFilter] = useState('all')
  const [showAdd, setShowAdd]     = useState(false)

  const taskData        = useTasks()
  const { isDark, toggle } = useTheme()

  const showFilter = activeTab !== 'taskmaster'

  return (
    <div className={styles.app}>
      <Header isDark={isDark} onToggleTheme={toggle} />
      <TabNav active={activeTab} onChange={setActiveTab} />

      <main className={styles.main}>
        {showFilter && (
          <RadioFilter value={catFilter} onChange={setCatFilter} />
        )}

        {activeTab === 'routine'    && <RoutineTab    catFilter={catFilter} taskData={taskData} />}
        {activeTab === 'scut-work'  && <ScutWorkTab   catFilter={catFilter} taskData={taskData} />}
        {activeTab === 'mission'    && <MissionTab    catFilter={catFilter} taskData={taskData} />}
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
    </div>
  )
}
