import { TABS } from '../lib/constants'
import styles from './TabNav.module.css'

export default function TabNav({ active, onChange, badges = {} }) {
  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            className={`${styles.tab} ${active === tab.key ? styles.active : ''}`}
            onClick={() => onChange(tab.key)}
            aria-current={active === tab.key ? 'page' : undefined}
          >
            <tab.icon size={21} className={styles.icon} />
            <span className={styles.label}>{tab.label}</span>
            {badges[tab.key] > 0 && <span className={styles.badge} aria-label={`${badges[tab.key]} waiting`}>{badges[tab.key]}</span>}
          </button>
        ))}
      </div>
    </nav>
  )
}
