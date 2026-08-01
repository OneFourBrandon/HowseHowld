import { cn } from '../lib/cn'
import { type PropsWithChildren, type SubmitEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Home, ShieldCheck, Users } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { joinHouseWithCode, sendAdminMagicLink } from '../lib/api'
import { Button } from './ui'

type AuthMode = 'owner' | 'join'

export function AuthGate({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [authError, setAuthError] = useState('')
  const [authAttempt, setAuthAttempt] = useState(0)
  const [joining, setJoining] = useState(false)
  const [mode, setMode] = useState<AuthMode>(
    new URLSearchParams(window.location.search).has('code') ? 'owner' : 'join',
  )
  const [email, setEmail] = useState('')
  const [shareCode, setShareCode] = useState(
    new URLSearchParams(window.location.search).get('code') ?? '',
  )
  const [displayName, setDisplayName] = useState('')
  const [stage, setStage] = useState<'email' | 'sent'>('email')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const recoveryCodeMode = shareCode.replace(/[^A-Za-z0-9]/g, '').toUpperCase().startsWith('REC')

  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    let timer: number | undefined
    const syncSession = async () => {
      const { data } = await client.auth.getSession()
      if (!active || !data.session) return
      setSession(data.session)
      setAuthError('')
      setLoading(false)
    }
    const syncWhenVisible = () => {
      if (document.visibilityState === 'visible') void syncSession()
    }
    const syncFromStorage = (event: StorageEvent) => {
      if (event.key?.startsWith('sb-') && event.key.endsWith('-auth-token')) {
        void syncSession()
      }
    }
    setLoading(true)
    setAuthError('')
    const timeout = new Promise<never>((_, reject) => {
      timer = window.setTimeout(
        () => reject(new Error('The household backend did not respond.')),
        6_000,
      )
    })
    void Promise.race([client.auth.getSession(), timeout])
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setAuthError(
          'Could not reach local Supabase. Start the Supabase services in WebStorm, then try again.',
        )
        setLoading(false)
      })
    const { data } = client.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      setAuthError('')
      setLoading(false)
    })
    window.addEventListener('focus', syncSession)
    window.addEventListener('storage', syncFromStorage)
    document.addEventListener('visibilitychange', syncWhenVisible)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener('focus', syncSession)
      window.removeEventListener('storage', syncFromStorage)
      document.removeEventListener('visibilitychange', syncWhenVisible)
      data.subscription.unsubscribe()
    }
  }, [authAttempt])

  if (!hasSupabaseConfig) return children
  if (loading || joining) return <div className={"app-loading min-h-screen grid place-items-center text-(--forest) bg-(--paper) font-display"}>Opening your house…</div>
  if (authError) {
    return (
      <main className={"backend-unavailable grid content-center justify-items-start gap-8.5 w-[min(620px,calc(100%-40px))] min-h-svh mx-auto"}>
        <div className={"brand flex items-center gap-3"}>
          <div className={"brand-mark w-9.5 h-9.5 grid place-items-center rounded-xl text-(--forest) bg-[#f1d799] font-display text-[1.3rem] font-bold"}>H</div>
          <strong className={"block font-display text-[1.18rem] tracking-[-.02em]"}>HowseHowld</strong>
        </div>
        <div className={"grid gap-2.5"}>
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>LOCAL BACKEND OFFLINE</p>
          <h1 className={"text-[clamp(2.2rem,6vw,4.5rem)] leading-[.98]"}>Your house couldn’t open.</h1>
          <p className={"max-w-135 text-(--muted) leading-[1.6]"}>{authError}</p>
        </div>
        <Button onClick={() => setAuthAttempt((attempt) => attempt + 1)}>
          Try again
        </Button>
      </main>
    )
  }
  if (session) return children

  const submitEmail = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await sendAdminMagicLink(email)
      setStage('sent')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send the sign-in link.')
    } finally {
      setBusy(false)
    }
  }

  const submitHouseCode = async (event: SubmitEvent<HTMLFormElement>) => {
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
    <div className={"auth-page min-h-screen grid grid-cols-[0.9fr_1.1fr] bg-(--paper) max-[640px]:grid-cols-1 max-[640px]:items-center max-[640px]:p-3.5 max-[980px]:block max-[980px]:p-0"}>
      <div className={"auth-story p-[clamp(32px,6vw,88px)] flex flex-col justify-between text-white bg-(--forest) max-[640px]:hidden"}>
        <div className={"brand brand-light flex items-center gap-3"}>
          <div className={"brand-mark mr-0.5 w-9.5 h-9.5 grid place-items-center rounded-xl text-(--forest) bg-[#f1d799] font-display text-[1.3rem] font-bold"}>H</div>
          <strong className={"block font-display text-[1.18rem] tracking-[-.02em]"}>HowseHowld</strong>
        </div>
        <div>
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>ONE APP, EVERY HOUSE</p>
          <h1 className={"mt-3.5 text-[clamp(3.2rem,7vw,6.4rem)] leading-[.91]"}>Less chasing.<br />More living.</h1>
          <p className={"max-w-135 mt-6.25 text-[#cadac4] text-[1rem] leading-[1.6]"}>
            Each house gets its own private space for chores, money, schedules,
            vehicles and the routines that keep everyone moving.
          </p>
        </div>
        <div className={"auth-trust flex items-center gap-2 text-[#cadac4] text-[.8rem]"}>
          <ShieldCheck size={18} />
          Every household is isolated and private
        </div>
      </div>

      <main className={"auth-panel min-w-0 grid items-center p-[clamp(10px,3vw,96px)] max-[980px]:min-h-screen max-[980px]:p-[clamp(28px,8vw,72px)] max-[640px]:p-[24px_20px_40px]"}>
        <div className={"auth-content w-[min(600px,80%)] h-[min(620px,calc(100vh-48px))] overflow-y-auto scrollbar-gutter-stable mx-auto max-[980px]:w-[min(620px,100%)] max-[980px]:h-auto max-[980px]:overflow-visible max-[980px]:scrollbar-gutter-auto"}>
        <div className={"auth-mode-switch grid grid-cols-2 gap-1 mb-7 p-1 border border-(--line) rounded-[10px] bg-[#edf1ed] max-[640px]:mb-5.5"} aria-label="Choose how to continue">
          <button
            type="button"
            className={cn(
              'min-h-10.5 p-[8px_10px] inline-flex items-center justify-center gap-1.75 border-0 rounded-[7px] text-(--muted) bg-transparent text-[.76rem] font-[750] max-[640px]:text-[.7rem]',
              mode === 'join' && 'is-active text-(--forest) bg-(--surface-strong) shadow-[0_1px_4px_rgba(28,48,40,.1)]',
            )}
            onClick={() => selectMode('join')}
          >
            <Users size={17} /> Join with code
          </button>
          <button
              type="button"
              className={cn(
                'min-h-10.5 p-[8px_10px] inline-flex items-center justify-center gap-1.75 border-0 rounded-[7px] text-(--muted) bg-transparent text-[.76rem] font-[750] max-[640px]:text-[.7rem]',
                mode === 'owner' && 'is-active text-(--forest) bg-(--surface-strong) shadow-[0_1px_4px_rgba(28,48,40,.1)]',
              )}
              onClick={() => selectMode('owner')}
          >
            <Home size={17} /> Create/Manage as Admin
          </button>
        </div>

        <h2 className={"max-w-full mt-2.5 text-[clamp(2.15rem,3.1vw,3.25rem)] leading-[1.02] max-[640px]:text-[2.25rem]"}>
          {mode === 'join'
            ? 'Use a house or recovery code'
            : stage === 'email'
              ? 'Admin Login/Creation'
              : 'Open your sign-in link'}
        </h2>
        <p className={"muted max-w-full mt-3.5 text-(--muted) text-[.9rem] leading-[1.6]"}>
          {mode === 'join'
            ? 'Join with your house share code, or use a one-time recovery code from your admin to restore your roommate account.'
            : stage === 'email'
              ? 'House admins use a recoverable email account. We’ll email you a secure sign-in link.'
              : `We sent a one-time sign-in link to ${email}. Open it in this browser to continue. If your email app uses another browser, copy the link into this one.`}
        </p>

        {mode === 'join' ? (
          <form className={"grid gap-4 mt-8"} onSubmit={submitHouseCode}>
            <label className={"text-[.78rem]"}>
              House share or recovery code
              <input
                className={"min-h-13 text-[.9rem]"}
                value={shareCode}
                onChange={(event) => setShareCode(event.target.value.toUpperCase())}
                placeholder="ABC-123-DEF-456 or REC-1234-5678-9ABC-DEF0"
                autoComplete="off"
                minLength={12}
                required
              />
            </label>
            <label className={"text-[.78rem]"}>
              Your name <span className={"field-hint ml-1.25 text-(--muted) text-[.72rem] font-medium"}>{recoveryCodeMode ? 'Optional for recovery' : 'Required for a new account'}</span>
              <input
                className={"min-h-13 text-[.9rem]"}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Brandon"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required={!recoveryCodeMode}
              />
            </label>
            {error && <p className={"form-error mt-1.25 text-(--coral) text-[.75rem]"}>{error}</p>}
            <Button size="lg" type="submit" disabled={busy}>
              {busy ? 'Joining…' : recoveryCodeMode ? 'Restore my account' : 'Join the house'}
            </Button>
          </form>
        ) : (
          <form className={"grid gap-4 mt-8"} onSubmit={submitEmail}>
            {stage === 'email' ? (
              <label className={"text-[.78rem]"}>
                Email address
                <input
                  className={"min-h-13 text-[.9rem]"}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            ) : null}
            {error && <p className={"form-error mt-1.25 text-(--coral) text-[.75rem]"}>{error}</p>}
            {stage === 'email' ? (
              <Button size="lg" type="submit" disabled={busy}>
                {busy ? 'Sending link…' : 'Email me a sign-in link'}
              </Button>
            ) : (
              <>
                <Button type="button" onClick={() => setAuthAttempt((attempt) => attempt + 1)}>
                  I opened the link — check again
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStage('email')}>
                  Use another email or resend
                </Button>
              </>
            )}
          </form>
        )}
        </div>
      </main>
    </div>
  )
}
