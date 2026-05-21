// src/components/Header.jsx
import { format } from 'date-fns'
import styles from './Header.module.css'

export default function Header({ isDark, onToggleTheme }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Brand */}
        <div className={styles.brand}>
          <span className={styles.logo}>⚡</span>
          <span className={styles.name}>JARVIS</span>
        </div>

        {/* Right side: date + theme toggle */}
        <div className={styles.right}>
          <span className={styles.date}>{format(new Date(), 'EEE, dd MMM yyyy')}</span>

          {/* Dark / Light toggle */}
          <button
            className={styles.themeToggle}
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            <span className={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</span>
            <span className={styles.themeLabel}>{isDark ? 'Light' : 'Dark'}</span>
            {/* Toggle track */}
            <span className={`${styles.track} ${!isDark ? styles.trackOn : ''}`}>
              <span className={styles.thumb} />
            </span>
          </button>
        </div>
      </div>
    </header>
  )
}
