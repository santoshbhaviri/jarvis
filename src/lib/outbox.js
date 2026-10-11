// Offline support for tasks.
//  - A copy of your tasks is kept on the phone, so Jarvis opens with no signal.
//  - Changes made offline wait here and are sent, in order, when the signal is back.
//    Tasks created offline get a temporary "local-…" id until they are saved.
const CACHE = 'jarvis-cache'
const OUT = 'jarvis-outbox'

const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch { return d } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* storage full or private mode */ } }

export const loadCache = () => read(CACHE, null)
export const saveCache = (tasks, rc) => write(CACHE, { tasks, rc })
// On sign-in and sign-out: nothing personal stays on the phone (tasks, chat, searches)
const PERSONAL = [CACHE, OUT, 'jarvis-chat', 'jarvis-searches', 'jarvis-memory', 'jarvis-input']
export const clearAll = () => { try { PERSONAL.forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ } }

export const localId = () => 'local-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
export const isLocal = (id) => typeof id === 'string' && id.startsWith('local-')
export const size = () => read(OUT, []).length

export function push(op) {
  let ops = read(OUT, [])
  // Changes to a task that was never saved fold into its creation
  if (op.op === 'update' && isLocal(op.id)) {
    const ins = ops.find(o => o.op === 'insert' && o.id === op.id)
    if (ins) { Object.assign(ins.row, op.patch); write(OUT, ops); return }
  }
  if (op.op === 'delete' && isLocal(op.id)) {
    ops = ops.filter(o => o.id !== op.id && o.task_id !== op.id)
    write(OUT, ops); return
  }
  ops.push(op)
  write(OUT, ops)
}

// Send everything waiting. Stops at the first network failure and keeps the rest.
export async function flush(supabase) {
  const ops = read(OUT, [])
  const ids = {}   // local id → saved id
  const real = (id) => ids[id] || id
  while (ops.length) {
    const o = ops[0]
    let res
    if (o.op === 'insert') {
      res = await supabase.from('tasks').insert(o.row).select().single()
      if (!res.error) ids[o.id] = res.data.id
    } else if (o.op === 'update') {
      res = await supabase.from('tasks').update(o.patch).eq('id', real(o.id))
    } else if (o.op === 'delete') {
      res = await supabase.from('tasks').delete().eq('id', real(o.id))
    } else if (o.op === 'tick') {
      res = await supabase.from('routine_completions').insert({ task_id: real(o.task_id), date: o.date })
    } else if (o.op === 'untick') {
      res = await supabase.from('routine_completions').delete().eq('task_id', real(o.task_id)).eq('date', o.date)
    }
    if (res?.error && /fetch|network|load failed/i.test(res.error.message || '')) break
    if (res?.error) console.error('outbox: dropped a change that Supabase refused', o, res.error)
    ops.shift()
    // later ops may name this task by its local id
    for (const later of ops) {
      if (later.id && ids[later.id]) later.id = ids[later.id]
      if (later.task_id && ids[later.task_id]) later.task_id = ids[later.task_id]
    }
    write(OUT, ops)
  }
}
