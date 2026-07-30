import { type FormEvent, type PropsWithChildren, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { KeyRound, Mail, ShieldCheck } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { sendEmailOtp, verifyEmailOtp } from '../lib/api'
import { Button, Card } from './ui'

export function AuthGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [stage, setStage] = useState<'email' | 'code'>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (!hasSupabaseConfig) return children
  if (loading) return <div className="app-loading">Opening the house…</div>
  if (session) return children

  const submitEmail = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await sendEmailOtp(email)
      setStage('code')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the code.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await verifyEmailOtp(email, token)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That code did not work.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-story">
        <div className="brand brand-light">
          <div className="brand-mark">H</div>
          <strong>HowseHowld</strong>
        </div>
        <div>
          <p className="eyebrow">THE HOUSE, IN HARMONY</p>
          <h1>Less chasing.<br />More living.</h1>
          <p>
            Chores, shared money, schedules and the driveway—clear to everyone,
            all in one calm place.
          </p>
        </div>
        <div className="auth-trust">
          <ShieldCheck size={18} />
          Private to invited household members
        </div>
      </div>
      <Card className="auth-card">
        <div className="auth-icon">
          {stage === 'email' ? <Mail /> : <KeyRound />}
        </div>
        <p className="eyebrow">WELCOME HOME</p>
        <h2>{stage === 'email' ? 'Sign in to your house' : 'Check your email'}</h2>
        <p className="muted">
          {stage === 'email'
            ? 'We’ll send a six-digit code. No password to remember.'
            : `Enter the code sent to ${email}.`}
        </p>
        <form onSubmit={stage === 'email' ? submitEmail : submitCode}>
          {stage === 'email' ? (
            <label>
              Email address
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>
          ) : (
            <label>
              Six-digit code
              <input
                type="text"
                inputMode="numeric"
                value={token}
                onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                minLength={6}
                maxLength={6}
                autoComplete="one-time-code"
                required
              />
            </label>
          )}
          {error && <p className="form-error">{error}</p>}
          <Button size="lg" type="submit" disabled={busy}>
            {busy ? 'One moment…' : stage === 'email' ? 'Send my code' : 'Open the house'}
          </Button>
          {stage === 'code' && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStage('email')}
            >
              Use another email
            </Button>
          )}
        </form>
      </Card>
    </div>
  )
}
