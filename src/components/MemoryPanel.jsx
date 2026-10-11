// Memory: what Jarvis keeps for you.
//   Library: whole documents (the Acts and Rules, notices, orders, circulars) added as a PDF, photo
//   or text file. For each question Search and Assist find the passages that fit and quote them.
//   Notes: preferences, people, facts, saved answers and Claude's saved replies, read every time.
import { useState, useEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ArrowLeft, FilePlus2, FileText, Trash2 } from 'lucide-react'
import { listMemory, addMemory, deleteMemory, listLibrary, deleteDoc } from '../lib/server'
import { ACCEPT } from '../lib/library'
import { useAddDocument } from '../hooks/useAddDocument'
import CommandBox from './CommandBox'
import SectionHeader from './SectionHeader'
import styles from './MemoryPanel.module.css'

const FROM = { you: 'You', assist: 'From Assist', search: 'From Search', claude: 'From Claude', document: 'Document' }
const day = (d) => { try { return format(new Date(d), 'd MMM') } catch { return '' } }
const OPEN_FAIL = (res) => res.why || (res.error === 'offline' ? 'No internet connection.' : "Couldn't open Memory. Try again.")

export default function MemoryPanel({ onBack }) {
  const [items, setItems]     = useState(null)
  const [docs, setDocs]       = useState(null)
  const [problem, setProblem] = useState('')
  const [text, setText]       = useState('')
  const [busy, setBusy]       = useState(false)
  const { adding, add: addDoc } = useAddDocument()
  const fileRef = useRef(null)

  useEffect(() => {
    listMemory().then(res => { if (res.error) setProblem(OPEN_FAIL(res)); else setItems(res.items) })
    listLibrary().then(res => { if (res.error) setProblem(OPEN_FAIL(res)); else setDocs((res.docs || []).filter(d => d.ready)) })
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

  const removeDoc = async (doc) => {
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    const res = await deleteDoc(doc.id)
    if (res.error) { toast.error(res.why || 'Could not delete. Try again.'); setDocs(prev => [doc, ...prev].sort((a, b) => b.at.localeCompare(a.at))) }
  }

  const pick = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const doc = await addDoc(file)
    if (doc) setDocs(prev => [doc, ...(prev || [])])
  }

  const empty = items && docs && !items.length && !docs.length && !adding

  return (
    <div className={styles.panel}>
      <div className={styles.bar}>
        <button className={styles.pill} onClick={onBack}><ArrowLeft size={15} />Chat</button>
        <button className={styles.pill} onClick={() => fileRef.current?.click()} disabled={!!adding}>
          <FilePlus2 size={15} />Add a document
        </button>
        <input ref={fileRef} type="file" accept={ACCEPT} hidden onChange={pick} aria-label="Choose a document" />
      </div>

      <CommandBox value={text} onChange={setText} onSubmit={add} busy={busy}
        placeholder="Add something to remember…" label="Add to Memory" />
      {adding && <p className={styles.progress}>{adding}</p>}
      <p className={styles.muted}>Google's free AI reads what matches each question. Leave out confidential taxpayer details.</p>

      {problem && <p className={styles.muted}>{problem}</p>}
      {empty && (
        <p className={styles.muted}>Nothing yet. Add the bare Act and Rules as PDFs, your notices and orders, and notes about your preferences and work. Search and Assist use all of it.</p>
      )}

      {docs?.length > 0 && (
        <section>
          <SectionHeader label="Library" count={docs.length} accent="var(--gold)" />
          <ul className={styles.list} aria-label="Library">
            {docs.map(d => (
              <Row key={d.id} onDelete={() => removeDoc(d)}
                head={<div className={styles.doc}><FileText size={16} /><span>{d.name}</span></div>}
                meta={`${d.pages} page${d.pages === 1 ? '' : 's'} · ${day(d.at)}`} />
            ))}
          </ul>
        </section>
      )}

      {items?.length > 0 && (
        <section>
          <SectionHeader label="Notes" count={items.length} />
          <ul className={styles.list} aria-label="Memory">
            {items.map(m => <Row key={m.id} onDelete={() => remove(m)} title={m.title} text={m.text} meta={`${FROM[m.from] || 'You'} · ${day(m.at)}`} />)}
          </ul>
        </section>
      )}
    </div>
  )
}

// Long notes open on tap; the bin asks once more before deleting
function Row({ head, title, text, meta, onDelete }) {
  const [open, setOpen] = useState(false)
  const [sure, setSure] = useState(false)
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t) }, [sure])
  return (
    <li className={styles.note}>
      {head}
      {title && <div className={styles.title}>{title}</div>}
      {text && <p className={open ? '' : styles.clamp} onClick={() => setOpen(o => !o)}>{text}</p>}
      <div className={styles.foot}>
        <small>{meta}</small>
        {sure
          ? <button className={styles.sure} onClick={onDelete}>Delete?</button>
          : <button className={styles.bin} onClick={() => setSure(true)} aria-label="Delete"><Trash2 size={15} /></button>}
      </div>
    </li>
  )
}
