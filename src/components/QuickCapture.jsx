// src/components/QuickCapture.jsx
// One box at the top of every tab: speak or type a task in plain words.
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { parseTask } from '../lib/parseTask'
import { formatDisplay, todayStr } from '../lib/dateUtils'
import styles from './QuickCapture.module.css'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function QuickCapture({ onAdd }) {
  const [text, setText]           = useState('')
  const [listening, setListening] = useState(false)
  const [saving, setSaving]       = useState(false)
  const recRef = useRef(null)

  const preview = text.trim() ? parseTask(text) : null

  const submit = async (e) => {
    e?.preventDefault()
    if (!preview || saving) return
    setSaving(true)
    const { data, error } = await onAdd(preview)
    setSaving(false)
    if (error) { toast.error(`Save failed: ${error.message}`); return }
    setText('')
    toast.success(data.status === 'routine'
      ? 'Added to Tracker'
      : data.due_date === todayStr() ? 'Added to today' : `Planned for ${formatDisplay(data.due_date)}`)
  }

  const toggleMic = () => {
    if (!SpeechRecognition) {
      toast('Voice is not supported in this browser. Use the mic key on your keyboard instead.', { icon: '🎙️', duration: 5000 })
      return
    }
    if (listening) { recRef.current?.stop(); return }
    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.interimResults = true
    const before = text ? text + ' ' : ''
    rec.onresult = (ev) => {
      let said = ''
      for (const r of ev.results) said += r[0].transcript
      setText(before + said)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') toast.error('Allow microphone access to add tasks by voice')
    }
    rec.onend = () => setListening(false)
    recRef.current = rec
    rec.start()
    setListening(true)
  }

  return (
    <form className={styles.wrap} onSubmit={submit}>
      <div className={styles.bar}>
        <input
          className={styles.input}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Say or type a task, e.g. Call DEO about survey"
          aria-label="New task"
        />
        <button type="button" onClick={toggleMic}
          className={`${styles.mic} ${listening ? styles.micOn : ''}`}
          aria-label={listening ? 'Stop listening' : 'Speak a task'} title="Speak a task">
          🎙️
        </button>
        <button type="submit" className={styles.add} disabled={!preview || saving}>
          {saving ? '…' : 'Add'}
        </button>
      </div>
      {listening && <p className={styles.hint}>Listening… speak your task, then tap Add.</p>}
      {!listening && preview && (
        <p className={styles.hint}>
          {preview.status === 'routine'
            ? 'Daily habit → Tracker'
            : preview.due_date === todayStr() ? 'Today' : formatDisplay(preview.due_date)}
          {preview.important && ' · ★ Important'}
          {` · ${preview.category === 'work' ? 'Work' : 'Personal'}`}
        </p>
      )}
      {!listening && !preview && (
        <p className={styles.hint}>Add a day (tomorrow, Friday, 15 Oct) to plan ahead, #personal for home, ! to highlight.</p>
      )}
    </form>
  )
}
