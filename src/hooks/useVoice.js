// src/hooks/useVoice.js
// Speech to text with the phone's own speech recognition (Chrome, Safari).
import { useRef, useState, useCallback } from 'react'
import toast from 'react-hot-toast'

const SpeechRecognition = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

// onText(fullText) is called as words arrive; `before` is kept in front of what is said
export function useVoice(onText) {
  const [listening, setListening] = useState(false)
  const recRef = useRef(null)

  const toggle = useCallback((before = '') => {
    if (!SpeechRecognition) {
      toast('Voice is not supported in this browser. Use the mic key on your keyboard instead.', { icon: '🎙️', duration: 5000 })
      return
    }
    if (recRef.current) { recRef.current.stop(); return }
    const rec = new SpeechRecognition()
    rec.lang = 'en-IN'
    rec.interimResults = true
    const prefix = before ? before + ' ' : ''
    rec.onresult = (ev) => {
      let said = ''
      for (const r of ev.results) said += r[0].transcript
      onText(prefix + said)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') toast.error('Allow microphone access to use voice')
    }
    rec.onend = () => { recRef.current = null; setListening(false) }
    recRef.current = rec
    rec.start()
    setListening(true)
  }, [onText])

  return { listening, toggle }
}
