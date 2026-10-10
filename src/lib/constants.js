import { Sun, Target, Search, MessageCircle, Sparkles, CircleCheck, Briefcase, House } from 'lucide-react'

export const TABS = [
  { key: 'today',   label: 'Today',   icon: Sun },
  { key: 'tracker', label: 'Tracker', icon: Target },
  { key: 'search',  label: 'Search',  icon: Search },
  { key: 'assist',  label: 'Assist',  icon: MessageCircle },
  { key: 'evolve',  label: 'Evolve',  icon: Sparkles },
  { key: 'done',    label: 'Done',    icon: CircleCheck },
]

export const CATEGORIES = {
  work:     { label: 'Work',     icon: Briefcase, color: 'var(--text2)' },
  personal: { label: 'Personal', icon: House,     color: 'var(--text2)' },
}

// Where Jarvis's code lives; "Improve Jarvis" requests become issues here
export const REPO_URL = 'https://github.com/santoshbhaviri/jarvis'
