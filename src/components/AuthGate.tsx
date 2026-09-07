import { cn } from '../lib/cn'
import { type PropsWithChildren, type SubmitEvent, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Home, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'
import { joinHouseWithCode, sendAdminMagicLink } from '../lib/api'
import { Button } from './ui'
import { BrandMark } from './BrandMark'

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
  if (loading || joining) return <div className="grid min-h-dvh place-items-center bg-(--bg) text-[.95rem] font-semibold text-(--text-3)">Opening your house…</div>
  if (authError) {
    return (
      <main className="mx-auto grid min-h-dvh w-[min(620px,calc(100%-40px))] content-center justify-items-start gap-7">
        <div className={"brand flex items-center gap-3"}>
          <BrandMark size={38} />
          <strong className="text-[1.05rem] font-extrabold tracking-[-.02em]">HowseHowld</strong>
        </div>
        <div className={"grid gap-2.5"}>
          <p className="text-[.74rem] font-bold tracking-[.08em] text-(--text-3) uppercase">LOCAL BACKEND OFFLINE</p>
          <h1 className="text-[clamp(2rem,5vw,3.2rem)] leading-[1.02]">Your house couldn’t open.</h1>
          <p className={"max-w-135 text-(--text-3) leading-[1.6]"}>{authError}</p>
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
    <div className="relative grid min-h-dvh grid-cols-[0.95fr_1.05fr] overflow-hidden bg-(--bg) max-[980px]:block">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-55 -left-45 size-180 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(242,80,140,.42), rgba(242,80,140,0))' }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-80 left-75 size-190 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(59,107,255,.38), rgba(59,107,255,0))' }}
      />
      <div className="relative flex flex-col justify-between p-[clamp(32px,6vw,72px)] text-(--text) max-[980px]:hidden">
        <div className="flex items-center gap-3">
          <BrandMark size={38} />
          <strong className="text-[1.05rem] font-extrabold tracking-[-.02em]">HowseHowld</strong>
        </div>
        <div>
          <span className="hh-pill mb-5">
            <Sparkles size={14} className="text-(--pink)" /> One app, every house
          </span>
          <h1 className="text-[clamp(3rem,6vw,5.4rem)] leading-[.94]">
            Less chasing.<br />
            <span className="text-(--text-3)">More living.</span>
          </h1>
          <p className="mt-6 max-w-115 text-[1rem] leading-relaxed text-(--text-3)">
            Each house gets its own private space for chores, money, schedules,
            vehicles and the routines that keep everyone moving.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            {['Chores', 'Shared money', 'Calendar', 'Driveway'].map((label) => (
              <span className="hh-pill bg-[rgba(255,255,255,.05)]" key={label}>{label}</span>
            ))}
          </div>
        </div>
        <div className="relative flex items-center gap-2 text-[.82rem] text-(--text-3)">
          <ShieldCheck size={18} />
          Every household is isolated and private
        </div>
      </div>

      <main className="relative z-1 grid min-w-0 items-center p-[clamp(20px,3vw,72px)] max-[980px]:min-h-dvh max-[980px]:p-[clamp(24px,7vw,56px)] max-[640px]:p-[24px_18px_40px]">
        <div className="hh-card mx-auto w-[min(520px,100%)] rounded-3xl bg-[rgba(21,22,26,.92)] p-7 backdrop-blur-xl max-[640px]:p-5">
        <div className="hh-navpill mb-6 grid grid-cols-2 p-1 max-[640px]:mb-5" aria-label="Choose how to continue">
          <button
            type="button"
            className={cn(
              'hh-navitem h-10 px-3 text-[.8rem] max-[640px]:text-[.74rem]',
              mode === 'join' && 'hh-navitem-on',
            )}
            onClick={() => selectMode('join')}
          >
            <Users size={17} /> Join with code
          </button>
          <button
              type="button"
              className={cn(
                'hh-navitem h-10 px-3 text-[.8rem] max-[640px]:text-[.74rem]',
                mode === 'owner' && 'hh-navitem-on',
              )}
              onClick={() => selectMode('owner')}
          >
            <Home size={17} /> Create/Manage as Admin
          </button>
        </div>

        <h2 className="mt-1 max-w-full text-[clamp(1.6rem,2.4vw,2rem)] leading-[1.05]">
          {mode === 'join'
            ? 'Use a house or recovery code'
            : stage === 'email'
              ? 'Admin Login/Creation'
              : 'Open your sign-in link'}
        </h2>
        <p className="mt-3 max-w-full text-[.88rem] leading-relaxed text-(--text-3)">
          {mode === 'join'
            ? 'Join with your house share code, or use a one-time recovery code from your admin to restore your roommate account.'
            : stage === 'email'
              ? 'House admins use a recoverable email account. We’ll email you a secure sign-in link.'
              : `We sent a one-time sign-in link to ${email}. Open it in this browser to continue. If your email app uses another browser, copy the link into this one.`}
        </p>

        {mode === 'join' ? (
          <form className="mt-6 grid gap-4" onSubmit={submitHouseCode}>
            <label className={"text-[.78rem]"}>
              House share or recovery code
              <input
                className="min-h-12 text-[.92rem]"
                value={shareCode}
                onChange={(event) => setShareCode(event.target.value.toUpperCase())}
                placeholder="ABC-123-DEF-456 or REC-1234-5678-9ABC-DEF0"
                autoComplete="off"
                minLength={12}
                required
              />
            </label>
            <label className={"text-[.78rem]"}>
              Your name <span className="ml-1.5 text-[.74rem] font-medium text-(--text-3)">{recoveryCodeMode ? 'Optional for recovery' : 'Required for a new account'}</span>
              <input
                className="min-h-12 text-[.92rem]"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Brandon"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required={!recoveryCodeMode}
              />
            </label>
            {error && <p className="mt-1 text-[.78rem] text-[#ff8080]">{error}</p>}
            <Button size="lg" type="submit" disabled={busy}>
              {busy ? 'Joining…' : recoveryCodeMode ? 'Restore my account' : 'Join the house'}
            </Button>
          </form>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={submitEmail}>
            {stage === 'email' ? (
              <label className={"text-[.78rem]"}>
                Email address
                <input
                  className="min-h-12 text-[.92rem]"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
              </label>
            ) : null}
            {error && <p className="mt-1 text-[.78rem] text-[#ff8080]">{error}</p>}
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
