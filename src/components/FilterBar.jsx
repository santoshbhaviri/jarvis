// src/components/FilterBar.jsx
import styles from './FilterBar.module.css'
import { CATEGORIES, PRIORITIES, STATUSES } from '../lib/constants'

export default function FilterBar({
  category, onCategory,
  priority, onPriority,
  status,   onStatus,
  search,   onSearch,
}) {
  return (
    <div className={styles.wrap}>
      <div className={styles.searchRow}>
        <span className={styles.searchIcon}>🔍</span>
        <input
          className={styles.search}
          placeholder="Search tasks…"
          value={search}
          onChange={e => onSearch(e.target.value)}
        />
        {search && (
          <button className={styles.clearBtn} onClick={() => onSearch('')}>✕</button>
        )}
      </div>
      <div className={styles.selects}>
        <select className={styles.sel} value={category} onChange={e => onCategory(e.target.value)}>
          <option value="all">All Categories</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        <select className={styles.sel} value={priority} onChange={e => onPriority(e.target.value)}>
          <option value="all">All Priorities</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
        <select className={styles.sel} value={status} onChange={e => onStatus(e.target.value)}>
          <option value="all">All Statuses</option>
          {Object.entries(STATUSES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
