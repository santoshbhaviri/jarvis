// src/hooks/useVoice.js
// Speech to text with the phone's own speech recognition (Chrome, Safari).
import { useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export const voiceSupported = !!SpeechRecognition

// onText(fullText) is called as words arrive; `before` is kept in front of what is said.
// onEnd(fullText) is called once when listening stops (not after cancel()).
// onFail() is called when voice can't be used here (e.g. in some home-screen apps), so the
// caller can switch to typing.
export function useVoice(onText, onEnd, onFail) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  const toggle = useCallback((before = '') => {
    if (!SpeechRecognition) {
      toast('Voice is not supported in this browser. Use the mic key on your keyboard instead.', { duration: 5000 })
      return
    }
    if (recRef.current) { recRef.current.stop(); return }
    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.interimResults = true
    const prefix = before ? before + ' ' : ''
    let heard = ''
    rec.cancelled = false
    rec.onresult = (ev) => {
      let said = ''
      for (const r of ev.results) said += r[0].transcript
      heard = prefix + said
      onText(heard)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'no-speech' || ev.error === 'aborted') return
      if (ev.error === 'not-allowed') toast('Microphone is off for Jarvis, so type instead')
      onFail?.(ev.error)
    }
    rec.onend = () => { recRef.current = null; setListening(false); if (heard.trim() && !rec.cancelled) onEnd?.(heard) }
    recRef.current = rec
    try { rec.start() } catch { recRef.current = null; onFail?.('start'); return }
    setListening(true)
  }, [onText, onEnd, onFail])

  // Stop listening without acting on what was heard (you switched to typing)
  const cancel = useCallback(() => {
    if (recRef.current) { recRef.current.cancelled = true; recRef.current.stop() }
  }, [])

  return { listening, toggle, cancel }
}
