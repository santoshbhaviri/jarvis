// src/hooks/useTasks.js
// All database logic.
//   Tasks   (status 'scut-work' or 'mission'): one-off to-dos with a day (due_date).
//           Unfinished tasks from earlier days move to today automatically.
//           Finished tasks keep completed_at and sit in the Done bin for 30 days.
//   Habits  (status 'routine'): ticked per day in routine_completions.
import { useState, useEffect, useCallback } from 'react'
import { format, subDays } from 'date-fns'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/dateUtils'

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
})

export function useTasks() {
  const [tasks, setTasks]           = useState([])
  const [routineCompletions, setRC] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const today = todayStr()

    // Empty the Done bin of anything finished more than 30 days ago
    const cutoff = subDays(new Date(), BIN_DAYS).toISOString()
    const purge = await supabase.from('tasks').delete().neq('status', 'routine').lt('completed_at', cutoff)
    if (purge.error) console.error('purge error:', purge.error)

    const [t, rc] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: true }),
      supabase.from('routine_completions').select('*'),
    ])
    if (t.error) { console.error('fetchAll tasks error:', t.error); setError(t.error.message); setLoading(false); return }

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

    setTasks(fetched)
    setRC(rc.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Pick up the new day if the app stays open past midnight
  useEffect(() => {
    let day = todayStr()
    const id = setInterval(() => { if (todayStr() !== day) { day = todayStr(); fetchAll() } }, 60_000)
    return () => clearInterval(id)
  }, [fetchAll])

  // ── Add ──────────────────────────────────────────────────────
  const addTask = useCallback(async (form) => {
    const { data, error } = await supabase.from('tasks').insert(toRow(form)).select().single()
    if (error) console.error('addTask error:', error)
    if (!error && data) setTasks(prev => [...prev, data])
    return { data, error }
  }, [])

  // ── Update any fields ────────────────────────────────────────
  const updateTask = useCallback(async (id, patch) => {
    const { data, error } = await supabase
      .from('tasks').update(patch).eq('id', id).select().single()
    if (error) console.error('updateTask error:', error)
    if (!error && data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    return { data, error }
  }, [])

  // ── Delete for good ──────────────────────────────────────────
  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) console.error('deleteTask error:', error)
    if (!error) {
      setTasks(prev => prev.filter(t => t.id !== id))
      setRC(prev => prev.filter(r => r.task_id !== id))
    }
    return { error }
  }, [])

  // ── Finish / un-finish a task ────────────────────────────────
  const setDone = useCallback((task, done) =>
    updateTask(task.id, { completed_at: done ? new Date().toISOString() : null }), [updateTask])

  // ── Bring a task back from the Done bin to today ─────────────
  const restoreTask = useCallback((task) =>
    updateTask(task.id, { completed_at: null, due_date: todayStr() }), [updateTask])

  // ── Move a task to another day ───────────────────────────────
  const moveTask = useCallback((task, date) =>
    updateTask(task.id, { due_date: date }), [updateTask])

  // ── Habit ticks ──────────────────────────────────────────────
  const toggleRoutineDay = useCallback(async (taskId, date) => {
    const exists = routineCompletions.find(r => r.task_id === taskId && r.date === date)
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
  }, [routineCompletions])

  const isRoutineDone = useCallback((taskId, date) =>
    routineCompletions.some(r => r.task_id === taskId && r.date === date), [routineCompletions])

  return {
    tasks, loading, error, routineCompletions,
    fetchAll, addTask, updateTask, deleteTask,
    setDone, restoreTask, moveTask,
    toggleRoutineDay, isRoutineDone,
  }
}

// Local calendar day a task was finished on
export const doneDay = (t) => format(new Date(t.completed_at), 'yyyy-MM-dd')
