// oxlint-disable react/only-export-components -- provider and typed hook share one private context
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function authMessage(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Please try again.'
  if (/expired|invalid.*otp|token.*invalid/i.test(message)) return 'That code is invalid or expired. Request a new code and try again.'
  if (/rate|too many|seconds/i.test(message)) return 'Please wait before requesting another code.'
  if (/signups not allowed|user not found/i.test(message)) return 'No sign-in account was found. Use your verified recovery email, or restore your account with a recovery code.'
  if (/fetch|network/i.test(message)) return 'Could not connect. Check your connection and try again; your account has not been reset.'
  return message
}

function useAuthState() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(Boolean(supabase))
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    let generation = 0
    let timer: number | undefined
    const sync = async () => {
      const current = ++generation
      try {
        const result = await client.auth.getSession()
        if (!active || current !== generation) return
        if (result.error) throw result.error
        setSession(result.data.session)
        setError('')
      } catch {
        if (active && current === generation) setError('We could not reconnect to your account. Check your connection and retry.')
      } finally { if (active && current === generation) { clearTimeout(timer); setLoading(false) } }
    }
    const { data } = client.auth.onAuthStateChange((event, next) => {
      if (!active) return
      // auth-js also emits INITIAL_SESSION(null) when initialization fails.
      // Only a successful getSession read or explicit SIGNED_OUT proves absence.
      if (!next && event !== 'SIGNED_OUT') return
      generation++
      clearTimeout(timer)
      setSession(next); setLoading(false); setError('')
    })
    const visible = () => { if (document.visibilityState === 'visible') void sync() }
    timer = window.setTimeout(() => { if (active) { setLoading(false); setError('Reconnecting is taking longer than expected. Please retry.') } }, 15000)
    void sync()
    window.addEventListener('online', sync)
    window.addEventListener('focus', sync)
    document.addEventListener('visibilitychange', visible)
    return () => { active = false; clearTimeout(timer); data.subscription.unsubscribe(); window.removeEventListener('online', sync); window.removeEventListener('focus', sync); document.removeEventListener('visibilitychange', visible) }
  }, [attempt])
  return {
    session, user: session?.user, loading, error,
    isAnonymous: Boolean(session?.user.is_anonymous),
    emailVerified: Boolean(session?.user.email_confirmed_at) && !session?.user.is_anonymous,
    retry: () => { setLoading(true); setError(''); setAttempt(value => value + 1) },
    sendCode: async (email: string, create = false) => {
      const result = await supabase!.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: create } })
      if (result.error) throw result.error
    },
    verifyCode: async (email: string, token: string) => {
      const result = await supabase!.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email' })
      if (result.error) throw result.error
    },
    linkEmail: async (email: string) => {
      const result = await supabase!.auth.updateUser({ email: email.trim().toLowerCase() })
      if (result.error) throw result.error
    },
    verifyEmail: async (email: string, token: string) => {
      const id = session?.user.id
      const result = await supabase!.auth.verifyOtp({ email: email.trim().toLowerCase(), token, type: 'email_change' })
      if (result.error) throw result.error
      const refreshed = await supabase!.auth.refreshSession()
      if (refreshed.error) throw refreshed.error
      const checked = await supabase!.auth.getUser()
      if (checked.error) throw checked.error
      if (checked.data.user.id !== id || checked.data.user.is_anonymous || !checked.data.user.email_confirmed_at) throw new Error('Email verification is not complete yet. Check your inbox for any remaining confirmation.')
      setSession(refreshed.data.session)
    },
  }
}
const AuthContext = createContext<ReturnType<typeof useAuthState> | null>(null)
export function AuthProvider({ children }: PropsWithChildren) { return <AuthContext.Provider value={useAuthState()}>{children}</AuthContext.Provider> }
export function useAuth() { return useContext(AuthContext) }
