// src/components/Header.jsx
import toast from 'react-hot-toast'
import { Bell, BellOff, Sun, Moon, LogOut } from 'lucide-react'
import Monogram from './Monogram'
import styles from './Header.module.css'

export default function Header({ isDark, onToggleTheme, reminders, onSignOut }) {
  const bell = async () => {
    if (reminders.permission === 'granted') {
      toast(reminders.pushConfigured
        ? 'Reminders are on. You get a summary every morning.'
        : 'Reminders are on while JARVIS is open. Finish the push setup in the README for reminders when it is closed.', { duration: 5000 })
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
        <div className={styles.brand}>
          <Monogram size={30} />
          <span className={styles.name}>Jarvis</span>
        </div>

        <div className={styles.right}>
          <button className={styles.iconBtn} onClick={bell} aria-label="Reminders"
            title={reminders.permission === 'granted' ? 'Reminders are on' : 'Turn on reminders'}>
            {reminders.permission === 'granted' ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
          <button className={styles.iconBtn} onClick={onToggleTheme} aria-label="Toggle theme"
            title={isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}>
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className={styles.iconBtn} onClick={onSignOut} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button>
        </div>
      </div>
    </header>
  )
}
