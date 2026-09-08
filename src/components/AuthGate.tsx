import { useEffect, useState, type PropsWithChildren } from 'react'
import { hasSupabaseConfig } from '../lib/supabase'
import { joinHouseWithCode, signOut } from '../lib/api'
import { pendingJoin, setPendingJoin } from '../lib/pendingJoin'
import { authMessage, useAuth } from '../state/AuthContext'
import { Button } from './ui'

export function AuthGate({ children }: PropsWithChildren) {
  const auth = useAuth()!
  const [mode, setMode] = useState<'join' | 'signin' | 'create' | 'recover'>(() => pendingJoin() ?? 'signin')
  const [joining, setJoining] = useState(() => Boolean(pendingJoin()))
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)
  useEffect(() => {
    if (auth.session && !joining) { setSent(false); setToken(''); setWait(0); setError(''); setMode('signin') }
  }, [auth.session, joining])
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(timer) }, [wait])
  if (!hasSupabaseConfig) return children
  if (busy && (mode === 'join' || mode === 'recover') || auth.loading) return <div className="grid min-h-screen place-items-center">Opening your house…</div>
  if (auth.error) return <main className="mx-auto grid min-h-screen max-w-lg content-center gap-4 p-6"><h1 className="page-title">Reconnecting to your house</h1><p role="alert">{auth.error}</p><Button onClick={auth.retry}>Try again</Button></main>
  if (auth.session && !joining) return <div key={auth.session.user.id}>{children}</div>
  const send = async () => { await auth.sendCode(email, mode === 'create'); setSent(true); setWait(60) }
  return <main className="mx-auto grid min-h-svh w-full max-w-lg content-center gap-5 p-6">
    <strong className="text-xl">HowseHowld</strong>
    <nav className="grid grid-cols-3 gap-1 rounded-xl bg-(--sage-2) p-1" aria-label="Choose how to continue">
      {(['signin', 'join', 'create'] as const).map(value => <button key={value} disabled={busy || Boolean(joining && auth.session)} className={mode === value ? 'rounded-lg bg-(--surface-strong) px-2 py-3 text-sm font-bold' : 'px-2 py-3 text-sm'} onClick={() => { setMode(value); setJoining(false); setPendingJoin(null); setSent(false); setError(''); setToken('') }}>{value === 'signin' ? 'Sign in' : value === 'join' ? 'Join a house' : 'Create a house'}</button>)}
    </nav>
    <h1 className="page-title">{mode === 'recover' ? 'Restore your account' : mode === 'join' ? 'Join your house' : sent ? 'Enter your code' : mode === 'create' ? 'Create your house' : 'Welcome back'}</h1>
    <p className="text-sm text-(--muted)">{mode === 'join' ? 'Use your house code to join. No email required.' : mode === 'recover' ? 'Use a recovery code saved from Settings or supplied by your admin.' : sent ? 'Enter the six-digit code sent to ' + email + '. Use the newest code; it expires in one hour.' : 'Use your email to receive a six-digit sign-in code.'}</p>
    <form className="grid gap-4" onSubmit={async event => {
      event.preventDefault(); setBusy(true); setError('')
      try {
        if (mode === 'join' || mode === 'recover') {
          setJoining(true); setPendingJoin(mode)
          await joinHouseWithCode(code, mode === 'recover' ? '' : name)
          setPendingJoin(null); setJoining(false)
        }
        else if (sent) await auth.verifyCode(email, token)
        else await send()
      } catch (cause) { setError(authMessage(cause)) } finally { setBusy(false) }
    }}>
      {mode === 'join' || mode === 'recover' ? <>
        <label>{mode === 'recover' ? 'Recovery code' : 'House code'}<input autoComplete="off" value={code} onChange={event => setCode(event.target.value.toUpperCase())} required /></label>
        {mode === 'join' && <label>Your name<input value={name} onChange={event => setName(event.target.value)} autoComplete="name" minLength={2} maxLength={80} required /></label>}
      </> : sent ? <label>Six-digit code<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} required /></label> : <label>Email address<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>}
      {error && <p role="alert" className="text-sm text-(--coral)">{error}</p>}
      <Button type="submit" disabled={busy || (!sent && wait > 0 && (mode === 'signin' || mode === 'create'))}>{busy ? 'Please wait…' : mode === 'join' ? 'Join the house' : mode === 'recover' ? 'Restore my account' : sent ? 'Verify and continue' : wait ? 'Send again in ' + wait + 's' : 'Email me a code'}</Button>
      {sent && <><Button type="button" variant="secondary" disabled={busy || wait > 0} onClick={async () => { setBusy(true); setError(''); try { await send() } catch (cause) { setError(authMessage(cause)) } finally { setBusy(false) } }}>{wait ? 'Resend in ' + wait + 's' : 'Resend code'}</Button><Button type="button" variant="ghost" onClick={() => { setSent(false); setToken('') }}>Use another email</Button></>}
    </form>
    <button disabled={busy} className="text-sm text-(--forest-2)" onClick={() => { setMode('recover'); setSent(false); setError(''); setCode('') }}>Use a recovery code instead</button>
    {joining && auth.session && <Button variant="ghost" onClick={async () => { try { await signOut(); setJoining(false); setPendingJoin(null); setMode('signin'); setSent(false); setToken('') } catch (cause) { setError(authMessage(cause)) } }}>Cancel and return to sign in</Button>}
  </main>
}
