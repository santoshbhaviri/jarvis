// src/components/Header.jsx
import styles from './Header.module.css'
import { format } from 'date-fns'

export default function Header({ onAddClick }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.logo}>⚡</span>
          <div>
            <h1 className={styles.title}>TaskFlow</h1>
            <p className={styles.date}>{format(new Date(), 'EEE, dd MMM yyyy')}</p>
          </div>
        </div>
        <button className={styles.addBtn} onClick={onAddClick}>
          <span className={styles.plus}>+</span>
          <span>Add Tasks</span>
        </button>
      </div>
    </header>
  )
}
