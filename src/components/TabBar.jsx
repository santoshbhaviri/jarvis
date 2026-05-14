// src/components/TabBar.jsx
import styles from './TabBar.module.css'

const TABS = [
  { key: 'all',      label: 'All' },
  { key: 'today',    label: 'Today' },
  { key: 'followup', label: '↻ Follow-up' },
]

export default function TabBar({ counts, active, onChange }) {
  return (
    <div className={styles.wrap}>
      {TABS.map(tab => (
        <button
          key={tab.key}
          className={`${styles.tab} ${active === tab.key ? styles.active : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className={styles.count}>{counts[tab.key] ?? 0}</span>
        </button>
      ))}
    </div>
  )
}
