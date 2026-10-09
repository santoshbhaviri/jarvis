// src/hooks/useReminders.js
// Phone reminders.
//  • Push (works with the app closed): needs VITE_VAPID_PUBLIC_KEY and the
//    send-reminders edge function — see README "Reminders".
//  • In-app: whenever the app is open after 7 am, shows the day's summary once.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { todayStr } from '../lib/dateUtils'
import { daySummary } from '../lib/summary'

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY
const SHOWN_KEY = 'jarvis-summary-shown'
const supported = typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export function useReminders(tasks, loading) {
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported')

  // Save this device's push subscription so the server can remind it
  const subscribePush = useCallback(async () => {
    if (!VAPID_KEY || !('PushManager' in window)) return
    const reg = await navigator.serviceWorker.ready
    const sub = (await reg.pushManager.getSubscription()) ||
      await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_KEY) })
    const json = sub.toJSON()
    const { error } = await supabase.from('push_subscriptions').upsert(
      { endpoint: json.endpoint, subscription: json, tz_offset: -new Date().getTimezoneOffset() },
      { onConflict: 'endpoint' }
    )
    if (error) console.error('push subscribe error:', error)
  }, [])

  const enable = useCallback(async () => {
    if (!supported) return 'unsupported'
    const p = await Notification.requestPermission()
    setPermission(p)
    if (p === 'granted') await subscribePush()
    return p
  }, [subscribePush])

  // Keep the subscription fresh on every open
  useEffect(() => {
    if (permission === 'granted') subscribePush().catch(e => console.error(e))
  }, [permission, subscribePush])

  // In-app morning summary, once per day
  useEffect(() => {
    if (loading || permission !== 'granted') return
    const check = async () => {
      const today = todayStr()
      if (new Date().getHours() < 7) return
      try { if (localStorage.getItem(SHOWN_KEY) === today) return } catch { /* private mode */ }
      const { count, text } = daySummary(tasks, today)
      if (!count) return
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('JARVIS · today', { body: text, tag: 'jarvis-summary', icon: '/icon-192.png', badge: '/icon-192.png' })
      try { localStorage.setItem(SHOWN_KEY, today) } catch { /* private mode */ }
    }
    check()
    const id = setInterval(check, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [tasks, loading, permission])

  return { permission, enable, pushConfigured: !!VAPID_KEY }
}
