// Knowledge: what Jarvis keeps for you and learns from.
//   Library: whole documents (the Acts and Rules, notices, orders, circulars) added as a PDF, photo
//   or text file. For each question Search and Assist find the passages that fit and quote them.
//   Notes: preferences, people, facts, saved answers, Claude's saved replies and what Jarvis
//   learned from your chats, read every time. Tap the pencil to correct one.
//   Chats: once Knowledge is in your own Supabase, Assist keeps each question and answer there
//   and recalls the ones that help with a new question.
// Until the setup code has run in your Supabase, all of it is kept on Netlify; the card at the top
// walks through the one-time setup, then moves everything across (nothing on Netlify is deleted).
import { useState, useEffect, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { ArrowLeft, ArrowUpRight, Check, ClipboardCopy, Database, FilePlus2, FileText, Pencil, Trash2 } from 'lucide-react'
import { listMemory, addMemory, editMemory, deleteMemory, listLibrary, deleteDoc, knowledgeStatus, forgetChats } from '../lib/server'
import { moveAll, moving, onMove } from '../lib/knowledge'
import { ACCEPT } from '../lib/library'
import { useAddDocument } from '../hooks/useAddDocument'
import SETUP_CODE from '../../supabase-knowledge.sql?raw'
import CommandBox from './CommandBox'
import SectionHeader from './SectionHeader'
import styles from './KnowledgePanel.module.css'

const FROM = { you: 'You', assist: 'From Assist', search: 'From Search', claude: 'From Claude', learned: 'Learned by Jarvis', document: 'Document' }
const day = (d) => { try { return format(new Date(d), 'd MMM') } catch { return '' } }
const OPEN_FAIL = (res) => res.why || (res.error === 'offline' ? 'No internet connection.' : "Couldn't open Knowledge. Try again.")
const byNewest = (a, b) => b.at.localeCompare(a.at)

export default function KnowledgePanel({ onBack }) {
  const [items, setItems]     = useState(null)
  const [docs, setDocs]       = useState(null)
  const [store, setStore]     = useState(null)    // { where, setUp, sql, counts }
  const [problem, setProblem] = useState('')
  const [text, setText]       = useState('')
  const [busy, setBusy]       = useState(false)
  const { adding, add: addDoc } = useAddDocument()
  const fileRef = useRef(null)

  const load = useCallback(() => {
    listMemory().then(res => { if (res.error) setProblem(OPEN_FAIL(res)); else setItems(res.items) })
    listLibrary().then(res => { if (res.error) setProblem(OPEN_FAIL(res)); else setDocs((res.docs || []).filter(d => d.ready)) })
    knowledgeStatus().then(res => { if (!res.error) setStore(res) })
  }, [])
  useEffect(load, [load])

  const add = async (said) => {
    setBusy(true)
    const res = await addMemory(said, 'you')
    setBusy(false)
    if (res.error) { toast.error(res.why || 'Could not save. Try again.'); return }
    setText('')
    setItems(prev => [res.item, ...(prev || [])])
  }

  const edit = async (item, said) => {
    const res = await editMemory(item.id, said)
    if (res.error) { toast.error(res.why || 'Could not save. Try again.'); return false }
    setItems(prev => prev.map(m => m.id === item.id ? res.item : m))
    return true
  }

  const remove = async (item) => {
    setItems(prev => prev.filter(m => m.id !== item.id))
    const res = await deleteMemory(item.id)
    if (res.error) { toast.error(res.why || 'Could not delete. Try again.'); setItems(prev => [item, ...prev].sort(byNewest)) }
  }

  const removeDoc = async (doc) => {
    setDocs(prev => prev.filter(d => d.id !== doc.id))
    const res = await deleteDoc(doc.id)
    if (res.error) { toast.error(res.why || 'Could not delete. Try again.'); setDocs(prev => [doc, ...prev].sort(byNewest)) }
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

      <h2 className={styles.head}>Your Knowledge</h2>
      <Store store={store} onMoved={load} onForgot={() => setStore(s => ({ ...s, counts: { ...s.counts, chats: 0 } }))} />

      <CommandBox value={text} onChange={setText} onSubmit={add} busy={busy}
        placeholder="Add something to remember…" label="Add to Knowledge" />
      {adding && <p className={styles.progress}>{adding}</p>}
      <p className={styles.muted}>The AI reads only what matches each question. Leave out confidential taxpayer details.</p>

      {problem && <p className={styles.muted}>{problem}</p>}
      {empty && (
        <p className={styles.muted}>Nothing yet. Add the bare Act and Rules as PDFs, your notices and orders, and notes about your preferences and work. Search and Assist use all of it, and Jarvis adds what it learns from your chats.</p>
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
          <ul className={styles.list} aria-label="Notes">
            {items.map(m => (
              <Row key={m.id} onDelete={() => remove(m)} onEdit={(said) => edit(m, said)}
                title={m.title} text={m.text} meta={`${FROM[m.from] || 'You'} · ${day(m.at)}`} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// Where it's kept. On Netlify: the one-time setup for your own Supabase, then the move.
// In Supabase: one line, and the chats Jarvis remembers (with Forget).
function Store({ store, onMoved, onForgot }) {
  const [step, setStep] = useState(() => (moving() ? {} : null))   // moving: { docs, of }
  const [code, setCode] = useState(false)                             // copying failed: show the code
  const [sure, setSure] = useState(false)
  useSure(sure, setSure)

  useEffect(() => onMove(res => {
    if (res.error) setStep(null)
    else if (res.done) { setStep(null); onMoved() }
    else setStep(res)
  }), [onMoved])

  if (!store) return null

  if (step) {
    return (
      <p className={styles.moving}>
        <Database size={15} />
        Moving into your Supabase{step.of ? ` · ${step.docs} of ${step.of} document${step.of === 1 ? '' : 's'}` : '…'}
      </p>
    )
  }

  if (store.where === 'supabase') {
    const chats = store.counts?.chats || 0
    const forget = async () => {
      setSure(false)
      const res = await forgetChats()
      if (res.error) { toast.error(res.why || 'Could not do that. Try again.'); return }
      onForgot(); toast.success('Chats forgotten')
    }
    return (
      <div className={styles.kept}>
        <span><Database size={14} />In your own Supabase{chats ? ` · ${chats} chat${chats === 1 ? '' : 's'} remembered` : ''}</span>
        {chats > 0 && (sure
          ? <button className={styles.sure} onClick={forget}>Forget all chats?</button>
          : <button className={styles.link} onClick={() => setSure(true)}>Forget chats</button>)}
      </div>
    )
  }

  if (store.setUp !== false) return null   // Supabase couldn't be reached just now, or the move starts by itself

  const copy = async () => {
    try { await navigator.clipboard.writeText(SETUP_CODE); toast.success('Setup code copied') }
    catch { setCode(true) }
  }
  const done = async () => {
    setStep({})
    const res = await moveAll()
    if (res.error) toast.error(res.why || "Couldn't reach your Supabase. Try again.")
  }
  return (
    <section className={styles.setup} aria-label="Keep it in your own Supabase">
      <div className={styles.setupHead}><Database size={16} />Keep it in your own Supabase</div>
      <p>One time only. Then your notes, documents and chats live in your own database, and Jarvis learns from them.</p>
      <ol className={styles.steps}>
        <li><span>1</span><button className={styles.step} onClick={copy}><ClipboardCopy size={14} />Copy setup code</button></li>
        <li><span>2</span><a className={styles.step} href={store.sql} target="_blank" rel="noreferrer">Open Supabase<ArrowUpRight size={14} /></a><small>Paste, then tap Run</small></li>
        <li><span>3</span><button className={styles.step} onClick={done}><Check size={14} />Done</button><small>Come back here</small></li>
      </ol>
      {code && <textarea className={styles.code} readOnly value={SETUP_CODE} onFocus={e => e.target.select()} aria-label="Setup code" />}
      {code && <p className={styles.hint}>Tap the box, Select All, then Copy.</p>}
    </section>
  )
}

// A tap on the bin or Forget asks once more, for three seconds
function useSure(sure, setSure) {
  useEffect(() => { if (!sure) return; const t = setTimeout(() => setSure(false), 3000); return () => clearTimeout(t) }, [sure, setSure])
}

// Long notes open on tap; the pencil corrects a note; the bin asks once more before deleting
function Row({ head, title, text, meta, onDelete, onEdit }) {
  const [open, setOpen]       = useState(false)
  const [sure, setSure]       = useState(false)
  const [draft, setDraft]     = useState(null)    // editing: the text so far
  const [saving, setSaving]   = useState(false)
  useSure(sure, setSure)

  const save = async () => {
    const said = draft.trim()
    if (!said || said === text) { setDraft(null); return }
    setSaving(true)
    const ok = await onEdit(said)
    setSaving(false)
    if (ok) setDraft(null)
  }

  return (
    <li className={styles.note}>
      {head}
      {title && <div className={styles.title}>{title}</div>}
      {draft !== null
        ? <textarea className={styles.edit} value={draft} onChange={e => setDraft(e.target.value)} autoFocus aria-label="Correct this note" />
        : text && <p className={open ? '' : styles.clamp} onClick={() => setOpen(o => !o)}>{text}</p>}
      <div className={styles.foot}>
        <small>{meta}</small>
        {draft !== null
          ? <span className={`${styles.editBtns} ${styles.editing}`}>
              <button className={styles.link} onClick={() => setDraft(null)}>Cancel</button>
              <button className={styles.save} onClick={save} disabled={saving}>Save</button>
            </span>
          : <span className={styles.editBtns}>
              {onEdit && <button className={styles.bin} onClick={() => setDraft(text)} aria-label="Correct"><Pencil size={14} /></button>}
              {sure
                ? <button className={styles.sure} onClick={onDelete}>Delete?</button>
                : <button className={styles.bin} onClick={() => setSure(true)} aria-label="Delete"><Trash2 size={15} /></button>}
            </span>}
      </div>
    </li>
  )
}
