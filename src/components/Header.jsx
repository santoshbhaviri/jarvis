// src/components/Header.jsx
import toast from 'react-hot-toast'
import styles from './Header.module.css'

export default function Header({ isDark, onToggleTheme, reminders, onSignOut }) {
  const bell = async () => {
    if (reminders.permission === 'granted') {
      toast(reminders.pushConfigured
        ? 'Reminders are on. You get a summary every morning.'
        : 'Reminders are on while JARVIS is open. Finish the push setup in the README for reminders when it is closed.', { icon: '🔔', duration: 5000 })
      return
    }
    if (reminders.permission === 'denied') {
      toast.error('Notifications are blocked. Allow them for this site in your browser settings.')
      return
    }
    const p = await reminders.enable()
    if (p === 'granted') toast.success('Reminders turned on')
    else if (p === 'unsupported') toast.error('This browser cannot show reminders. On iPhone, add JARVIS to the Home Screen first.')
  }

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        {/* Brand */}
        <div className={styles.brand}>
          <span className={styles.logo}>⚡</span>
          <span className={styles.name}>JARVIS</span>
        </div>

        {/* Right side: reminders, theme, sign out */}
        <div className={styles.right}>
          <button
            className={styles.iconBtn}
            onClick={bell}
            title={reminders.permission === 'granted' ? 'Reminders are on' : 'Turn on reminders'}
            aria-label="Reminders"
          >{reminders.permission === 'granted' ? '🔔' : '🔕'}</button>

          {/* Dark / Light toggle */}
          <button
            className={styles.themeToggle}
            onClick={onToggleTheme}
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
            aria-label="Toggle theme"
          >
            <span className={styles.themeIcon}>{isDark ? '☀️' : '🌙'}</span>
            {/* Toggle track */}
            <span className={`${styles.track} ${!isDark ? styles.trackOn : ''}`}>
              <span className={styles.thumb} />
            </span>
          </button>

          <button className={styles.iconBtn} onClick={onSignOut} title="Sign out" aria-label="Sign out">🚪</button>
        </div>
      </div>
    </header>
  )
}
