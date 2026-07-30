import { type FormEvent, type PropsWithChildren, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Home, KeyRound, Mail, ShieldCheck, Users } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { joinHouseWithCode, sendEmailOtp, verifyEmailOtp } from '../lib/api'
import { Button } from './ui'

type AuthMode = 'owner' | 'join'

export function AuthGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [joining, setJoining] = useState(false)
  const [mode, setMode] = useState<AuthMode>(
    new URLSearchParams(window.location.search).has('code') ? 'join' : 'owner',
  )
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [shareCode, setShareCode] = useState(
    new URLSearchParams(window.location.search).get('code') ?? '',
  )
  const [displayName, setDisplayName] = useState('')
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
  if (loading || joining) return <div className="app-loading">Opening your house…</div>
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

  const submitHouseCode = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setJoining(true)
    setError('')
    try {
      await joinHouseWithCode(shareCode, displayName)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That house code did not work.')
    } finally {
      setJoining(false)
      setBusy(false)
    }
  }

  const selectMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    setStage('email')
    setError('')
  }

  return (
    <div className="auth-page">
      <div className="auth-story">
        <div className="brand brand-light">
          <div className="brand-mark">H</div>
          <strong>HowseHowld</strong>
        </div>
        <div>
          <p className="eyebrow">ONE APP, EVERY HOUSE</p>
          <h1>Less chasing.<br />More living.</h1>
          <p>
            Each house gets its own private space for chores, money, schedules,
            vehicles and the routines that keep everyone moving.
          </p>
        </div>
        <div className="auth-trust">
          <ShieldCheck size={18} />
          Every household is isolated and private
        </div>
      </div>

      <main className="auth-panel">
        <div className="auth-content">
        <div className="auth-mode-switch" aria-label="Choose how to continue">
          <button
            type="button"
            className={mode === 'owner' ? 'is-active' : ''}
            onClick={() => selectMode('owner')}
          >
            <Home size={17} /> Create or manage
          </button>
          <button
            type="button"
            className={mode === 'join' ? 'is-active' : ''}
            onClick={() => selectMode('join')}
          >
            <Users size={17} /> Join with code
          </button>
        </div>

        <div className="auth-icon">
          {mode === 'join' ? <Users /> : stage === 'email' ? <Mail /> : <KeyRound />}
        </div>
        <p className="eyebrow">{mode === 'join' ? 'JOIN YOUR HOUSE' : 'HOUSE ADMIN'}</p>
        <h2>
          {mode === 'join'
            ? 'Use your house code'
            : stage === 'email'
              ? 'Create or open your account'
              : 'Check your email'}
        </h2>
        <p className="muted">
          {mode === 'join'
            ? 'No email needed. Your account stays on this device until you link a recovery email.'
            : stage === 'email'
              ? 'House admins use a recoverable email account. We’ll send a six-digit code.'
              : `Enter the code sent to ${email}.`}
        </p>

        {mode === 'join' ? (
          <form onSubmit={submitHouseCode}>
            <label>
              House share code
              <input
                value={shareCode}
                onChange={(event) => setShareCode(event.target.value.toUpperCase())}
                placeholder="ABC-123-DEF-456"
                autoComplete="off"
                minLength={12}
                required
              />
            </label>
            <label>
              Your name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Alex"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
            {error && <p className="form-error">{error}</p>}
            <Button size="lg" type="submit" disabled={busy}>
              {busy ? 'Joining…' : 'Join the house'}
            </Button>
            <p className="anonymous-account-note">
              This is a device-based account. Link an email later in Settings
              before signing out or moving to another phone.
            </p>
          </form>
        ) : (
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
              {busy ? 'One moment…' : stage === 'email' ? 'Send my code' : 'Continue'}
            </Button>
            {stage === 'code' && (
              <Button type="button" variant="ghost" onClick={() => setStage('email')}>
                Use another email
              </Button>
            )}
          </form>
        )}
        </div>
      </main>
    </div>
  )
}
