// src/hooks/useTasks.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/dateUtils'

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
      const overduePending = fetchedTasks.filter(task =>
        task.status === 'scut-work' &&
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
    const payload = {
      title:         form.title.trim(),
      category:      form.category,
      status:        form.status,
      due_date:      form.due_date      || null,
      notes:         form.notes         || null,
      is_extended:   form.is_extended   || false,
      is_unfinished: false,
      extended_from: form.extended_from || null,
    }
    console.log('addTask payload:', payload)
    const { data, error } = await supabase.from('tasks').insert(payload).select().single()
    if (error) console.error('addTask error:', error)
    if (!error && data) setTasks(prev => [data, ...prev])
    return { data, error }
  }, [])

  // ── Add multiple tasks (bulk) ────────────────────────────────
  const addTasks = useCallback(async (payloads) => {
    const rows = payloads.map(p => ({
      title:         p.title.trim(),
      category:      p.category,
      status:        p.status,
      due_date:      p.due_date  || null,
      notes:         p.notes     || null,
      is_extended:   false,
      is_unfinished: false,
      extended_from: null,
    }))
    console.log('addTasks rows:', rows)
    const { data, error } = await supabase.from('tasks').insert(rows).select()
    if (error) console.error('addTasks error:', error)
    if (!error && data) setTasks(prev => [...[...data].reverse(), ...prev])
    return { data, error }
  }, [])

  // ── Update notes only ────────────────────────────────────────
  const updateNotes = useCallback(async (id, notes) => {
    const { data, error } = await supabase
      .from('tasks').update({ notes }).eq('id', id).select().single()
    if (error) console.error('updateNotes error:', error)
    if (!error && data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    return { error }
  }, [])

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
      const payload = {
        title:         task.title,           // keep the same title (no "(Extended)" suffix)
        category:      task.category,
        status:        task.status,
        due_date:      newDate,
        notes:         task.notes,
        is_extended:   true,
        is_unfinished: false,
        extended_from: task.id,
      }
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
        .update({ due_date: newDate, is_extended: true })
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
  const toggleDailyComplete = useCallback(async (taskId) => {
    const today = todayStr()
    const exists = dailyCompletions.find(d => d.task_id === taskId && d.date === today)

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
  }, [dailyCompletions, routineCompletions])

  const isCompletedToday = useCallback((taskId) => {
    const today = todayStr()
    return dailyCompletions.some(d => d.task_id === taskId && d.date === today)
  }, [dailyCompletions])

  const isRoutineDone = useCallback((taskId, date) => {
    return routineCompletions.some(r => r.task_id === taskId && r.date === date)
  }, [routineCompletions])

  return {
    tasks, loading, error,
    routineCompletions, dailyCompletions,
    fetchAll,
    addTask, addTasks, updateNotes, deleteTask, extendTask,
    toggleRoutineDay, toggleDailyComplete,
    isCompletedToday, isRoutineDone,
  }
}
