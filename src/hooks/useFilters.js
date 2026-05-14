// src/hooks/useFilters.js
// Manages all filter + tab state. Keep filtering logic out of components.

import { useState, useMemo } from 'react'
import { daysLeft } from '../lib/dateUtils'
import { today } from '../lib/dateUtils'

export function useFilters(tasks) {
  const [tab, setTab]       = useState('all')   // all | today | followup
  const [category, setCategory] = useState('all')
  const [priority, setPriority] = useState('all')
  const [status, setStatus]     = useState('all')
  const [search, setSearch]     = useState('')

  const todayStr = today()

  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (tab === 'followup' && t.status !== 'followup') return false
      if (tab === 'today') {
        const d = daysLeft(t.due_date)
        if (d !== 0 && t.followup_date !== todayStr) return false
      }
      if (category !== 'all' && t.category !== category) return false
      if (priority !== 'all' && t.priority !== priority) return false
      if (status   !== 'all' && t.status   !== status)   return false
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [tasks, tab, category, priority, status, search, todayStr])

  const counts = useMemo(() => ({
    all:      tasks.length,
    today:    tasks.filter(t => daysLeft(t.due_date) === 0 || t.followup_date === todayStr).length,
    followup: tasks.filter(t => t.status === 'followup').length,
  }), [tasks, todayStr])

  return {
    filtered, counts,
    tab, setTab,
    category, setCategory,
    priority, setPriority,
    status, setStatus,
    search, setSearch,
  }
}
