// src/components/QuickCapture.jsx
// One box at the top of every tab: speak or type a task in plain words.
import { useState, useRef } from 'react'
import toast from 'react-hot-toast'
import { parseTask } from '../lib/parseTask'
import { STATUSES } from '../lib/constants'
import { formatDisplay } from '../lib/dateUtils'
import styles from './QuickCapture.module.css'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function QuickCapture({ onAdd, onEdit }) {
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
    toast.success(t => (
      <span onClick={() => { toast.dismiss(t.id); onEdit(data) }} style={{ cursor: 'pointer' }}>
        Added to {STATUSES[data.status].label}. Tap to edit
      </span>
    ))
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
          placeholder="Say or type: Follow up with DEO on survey by Friday !"
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
          {STATUSES[preview.status].label}
          {preview.due_date && ` · due ${formatDisplay(preview.due_date)}`}
          {preview.important && ' · Important'}
          {preview.urgent && ' · Urgent'}
          {preview.waiting_on && ` · follow up with ${preview.waiting_on}`}
          {` · ${preview.category}`}
        </p>
      )}
      {!listening && !preview && (
        <p className={styles.hint}>Understands dates (tomorrow, Friday, 15 Oct), “follow up with …”, #personal, “daily”, and ! for important.</p>
      )}
    </form>
  )
}
