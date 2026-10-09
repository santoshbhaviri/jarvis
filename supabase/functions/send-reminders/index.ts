// supabase/functions/send-reminders/index.ts
// Sends each phone its morning summary at the user's chosen time, even when the app is closed.
// Deploy:  supabase functions deploy send-reminders --no-verify-jwt
// Secrets: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com CRON_SECRET=...
// Schedule it every 15 minutes (see README "Reminders").
import { createClient } from 'npm:@supabase/supabase-js@2.43.4'
import webpush from 'npm:web-push@3.6.7'

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
webpush.setVapidDetails(
  Deno.env.get('VAPID_SUBJECT')!,
  Deno.env.get('VAPID_PUBLIC_KEY')!,
  Deno.env.get('VAPID_PRIVATE_KEY')!,
)

// The user's local date and HH:MM, from their saved UTC offset in minutes
function localNow(offsetMin: number) {
  const d = new Date(Date.now() + offsetMin * 60_000)
  return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16) }
}

function summary(tasks: any[], today: string) {
  const todo    = tasks.filter(t => t.status !== 'routine' && !t.completed_at && (!t.due_date || t.due_date <= today))
  const starred = todo.filter(t => t.important)
  const carried = todo.filter(t => t.is_unfinished || (t.due_date && t.due_date < today)).length
  if (!todo.length) return 'Nothing planned yet. Add what you want to get done today.'
  const parts = [`${todo.length} task${todo.length > 1 ? 's' : ''} for today`]
  if (starred.length) parts.push(`${starred.length} important`)
  if (carried) parts.push(`${carried} carried over`)
  return parts.join(' · ') + (starred[0] ? `\nStart with: ${starred[0].title}` : '')
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const { data: subs, error } = await db.from('push_subscriptions').select('*')
  if (error) return new Response(error.message, { status: 500 })

  let sent = 0
  for (const s of subs ?? []) {
    const { date, time } = localNow(s.tz_offset)
    if (s.last_sent_on === date || time < String(s.remind_at).slice(0, 5)) continue

    const { data: tasks } = await db.from('tasks')
      .select('status,due_date,completed_at,is_unfinished,important,title')
      .eq('user_id', s.user_id)
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({
        title: 'JARVIS · today', body: summary(tasks ?? [], date), tag: 'jarvis-summary',
      }))
      sent++
      await db.from('push_subscriptions').update({ last_sent_on: date }).eq('id', s.id)
    } catch (e: any) {
      // Phone unsubscribed or app removed: forget this device
      if (e?.statusCode === 404 || e?.statusCode === 410) await db.from('push_subscriptions').delete().eq('id', s.id)
      else console.error('push failed', s.id, e?.statusCode, e?.body)
    }
  }
  return Response.json({ sent })
})
