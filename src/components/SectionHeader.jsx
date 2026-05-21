import styles from './SectionHeader.module.css'
export default function SectionHeader({ label, count, accent }) {
  return (
    <div className={styles.wrap}>
      <span className={styles.line} style={accent ? {background: accent} : {}} />
      <span className={styles.label}>{label}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </div>
  )
}
