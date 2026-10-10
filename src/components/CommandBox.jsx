// The typing box used on every tab. Type and press Enter (or the arrow), or tap the mic
// to speak instead. Speaking fills the box; with voiceSubmits it goes as soon as you stop.
import { useEffect, useRef } from 'react'
import { useVoice, voiceSupported } from '../hooks/useVoice'
import styles from './CommandBox.module.css'

export default function CommandBox({ value, onChange, onSubmit, placeholder, label, busy = false, voiceSubmits = true, onFocus, onBlur }) {
  const inputRef = useRef(null)
  const voice = useVoice(onChange, (said) => voiceSubmits && onSubmit(said.trim()), () => inputRef.current?.focus())

  // Grow with the text, up to five lines
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 132) + 'px'
  }, [value])

  const send = () => { const s = value.trim(); if (s && !busy) onSubmit(s) }

  return (
    <form className={`${styles.box} ${voice.listening ? styles.listening : ''}`} onSubmit={e => { e.preventDefault(); send() }}>
      <textarea ref={inputRef} className={styles.input} rows={1} value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => { voice.listening && voice.cancel(); onFocus?.() }}
        onBlur={onBlur}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
        placeholder={voice.listening ? 'Listening… speak now' : placeholder}
        aria-label={label} enterKeyHint="send" />
      {voiceSupported && (
        <button type="button" className={`${styles.mic} ${voice.listening ? styles.micOn : ''}`}
          onClick={() => voice.toggle(value)} aria-label={voice.listening ? 'Stop listening' : 'Speak'}>
          <MicIcon />
        </button>
      )}
      <button type="submit" className={styles.send} disabled={!value.trim() || busy} aria-label="Send">
        <ArrowIcon />
      </button>
    </form>
  )
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>
  )
}
