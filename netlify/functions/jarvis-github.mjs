// Lets Jarvis change itself without leaving the app:
//   POST {action:'request', text}   → a new "[Jarvis] …" request on GitHub; Claude builds it
//   GET                             → updates waiting for you, requests being built, and what went live lately
//   POST {action:'approve', number} → you approved it in the app: puts it live (merges; Netlify redeploys)
//   POST {action:'change', number, text} → asks Claude to change that update
//   POST {action:'drop', number}    → throws that update away
// Needs GITHUB_TOKEN (fine-grained, this repo only: Contents, Issues, Pull requests = read & write)
// and JARVIS_OWNER_EMAIL in Netlify.
import { env, json, owner } from '../lib/common.mjs'

const REPO = env('JARVIS_REPO') || 'santoshbhaviri/jarvis'
const SITE = env('JARVIS_SITE') || 'drjarvis'
const NOTE = '\n\n---\nSent from Jarvis.'

async function gh(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'jarvis-app',
    },
    body: body && JSON.stringify(body),
  })
  const data = res.status === 204 ? null : await res.json().catch(() => null)
  if (!res.ok) throw Object.assign(new Error(data?.message || `GitHub ${res.status}`), { status: res.status })
  return data
}

// A draft has to be marked ready before it can be merged (GraphQL only)
async function markReady(nodeId) {
  await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('GITHUB_TOKEN')}`, 'User-Agent': 'jarvis-app' },
    body: JSON.stringify({ query: 'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){clientMutationId}}', variables: { id: nodeId } }),
  })
}

const firstLine = (s) => (s || '').split('\n').find(l => l.trim() && !/^(before:?\s*$|after:?\s*$|#|closes|fixes|resolves)/i.test(l.trim()))?.trim() || ''

export default async (req) => {
  const ready = !!env('GITHUB_TOKEN') && !!env('JARVIS_OWNER_EMAIL')
  if (req.method === 'GET' && new URL(req.url).searchParams.has('ping')) return json({ ready })
  if (!ready) return json({ error: 'not_configured' }, 503)
  if (!(await owner(req))) return json({ error: 'not_signed_in' }, 401)

  try {
    if (req.method === 'GET') {
      const month = new Date(Date.now() - 30 * 864e5).toISOString()
      const [issues, pulls, closed] = await Promise.all([
        gh(`/repos/${REPO}/issues?state=open&per_page=30`),
        gh(`/repos/${REPO}/pulls?state=open&per_page=30`),
        gh(`/repos/${REPO}/issues?state=closed&since=${month}&per_page=30`),
      ])
      const updates = pulls.map(p => ({
        number: p.number,
        title: p.title.replace(/^\[Jarvis\]\s*/, ''),
        summary: firstLine(p.body).slice(0, 160),
        preview: `https://deploy-preview-${p.number}--${SITE}.netlify.app`,
        url: p.html_url,
        by: p.user?.login,
      }))
      // Requests still being built: open "[Jarvis]" issues with no update pointing at them
      const building = issues
        .filter(i => !i.pull_request && /^\[Jarvis\]/.test(i.title))
        .filter(i => !pulls.some(p => new RegExp(`#${i.number}\\b`).test(p.body || '')))
        .map(i => ({ number: i.number, title: i.title.replace(/^\[Jarvis\]\s*/, ''), asked: i.created_at }))
      // Requests that went live in the last 30 days
      const done = closed
        .filter(i => !i.pull_request && /^\[Jarvis\]/.test(i.title) && i.state_reason === 'completed')
        .map(i => ({ number: i.number, title: i.title.replace(/^\[Jarvis\]\s*/, ''), closed: i.closed_at }))
      return json({ updates, building, done })
    }

    const { action, text = '', number } = await req.json()
    if (action === 'request') {
      const q = text.trim()
      if (!q) return json({ error: 'empty' }, 400)
      const title = '[Jarvis] ' + (q.length > 70 ? q.slice(0, 67) + '…' : q)
      const issue = await gh(`/repos/${REPO}/issues`, { method: 'POST', body: { title, body: q + NOTE } })
      return json({ ok: true, number: issue.number })
    }
    if (!Number.isInteger(number)) return json({ error: 'bad_request' }, 400)
    if (action === 'approve') {
      const pr = await gh(`/repos/${REPO}/pulls/${number}`)
      if (pr.draft) await markReady(pr.node_id)
      await gh(`/repos/${REPO}/pulls/${number}/merge`, { method: 'PUT', body: { merge_method: 'squash', commit_title: `${pr.title} (approved in Jarvis)` } })
      return json({ ok: true })
    }
    if (action === 'change') {
      if (!text.trim()) return json({ error: 'empty' }, 400)
      await gh(`/repos/${REPO}/issues/${number}/comments`, { method: 'POST', body: { body: 'Change request: ' + text.trim() + NOTE } })
      return json({ ok: true })
    }
    if (action === 'drop') {
      await gh(`/repos/${REPO}/issues/${number}/comments`, { method: 'POST', body: { body: 'Not wanted, closing.' + NOTE } })
      await gh(`/repos/${REPO}/pulls/${number}`, { method: 'PATCH', body: { state: 'closed' } })
      return json({ ok: true })
    }
    return json({ error: 'bad_request' }, 400)
  } catch (err) {
    if (err.status === 401) return json({ error: 'bad_key' }, 502)
    if (err.status === 405 || err.status === 409) return json({ error: 'not_mergeable' }, 409)
    return json({ error: 'api', detail: err.message }, 502)
  }
}
