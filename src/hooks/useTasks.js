// src/hooks/useTasks.js
// All database logic.
//   Tasks   (status 'scut-work' or 'mission'): one-off to-dos with a day (due_date).
//           Unfinished tasks from earlier days move to today automatically.
//           Finished tasks keep completed_at and sit in the Done bin for 30 days.
//   Habits  (status 'routine'): ticked per day in routine_completions.
//   Repeats ("↻ Every Monday" in notes): ticking one adds the next.
//   Offline: the last copy is kept on the phone, and changes made without signal
//   wait in an outbox and are sent when the connection is back (lib/outbox.js).
import { useState, useEffect, useCallback, useRef } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/dateUtils'
import { ruleOf, nextAfter } from '../lib/repeat'
import * as outbox from '../lib/outbox'

export const BIN_DAYS = 30

// Fields the app writes on create; everything else uses database defaults
const toRow = (p) => ({
  title:           p.title.trim(),
  category:        p.category || 'work',
  status:          p.status   || 'scut-work',
  due_date:        p.status === 'routine' ? null : (p.due_date || todayStr()),
  notes:           p.notes    || null,
  important:       !!p.important,
  target_per_week: p.target_per_week || null,
  ...(p.follow_up ? { follow_up: p.follow_up, waiting_on: p.waiting_on || null } : {}),
})

// No signal, or the request never reached Supabase
const isOffline = (error) => !navigator.onLine || /fetch|network|load failed/i.test(error?.message || '')

export function useTasks() {
  const [tasks, setTasks]           = useState([])
  const [routineCompletions, setRC] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [offline, setOffline]       = useState(!navigator.onLine)
  const [pending, setPending]       = useState(outbox.size())
  const ready = useRef(false)

  // Show the copy saved on this phone straight away
  useEffect(() => {
    const saved = outbox.loadCache()
    if (saved) { setTasks(saved.tasks); setRC(saved.rc); setLoading(false) }
  }, [])
  // …and keep it up to date
  useEffect(() => { if (ready.current) outbox.saveCache(tasks, routineCompletions) }, [tasks, routineCompletions])

  const fetchAll = useCallback(async () => {
    if (!navigator.onLine) { setOffline(true); setLoading(false); return }
    setLoading(true); setError(null)
    // Send anything done offline first
    if (outbox.size()) { await outbox.flush(supabase); setPending(outbox.size()) }
    const today = todayStr()

    // Empty the Done bin of anything finished more than 30 days ago
    const cutoff = subDays(new Date(), BIN_DAYS).toISOString()
    const purge = await supabase.from('tasks').delete().neq('status', 'routine').lt('completed_at', cutoff)
    if (purge.error) console.error('purge error:', purge.error)

    const [t, rc] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: true }),
      supabase.from('routine_completions').select('*'),
    ])
    if (t.error) {
      if (isOffline(t.error)) setOffline(true)
      else { console.error('fetchAll tasks error:', t.error); setError(t.error.message) }
      setLoading(false); return
    }
    setOffline(false)

    // Carry unfinished tasks from earlier days over to today
    let fetched = t.data ?? []
    const carry = fetched.filter(x => x.status !== 'routine' && !x.completed_at && (!x.due_date || x.due_date < today))
    if (carry.length) {
      const moved = await Promise.all(carry.map(x =>
        supabase.from('tasks')
          .update({ due_date: today, is_unfinished: true, postponed: (x.postponed || 0) + 1 })
          .eq('id', x.id).select().single()
      ))
      const map = new Map(moved.filter(r => r.data).map(r => [r.data.id, r.data]))
      fetched = fetched.map(x => map.get(x.id) ?? x)
    }

    ready.current = true
    setTasks(fetched)
    setRC(rc.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Back online: send what waited, then refresh
  useEffect(() => {
    const on = () => { setOffline(false); fetchAll() }
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [fetchAll])

  // Keep a change on the phone until it can be sent
  const queue = useCallback((op) => { ready.current = true; outbox.push(op); setPending(outbox.size()); setOffline(true) }, [])

  // Pick up the new day if the app stays open past midnight
  useEffect(() => {
    let day = todayStr()
    const id = setInterval(() => { if (todayStr() !== day) { day = todayStr(); fetchAll() } }, 60_000)
    return () => clearInterval(id)
  }, [fetchAll])

  // ── Add ──────────────────────────────────────────────────────
  const addTask = useCallback(async (form) => {
    const row = toRow(form)
    const { data, error } = navigator.onLine
      ? await supabase.from('tasks').insert(row).select().single()
      : { error: { message: 'offline' } }
    if (error && isOffline(error)) {
      const local = { ...row, id: outbox.localId(), created_at: new Date().toISOString(), postponed: 0, is_unfinished: false, completed_at: null }
      queue({ op: 'insert', id: local.id, row })
      setTasks(prev => [...prev, local])
      return { data: local, error: null }
    }
    if (error) console.error('addTask error:', error)
    if (!error && data) setTasks(prev => [...prev, data])
    return { data, error }
  }, [queue])

  // ── Update any fields ────────────────────────────────────────
  const updateTask = useCallback(async (id, patch) => {
    const { data, error } = navigator.onLine && !outbox.isLocal(id)
      ? await supabase.from('tasks').update(patch).eq('id', id).select().single()
      : { error: { message: 'offline' } }
    if (error && (isOffline(error) || outbox.isLocal(id))) {
      queue({ op: 'update', id, patch })
      let saved
      setTasks(prev => prev.map(t => t.id === id ? (saved = { ...t, ...patch }) : t))
      return { data: saved, error: null }
    }
    if (error) console.error('updateTask error:', error)
    if (!error && data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    return { data, error }
  }, [queue])

  // ── Delete for good ──────────────────────────────────────────
  const deleteTask = useCallback(async (id) => {
    let { error } = navigator.onLine && !outbox.isLocal(id)
      ? await supabase.from('tasks').delete().eq('id', id)
      : { error: { message: 'offline' } }
    if (error && (isOffline(error) || outbox.isLocal(id))) { queue({ op: 'delete', id }); error = null }
    if (error) console.error('deleteTask error:', error)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id))
      setRC(prev => prev.filter(r => r.task_id !== id))
    }
    return { error }
  }, [queue])

  // ── Finish / un-finish a task ────────────────────────────────
  // A repeating task adds its next one when ticked (once: not if it is already there)
  const setDone = useCallback(async (task, done) => {
    const res = await updateTask(task.id, { completed_at: done ? new Date().toISOString() : null })
    const rule = done && !res.error && ruleOf(task)
    if (rule) {
      const from = task.due_date && task.due_date > todayStr() ? task.due_date : todayStr()
      const next = nextAfter(rule, from)
      const already = tasks.some(t => t.id !== task.id && !t.completed_at && t.title === task.title && t.notes === task.notes && t.due_date >= next)
      if (!already) await addTask({ ...task, due_date: next })
    }
    return res
  }, [updateTask, addTask, tasks])

  // ── Bring a task back from the Done bin to today ─────────────
  const restoreTask = useCallback((task) =>
    updateTask(task.id, { completed_at: null, due_date: todayStr() }), [updateTask])

  // ── Move a task to another day ───────────────────────────────
  const moveTask = useCallback((task, date) =>
    updateTask(task.id, { due_date: date }), [updateTask])

  // ── Habit ticks ──────────────────────────────────────────────
  const toggleRoutineDay = useCallback(async (taskId, date) => {
    const exists = routineCompletions.find(r => r.task_id === taskId && r.date === date)
    if (!navigator.onLine || outbox.isLocal(taskId)) {
      queue({ op: exists ? 'untick' : 'tick', task_id: taskId, date })
      setRC(prev => exists ? prev.filter(r => !(r.task_id === taskId && r.date === date)) : [...prev, { id: outbox.localId(), task_id: taskId, date }])
      return { error: null }
    }
    if (exists) {
      const { error } = await supabase.from('routine_completions').delete()
        .eq('task_id', taskId).eq('date', date)
      if (error) { console.error('toggleRoutineDay delete error:', error); return { error } }
      setRC(prev => prev.filter(r => !(r.task_id === taskId && r.date === date)))
    } else {
      const { data, error } = await supabase.from('routine_completions')
        .insert({ task_id: taskId, date }).select().single()
      if (error) { console.error('toggleRoutineDay insert error:', error); return { error } }
      if (data) setRC(prev => [...prev, data])
    }
    return { error: null }
  }, [routineCompletions, queue])

  const isRoutineDone = useCallback((taskId, date) =>
    routineCompletions.some(r => r.task_id === taskId && r.date === date), [routineCompletions])

  return {
    tasks, loading, error, routineCompletions, offline, pending,
    fetchAll, addTask, updateTask, deleteTask,
    setDone, restoreTask, moveTask,
    toggleRoutineDay, isRoutineDone,
  }
}

// Local calendar day a task was finished on
export const doneDay = (t) => format(new Date(t.completed_at), 'yyyy-MM-dd')
