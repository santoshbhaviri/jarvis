import { TABS } from '../lib/constants'
import styles from './TabNav.module.css'

export default function TabNav({ active, onChange }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${active === tab.key ? styles.active : ''}`}
            onClick={() => onChange(tab.key)}
          >
            <span className={styles.icon}>{tab.icon}</span>
            <span className={styles.label}>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
