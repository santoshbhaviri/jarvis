// Memory: what Jarvis keeps for you. Type a note or preference, or add a PDF or photo of a
// notice or order (Gemini reads it and keeps the key points). Search and Assist read all of
// this before they answer. Saved answers and Claude's saved replies show here too.
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ArrowLeft, FilePlus2, Trash2 } from 'lucide-react'
import { listMemory, addMemory, deleteMemory, readDocument } from '../lib/server'
import CommandBox from './CommandBox'
import styles from './MemoryPanel.module.css'

const FROM = { you: 'You', assist: 'From Assist', search: 'From Search', claude: 'From Claude', document: 'Document' }
const MAX_FILE = 4 * 1024 * 1024
const day = (d) => { try { return format(new Date(d), 'd MMM') } catch { return '' } }

const dataUrl = (blob) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = reject
  r.readAsDataURL(blob)
})

// A PDF goes as it is; a photo is made smaller first (phone photos are large), as a JPEG
async function prepare(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_FILE) throw new Error('This PDF is too big (over 4 MB). Try a smaller one, or a photo of the main pages.')
    return { type: file.type, data: (await dataUrl(file)).split(',')[1] }
  }
  if (!file.type.startsWith('image/')) throw new Error('Jarvis reads PDFs and photos only.')
  try {
    const img = await createImageBitmap(file)
    const scale = Math.min(1, 2000 / Math.max(img.width, img.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale)
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
    return { type: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.85).split(',')[1] }
  } catch {
    if (file.size > MAX_FILE) throw new Error('This photo is too big (over 4 MB).')
    return { type: file.type, data: (await dataUrl(file)).split(',')[1] }
  }
}

export default function MemoryPanel({ onBack }) {
  const [items, setItems]     = useState(null)
  const [problem, setProblem] = useState('')
  const [text, setText]       = useState('')
  const [busy, setBusy]       = useState(false)
  const [reading, setReading] = useState('')     // the document being read
  const fileRef = useRef(null)

  useEffect(() => {
    listMemory().then(res => {
      if (res.error) setProblem(res.why || (res.error === 'offline' ? 'No internet connection.' : "Couldn't open Memory. Try again."))
      else setItems(res.items)
    })
  }, [])

  const add = async (said) => {
    setBusy(true)
    const res = await addMemory(said, 'you')
    setBusy(false)
    if (res.error) { toast.error(res.why || 'Could not save. Try again.'); return }
    setText('')
    setItems(prev => [res.item, ...(prev || [])])
  }

  const remove = async (item) => {
    setItems(prev => prev.filter(m => m.id !== item.id))
    const res = await deleteMemory(item.id)
    if (res.error) { toast.error(res.why || 'Could not delete. Try again.'); setItems(prev => [item, ...prev].sort((a, b) => b.at.localeCompare(a.at))) }
  }

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setReading(file.name || 'your document')
    try {
      const res = await readDocument({ name: file.name, ...(await prepare(file)) })
      if (res.error) throw new Error(res.why || "Couldn't read it. Try again.")
      setItems(prev => [res.item, ...(prev || [])])
      toast.success('Read and saved to Memory')
    } catch (err) {
      toast.error(err.message, { duration: 6000 })
    }
    setReading('')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <button className={styles.pill} onClick={onBack}><ArrowLeft size={15} />Chat</button>
        <button className={styles.pill} onClick={() => fileRef.current?.click()} disabled={!!reading}>
          <FilePlus2 size={15} />Add a document
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,image/*" hidden onChange={pick} aria-label="Choose a PDF or photo" />
      </div>

      <CommandBox value={text} onChange={setText} onSubmit={add} busy={busy}
        placeholder="Add something to remember…" label="Add to Memory" />
      {reading && <p className={styles.muted}>Reading {reading}…</p>}
      <p className={styles.muted}>Google's free AI reads Memory with every question. Leave out confidential taxpayer details.</p>

      {problem && <p className={styles.muted}>{problem}</p>}
      {items && !items.length && !reading && (
        <p className={styles.muted}>Nothing yet. Add your preferences, people, facts about your work, or a PDF or photo of a notice or order. Search and Assist use all of it.</p>
      )}
      {items?.length > 0 && (
        <ul className={styles.list} aria-label="Memory">
          {items.map(m => <Note key={m.id} m={m} onDelete={() => remove(m)} />)}
        </ul>
      )}
    </div>
  )
}

// Long notes open on tap; the bin asks once more before deleting
function Note({ m, onDelete }) {
  const [open, setOpen] = useState(false)
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t) }, [sure])
  return (
    <li className={styles.note}>
      {m.title && <div className={styles.title}>{m.title}</div>}
      <p className={open ? '' : styles.clamp} onClick={() => setOpen(o => !o)}>{m.text}</p>
      <div className={styles.foot}>
        <small>{FROM[m.from] || 'You'} · {day(m.at)}</small>
        {sure
          ? <button className={styles.sure} onClick={onDelete}>Delete?</button>
          : <button className={styles.bin} onClick={() => setSure(true)} aria-label="Delete"><Trash2 size={15} /></button>}
      </div>
    </li>
  )
}
