// src/hooks/useTasks.js
// All database operations live here. Components never call supabase directly.

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export function useTasks() {
  const [tasks, setTasks]     = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  // ── Fetch all tasks (newest first) ──────────────────────────
  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setTasks(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  // ── Add multiple tasks at once (bulk insert) ─────────────────
  const addTasks = useCallback(async (rows) => {
    const payload = rows
      .filter(r => r.title.trim())
      .map(r => ({
        title:        r.title.trim(),
        category:     r.category,
        priority:     r.priority,
        status:       r.status,
        due_date:     r.due_date     || null,
        followup_date:r.followup_date|| null,
        notes:        r.notes        || null,
      }))
    if (!payload.length) return { error: 'No tasks to save' }
    const { data, error } = await supabase.from('tasks').insert(payload).select()
    if (!error) setTasks(prev => [...(data ?? []), ...prev])
    return { data, error }
  }, [])

  // ── Update a single task ─────────────────────────────────────
  const updateTask = useCallback(async (id, changes) => {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        ...changes,
        due_date:      changes.due_date      || null,
        followup_date: changes.followup_date || null,
      })
      .eq('id', id)
      .select()
      .single()
    if (!error && data) setTasks(prev => prev.map(t => t.id === id ? data : t))
    return { data, error }
  }, [])

  // ── Update only the status field (quick toggle) ──────────────
  const updateStatus = useCallback(async (id, status) => {
    return updateTask(id, { status })
  }, [updateTask])

  // ── Delete a task ─────────────────────────────────────────────
  const deleteTask = useCallback(async (id) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id)
    if (!error) setTasks(prev => prev.filter(t => t.id !== id))
    return { error }
  }, [])

  return { tasks, loading, error, fetchTasks, addTasks, updateTask, updateStatus, deleteTask }
}
