// src/components/StatsBar.jsx
import { useMemo } from 'react'
import styles from './StatsBar.module.css'
import { daysLeft } from '../lib/dateUtils'
import { today } from '../lib/dateUtils'

export default function StatsBar({ tasks }) {
  const todayStr = today()
  const stats = useMemo(() => [
    { num: tasks.filter(t => t.status !== 'done').length,                        label: 'Active',     icon: '🔄' },
    { num: tasks.filter(t => t.followup_date === todayStr && t.status !== 'done').length, label: 'Follow-ups', icon: '↻' },
    { num: tasks.filter(t => daysLeft(t.due_date) < 0 && t.status !== 'done').length,    label: 'Overdue',    icon: '⚠️' },
    { num: tasks.filter(t => t.status === 'done').length,                        label: 'Done',       icon: '✓' },
  ], [tasks, todayStr])

  return (
    <div className={styles.bar}>
      {stats.map(s => (
        <div key={s.label} className={styles.stat}>
          <span className={styles.num}>{s.num}</span>
          <span className={styles.label}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}
