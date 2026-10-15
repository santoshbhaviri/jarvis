import { Sun, Target, Search, MessageCircle, Sparkles, CircleCheck, Briefcase, House, ReceiptIndianRupee } from 'lucide-react'

export const TABS = [
  { key: 'today',   label: 'Today',   icon: Sun },
  { key: 'tracker', label: 'Tracker', icon: Target },
  { key: 'search',  label: 'Search',  icon: Search },
  { key: 'assist',  label: 'Assist',  icon: MessageCircle },
  { key: 'refund',  label: 'Refunds', icon: ReceiptIndianRupee },
  { key: 'evolve',  label: 'Evolve',  icon: Sparkles },
  { key: 'done',    label: 'Done',    icon: CircleCheck },
]

export const CATEGORIES = {
  work:     { label: 'Work',     icon: Briefcase, color: 'var(--text2)' },
  personal: { label: 'Personal', icon: House,     color: 'var(--text2)' },
}

// The real Jarvis. Update previews ("Try it") live at deploy-preview-N--drjarvis.netlify.app
export const HOME = 'drjarvis.netlify.app'
export const isTestCopy = typeof location !== 'undefined' && /^deploy-preview-\d+--/.test(location.hostname)

// Built at (from the build id, a base-36 timestamp)
export const BUILT = new Date(parseInt(__BUILD__, 36))

// Where Jarvis's code lives; "Improve Jarvis" requests become issues here
export const REPO_URL = 'https://github.com/santoshbhaviri/jarvis'
