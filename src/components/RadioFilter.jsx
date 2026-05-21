import styles from './RadioFilter.module.css'

const OPTIONS = [
  { value: 'all',      label: 'All' },
  { value: 'work',     label: 'Work' },
  { value: 'personal', label: 'Personal' },
]

export default function RadioFilter({ value, onChange }) {
  return (
    <div className={styles.wrap}>
      {OPTIONS.map(o => (
        <label key={o.value} className={`${styles.opt} ${value === o.value ? styles.active : ''}`}>
          <input
            type="radio" name="catFilter"
            value={o.value} checked={value === o.value}
            onChange={() => onChange(o.value)}
            className={styles.radio}
          />
          <span className={styles.dot} />
          {o.label}
        </label>
      ))}
    </div>
  )
}
