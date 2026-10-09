// src/hooks/useTasks.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { format, addDays } from 'date-fns'
import { todayStr } from '../lib/dateUtils'

// Fields the app writes on create; everything else uses database defaults
const toRow = (p) => ({
  title:         p.title.trim(),
  category:      p.category,
  status:        p.status,
  due_date:      p.due_date      || null,
  notes:         p.notes         || null,
  important:     !!p.important,
  urgent:        !!p.urgent,
  waiting_on:    p.waiting_on?.trim() || null,
  follow_up:     p.waiting_on?.trim() ? (p.follow_up || null) : null,
  is_extended:   p.is_extended   || false,
  is_unfinished: false,
  extended_from: p.extended_from || null,
  postponed:     p.postponed     || 0,
})

export function useTasks() {
  const [tasks, setTasks]           = useState([])
  const [routineCompletions, setRC] = useState([])
  const [dailyCompletions, setDC]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true); setError(null)
    const today = todayStr()
    const [t, rc, dc] = await Promise.all([
      supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      supabase.from('routine_completions').select('*'),
      supabase.from('daily_completions').select('*').eq('date', today),
    ])
    if (t.error) { console.error('fetchAll tasks error:', t.error); setError(t.error.message) }
    else {
      const fetchedTasks = t.data ?? []
      const todayDC = dc.data ?? []
      const completedIds = new Set(todayDC.map(d => d.task_id))

      // Auto-extend overdue unfinished scut-work tasks to today
      // (finished tasks keep their completed_at and stay in history)
      const overduePending = fetchedTasks.filter(task =>
        task.status === 'scut-work' &&
        !task.completed_at &&
        task.due_date &&
        task.due_date < today &&
        !completedIds.has(task.id)
      )
      if (overduePending.length > 0) {
        const { data: updated, error: updateErr } = await supabase
          .from('tasks')
          .update({ due_date: today, is_unfinished: true })
          .in('id', overduePending.map(t => t.id))
          .select()
        if (!updateErr && updated) {
          const map = new Map(updated.map(t => [t.id, t]))
          setTasks(fetchedTasks.map(t => map.get(t.id) ?? t))
        } else {
          setTasks(fetchedTasks)
        }
      } else {
        setTasks(fetchedTasks)
      }
    }
    setRC(rc.data ?? [])
    setDC(dc.data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  // ── Add single task ──────────────────────────────────────────
  const addTask = useCallback(async (form) => {
    const payload = toRow(form)
    const { data, error } = await supabase.from('tasks').insert(payload).select().single()
    if (error) console.error('addTask error:', error)
    if (!error && data) setTasks(prev => [data, ...prev])
    return { data, error }
  }, [])

  // ── Add multiple tasks (bulk) ────────────────────────────────
  const addTasks = useCallback(async (payloads) => {
    const rows = payloads.map(p => toRow({ ...p, is_extended: false, extended_from: null }))
    const { data, error } = await supabase.from('tasks').insert(rows).select()
    if (error) console.error('addTasks error:', error)
    if (!error && data) setTasks(prev => [...[...data].reverse(), ...prev])
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

  // ── Update notes only ────────────────────────────────────────
  const updateNotes = useCallback((id, notes) => updateTask(id, { notes }), [updateTask])

  // ── Top 3 focus for today (star) ─────────────────────────────
  const toggleFocus = useCallback((task) => {
    const today = todayStr()
    return updateTask(task.id, { focus_date: task.focus_date === today ? null : today })
  }, [updateTask])

  // ── Follow-up made: remind again in 2 days ───────────────────
  const markChased = useCallback((task) => {
    const next = format(addDays(new Date(), 2), 'yyyy-MM-dd')
    return updateTask(task.id, { follow_up: next })
  }, [updateTask])

  // ── Delete task ──────────────────────────────────────────────
  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (error) console.error('deleteTask error:', error)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
    return { error }
  }, [])

  // ── Extend task ──────────────────────────────────────────────
  // deletePrevious = false  →  Scut-Work: updates original task's due_date in place
  // deletePrevious = true   →  Mission: deletes original, inserts a fresh extended task
  const extendTask = useCallback(async (task, newDate, deletePrevious = false) => {
    if (deletePrevious) {
      // Mission flow: create a new task with the new date, then delete the original
      const payload = toRow({
        ...task,                             // keep the same title (no "(Extended)" suffix)
        due_date:      newDate,
        is_extended:   true,
        extended_from: task.id,
        postponed:     (task.postponed || 0) + 1,
      })
      const { data: newTask, error: insertErr } = await supabase
        .from('tasks').insert(payload).select().single()
      if (insertErr) {
        console.error('extendTask insert error:', insertErr)
        return { error: insertErr }
      }

      // Delete the original
      const { error: deleteErr } = await supabase
        .from('tasks').delete().eq('id', task.id)
      if (deleteErr) {
        console.error('extendTask delete original error:', deleteErr)
        // New task was created but original not deleted — still return success
        // so UI reflects the new task; user can manually delete old one
      }

      // Update local state: remove original, add new
      setTasks(prev => [newTask, ...prev.filter(t => t.id !== task.id)])
      return { data: newTask, error: null }

    } else {
      // Scut-Work flow: just update the due_date on the original task
      const { data, error } = await supabase
        .from('tasks')
        .update({ due_date: newDate, is_extended: true, postponed: (task.postponed || 0) + 1 })
        .eq('id', task.id)
        .select()
        .single()
      if (error) console.error('extendTask update error:', error)
      if (!error && data) setTasks(prev => prev.map(t => t.id === task.id ? data : t))
      return { data, error }
    }
  }, [])

  // ── Toggle routine day (used only by useTasks internally now) ─
  const toggleRoutineDay = useCallback(async (taskId, date) => {
    const exists = routineCompletions.find(r => r.task_id === taskId && r.date === date)
    if (exists) {
      const { error } = await supabase.from('routine_completions').delete()
        .eq('task_id', taskId).eq('date', date)
      if (error) { console.error('toggleRoutineDay delete error:', error); return }
      setRC(prev => prev.filter(r => !(r.task_id === taskId && r.date === date)))
    } else {
      const { data, error } = await supabase.from('routine_completions')
        .insert({ task_id: taskId, date }).select().single()
      if (error) { console.error('toggleRoutineDay insert error:', error); return }
      if (data) setRC(prev => [...prev, data])
    }
  }, [routineCompletions])

  // ── Toggle daily task completion (checkbox) ──────────────────
  // Also writes to routine_completions for today so the calendar reflects it
  // Scut-work and mission tasks also get completed_at, so they leave the
  // pending lists for good and show up in Insights history
  const toggleDailyComplete = useCallback(async (taskId) => {
    const today = todayStr()
    const exists = dailyCompletions.find(d => d.task_id === taskId && d.date === today)
    const task   = tasks.find(t => t.id === taskId)
    if (task && task.status !== 'routine') {
      await updateTask(taskId, { completed_at: exists ? null : new Date().toISOString() })
    }

    if (exists) {
      const { error } = await supabase.from('daily_completions').delete()
        .eq('task_id', taskId).eq('date', today)
      if (error) { console.error('toggleDailyComplete delete error:', error); return }
      setDC(prev => prev.filter(d => !(d.task_id === taskId && d.date === today)))

      // Also un-mark routine completion for today if this is a routine task
      const rcExists = routineCompletions.find(r => r.task_id === taskId && r.date === today)
      if (rcExists) {
        await supabase.from('routine_completions').delete()
          .eq('task_id', taskId).eq('date', today)
        setRC(prev => prev.filter(r => !(r.task_id === taskId && r.date === today)))
      }
    } else {
      const { data, error } = await supabase.from('daily_completions')
        .insert({ task_id: taskId, date: today }).select().single()
      if (error) { console.error('toggleDailyComplete insert error:', error); return }
      if (data) setDC(prev => [...prev, data])

      // Also mark routine_completions for today so the calendar fills in automatically
      const rcExists = routineCompletions.find(r => r.task_id === taskId && r.date === today)
      if (!rcExists) {
        const { data: rcData, error: rcErr } = await supabase.from('routine_completions')
          .insert({ task_id: taskId, date: today }).select().single()
        if (!rcErr && rcData) setRC(prev => [...prev, rcData])
      }
    }
  }, [dailyCompletions, routineCompletions, tasks, updateTask])

  const isCompletedToday = useCallback((taskId) => {
    const today = todayStr()
    return dailyCompletions.some(d => d.task_id === taskId && d.date === today)
  }, [dailyCompletions])

  const isRoutineDone = useCallback((taskId, date) => {
    return routineCompletions.some(r => r.task_id === taskId && r.date === date)
  }, [routineCompletions])

  // Finished on an earlier day: hidden from pending lists, kept for history
  const isFinishedEarlier = useCallback((task) => {
    return !!task.completed_at && !dailyCompletions.some(d => d.task_id === task.id)
  }, [dailyCompletions])

  return {
    tasks, loading, error,
    routineCompletions, dailyCompletions,
    fetchAll,
    addTask, addTasks, updateTask, updateNotes, deleteTask, extendTask,
    toggleRoutineDay, toggleDailyComplete, toggleFocus, markChased,
    isCompletedToday, isRoutineDone, isFinishedEarlier,
  }
}
