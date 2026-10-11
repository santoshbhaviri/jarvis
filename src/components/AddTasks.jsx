// Add tasks by typing or speaking. One sentence can hold several tasks, each on its own day:
// "Call DEO tomorrow and send the survey report on 21st" → two tasks.
import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'
import { Star, Repeat, Hourglass, Check } from 'lucide-react'
import { parseCommand } from '../lib/parseTask'
import { usualTasks } from '../lib/memory'
import { todayStr } from '../lib/dateUtils'
import CommandBox from './CommandBox'
import styles from './AddTasks.module.css'

const dayLabel = (t) => t.status === 'routine' ? 'Daily habit'
  : t.due_date === todayStr() ? 'Today' : format(parseISO(t.due_date), 'EEE d MMM')

export default function AddTasks({ taskData }) {
  const { tasks, addTask, deleteTask } = taskData
  const [text, setText]       = useState('')
  const [focused, setFocused] = useState(false)
  const q = text.trim()
  const preview = q ? parseCommand(q) : []
  const usual = !q && focused ? usualTasks(tasks) : []

  const addAll = useCallback(async (said) => {
    const added = []
    for (const t of parseCommand(said)) {
      const { data, error } = await addTask(t)
      if (error) { toast.error(`Could not save "${t.title}"`); continue }
      added.push(data)
    }
    if (!added.length) return
    setText('')
    const undo = async (id) => { toast.dismiss(id); for (const t of added) await deleteTask(t.id) }
    toast((tt) => (
      <span className={styles.toast}>
        <Check size={16} className={styles.ok} />
        <span>{added.length === 1 ? `${added[0].title} · ${dayLabel(added[0])}` : `${added.length} tasks added`}</span>
        <button onClick={() => undo(tt.id)}>Undo</button>
      </span>
    ), { duration: 5000 })
  }, [addTask, deleteTask])

  return (
    <div className={styles.wrap}>
      <CommandBox value={text} onChange={setText} onSubmit={addAll}
        placeholder="Add a task…" label="Add a task"
        onFocus={() => setFocused(true)} onBlur={() => setTimeout(() => setFocused(false), 200)} />
      {preview.length > 0 && (
        <ul className={styles.preview} aria-label="Preview">
          {preview.map((t, i) => (
            <li key={i}><span className={styles.pTitle}>{t.important && <Star size={14} className={styles.star} />}{t.title}</span>
              <small>{t.notes?.startsWith('↻ ') && <Repeat size={12} />}{t.follow_up && <Hourglass size={12} />}{dayLabel(t)}</small></li>
          ))}
        </ul>
      )}
      {usual.length > 0 && (
        <div className={styles.usual}>
          {usual.map(t => <button key={t} className={styles.chip} onClick={() => addAll(t)}>+ {t}</button>)}
        </div>
      )}
    </div>
  )
}
