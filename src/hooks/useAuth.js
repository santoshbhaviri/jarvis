// src/hooks/useAuth.js
// Supabase email + password login. Each person only sees their own tasks (see supabase-schema-v3.sql).
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [session, setSession] = useState(undefined)   // undefined = still checking

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signUp  = (email, password) => supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
  const signOut = () => supabase.auth.signOut()

  return { session, user: session?.user ?? null, signIn, signUp, signOut }
}
