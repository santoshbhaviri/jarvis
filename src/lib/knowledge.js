// Moving your Knowledge (notes and Library) from Netlify into your own Supabase. The server moves
// about 20 seconds' worth per call, so this calls it again until it is done. One move at a time,
// whichever screen starts it; `onMove` follows its progress ({ docs, of } after each part).
import toast from 'react-hot-toast'
import { moveKnowledge } from './server'

let running = null
const listeners = new Set()

export const onMove = (fn) => { listeners.add(fn); return () => listeners.delete(fn) }
export const moving = () => !!running

export function moveAll() {
  running ||= (async () => {
    for (let i = 0; i < 300; i++) {
      const res = await moveKnowledge()
      listeners.forEach(fn => fn(res))
      if (res.done && 'of' in res) toast.success('Your Knowledge is in your Supabase now')
      if (res.error || res.done) return res
    }
    return { error: 'failed' }
  })().finally(() => { running = null })
  return running
}
