// The typing box used on every tab. Type and press Enter (or the arrow). To speak, use the
// mic on the phone's keyboard: it keeps listening through pauses and hears Indian English
// far better than the browser's speech recognition did. With onAttach, a paperclip on the left
// picks a file (accept says which kinds).
import { useEffect, useRef } from 'react'
import { ArrowUp, Paperclip } from 'lucide-react'
import styles from './CommandBox.module.css'

export default function CommandBox({ value, onChange, onSubmit, placeholder, label, busy = false, onFocus, onBlur, onAttach, accept }) {
  const inputRef = useRef(null)
  const fileRef = useRef(null)

  // Grow with the text, up to five lines
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [value])

  const send = () => { const s = value.trim(); if (s && !busy) onSubmit(s) }

  return (
    <form className={`${styles.box} ${onAttach ? styles.withClip : ''}`} onSubmit={e => { e.preventDefault(); send() }}>
      {onAttach && <>
        <button type="button" className={styles.clip} onClick={() => fileRef.current?.click()} aria-label="Add a document"><Paperclip size={18} /></button>
        <input ref={fileRef} type="file" accept={accept} hidden aria-label="Choose a document"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onAttach(f) }} />
      </>}
      <textarea ref={inputRef} className={styles.input} rows={1} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        placeholder={placeholder}
        aria-label={label} enterKeyHint="send" />
      <button type="submit" className={styles.send} disabled={!value.trim() || busy} aria-label="Send">
        <ArrowUp size={18} />
      </button>
    </form>
  )
}
