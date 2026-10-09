// What the Jarvis button should do with what you said:
//   'task'    → add it to your list (one sentence can hold several tasks)
//   'ask'     → a question, a search, or a message to write
//   'improve' → a change to the Jarvis app itself (sent to GitHub, Claude builds it)
import { format } from 'date-fns'
import { todayStr } from './dateUtils'
import { REPO_URL } from './constants'

const IMPROVE = /^(?:(?:hey |ok )?jarvis[,.]?\s*)?(?:please\s+)?(?:improve|upgrade|change|update|redesign|fix)\s+(?:the |my )?(?:app|jarvis)\b|\b(?:the app|jarvis|this app) should\b|\b(?:add|build|make|create) (?:a |an |one )?(?:new )?(?:feature|button|tab|screen|page|option|setting)\b|^(?:improve|feature|app)\s*[:-]/i
const ASK = /\?\s*$|^(?:(?:hey |ok )?jarvis[,.]?\s*)?(?:please\s+)?(?:what|who|whom|whose|why|how|when|where|which|is|are|was|were|does|did|can|could|should|would|tell me|explain|search|google|find out|look up|show me|give me|suggest|recommend|polish|rewrite|rephrase|(?:write|draft|compose)\s+(?:me\s+)?(?:a|an)?\s*(?:message|mail|email|letter|reply|note|whatsapp|sms|post|speech|wish)|translate|summari[sz]e|define|meaning of|news|latest|weather|calculate|compare)\b/i

const TASK = /\b(?:remind me|add (?:a |new )?(?:task|reminder)|(?:i|we) (?:need|have|want|got) to|don't forget|note down)\b/i

export function classify(text) {
  const s = text.trim()
  if (IMPROVE.test(s)) return 'improve'
  if (TASK.test(s) && !/\?\s*$/.test(s)) return 'task'
  if (ASK.test(s)) return 'ask'
  return 'task'
}

// What Jarvis knows about your day, sent along with a question
export function dayContext(tasks, isRoutineDone) {
  const today = todayStr()
  const open  = tasks.filter(t => t.status !== 'routine' && !t.completed_at && t.due_date <= today)
  const later = tasks.filter(t => t.status !== 'routine' && !t.completed_at && t.due_date > today)
  const done  = tasks.filter(t => t.status !== 'routine' && t.completed_at && t.completed_at.slice(0, 10) === today)
  const habits = tasks.filter(t => t.status === 'routine')
  const line = t => `- ${t.title}${t.important ? ' (important)' : ''}${t.postponed ? ` (carried over ${t.postponed} days)` : ''}`
  return [
    `[Today is ${format(new Date(), 'EEEE d MMMM yyyy, h:mm a')}.]`,
    open.length ? `[Tasks for today:\n${open.map(line).join('\n')}]` : '[No tasks left for today.]',
    done.length ? `[Done today: ${done.map(t => t.title).join('; ')}]` : '',
    later.length ? `[Planned later: ${later.slice(0, 15).map(t => `${t.title} on ${t.due_date}`).join('; ')}]` : '',
    habits.length ? `[Habits: ${habits.map(h => `${h.title} ${isRoutineDone(h.id, today) ? 'done' : 'not done'} today`).join('; ')}]` : '',
  ].filter(Boolean).join('\n')
}

// Free answers, no setup: open the question in Google's AI Mode, ChatGPT or Claude.
// Questions about your own day carry today's tasks along.
const aboutMyDay = (q) => /\b(my|today|tomorrow|plate|schedule|plan|tasks?|pending|agenda)\b/i.test(q)
const withDay = (q, ctx) => aboutMyDay(q) && ctx ? `${q}\n\n(From my task app:\n${ctx})` : q
export const googleLink  = (q, ctx) => `https://www.google.com/search?udm=50&q=${encodeURIComponent(withDay(q, ctx))}`
export const chatgptLink = (q, ctx) => `https://chatgpt.com/?q=${encodeURIComponent(withDay(q, ctx))}`
export const claudeLink  = (q, ctx) => `https://claude.ai/new?q=${encodeURIComponent(withDay(q, ctx))}`

// A change to Jarvis itself becomes a GitHub request; Claude builds it every morning
export function improveLink(idea) {
  const q = idea.trim()
  const title = q.length > 70 ? q.slice(0, 67) + '…' : q
  const body = `${q}\n\n---\nSent from the Jarvis button. Claude: please build this, open a pull request with a preview link, and comment here.`
  return `${REPO_URL}/issues/new?title=${encodeURIComponent('[Jarvis] ' + title)}&body=${encodeURIComponent(body)}`
}
