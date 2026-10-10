// The Jarvis mark: a gold serif "J" on midnight, the same as the home-screen icon
import styles from './Monogram.module.css'

export default function Monogram({ size = 30 }) {
  return <span className={styles.mark} style={{ width: size, height: size, fontSize: size * 0.72 }} aria-hidden="true">J</span>
}
