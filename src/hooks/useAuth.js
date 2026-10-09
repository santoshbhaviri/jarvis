// src/hooks/useAuth.js
// Supabase email + password login. Each person only sees their own tasks (see supabase-schema-v3.sql).
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { clearAll } from '../lib/outbox'

export function useAuth() {
  const [session, setSession] = useState(undefined)   // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // The copy of tasks kept on the phone belongs to one person: clear it when the person changes
  const signIn  = (email, password) => { clearAll(); return supabase.auth.signInWithPassword({ email, password }) }
  const signUp  = (email, password) => supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
  const signOut = () => { clearAll(); return supabase.auth.signOut() }

  return { session, user: session?.user ?? null, signIn, signUp, signOut }
}
