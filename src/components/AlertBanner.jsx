// src/components/AlertBanner.jsx
import styles from './AlertBanner.module.css'

export default function AlertBanner({ overdueList, followupToday }) {
  if (!overdueList.length && !followupToday.length) return null
  return (
    <div className={styles.wrap}>
      {overdueList.length > 0 && (
        <div className={`${styles.alert} ${styles.danger}`}>
          <span className={styles.icon}>🔴</span>
          <span>
            <strong>{overdueList.length} overdue:</strong>{' '}
            {overdueList.map(t => t.title).join(', ')}
          </span>
        </div>
      )}
      {followupToday.length > 0 && (
        <div className={`${styles.alert} ${styles.warn}`}>
          <span className={styles.icon}>🟡</span>
          <span>
            <strong>Follow-up today:</strong>{' '}
            {followupToday.map(t => t.title).join(', ')}
          </span>
        </div>
      )}
    </div>
  )
}
