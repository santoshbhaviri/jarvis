// The bookmark under an answer: saves it to your Knowledge, so Search and Assist keep it in mind.
import { useState } from 'react'
import toast from 'react-hot-toast'
import { Bookmark, BookmarkCheck } from 'lucide-react'
import { addMemory } from '../lib/server'

export default function SaveButton({ text, from, title }) {
  const [state, setState] = useState('')   // '' | 'saving' | 'saved'
  const save = async () => {
    setState('saving')
    const res = await addMemory(text, from, title)
    if (res.error) { setState(''); toast.error(res.why || 'Could not save. Try again.'); return }
    setState('saved')
    toast.success('Saved to Knowledge')
  }
  return (
    <button onClick={save} disabled={!!state} aria-label={state === 'saved' ? 'Saved to Knowledge' : 'Save to Knowledge'}>
      {state === 'saved' ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
    </button>
  )
}
