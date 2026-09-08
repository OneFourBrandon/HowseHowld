import { useEffect, useState } from 'react'
import { authMessage, useAuth } from '../state/AuthContext'
import { Button } from './ui'

export function EmailRecovery({ reminder = false }: { reminder?: boolean }) {
  const auth = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [wait, setWait] = useState(0)
  const key = `howse:recovery-dismissed:${auth?.user?.id}`
  useEffect(() => { try { setDismissed(sessionStorage.getItem(key) === 'true') } catch { /* Storage may be unavailable. */ } }, [key])
  useEffect(() => { if (!wait) return; const timer = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(timer) }, [wait])
  if (!auth?.user) return null
  const verified = !auth.user.is_anonymous && Boolean(auth.user.email_confirmed_at)
  if (reminder && (verified || dismissed)) return null
  if (verified) {
    const [name, domain] = (auth.user.email ?? '').split('@')
    return <p className="text-sm text-(--green)">Email sign-in enabled · {name.slice(0, 1)}•••@{domain}</p>
  }
  const send = async () => { setBusy(true); setError(''); try { await auth.linkEmail(email); setSent(true); setWait(60) } catch (cause) { setError(authMessage(cause)) } finally { setBusy(false) } }
  return <section className="rounded-xl border border-(--line) bg-(--surface-strong) p-4">
    <strong>Protect your account</strong>
    <p className="my-2 text-sm text-(--muted)">Add an email to sign in on another device without asking your admin for a recovery code.</p>
    <form className="flex flex-wrap items-end gap-2" onSubmit={async event => {
      event.preventDefault()
      if (!sent) { await send(); return }
      setBusy(true); setError('')
      try { await auth.verifyEmail(email, token) } catch (cause) { setError(authMessage(cause)) } finally { setBusy(false) }
    }}>
      <label className="min-w-0 flex-1">{sent ? 'Six-digit verification code' : 'Recovery email'}
        {sent ? <input value={token} onChange={event => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /> : <input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required />}
      </label>
      <Button type="submit" disabled={busy || (!sent && wait > 0)}>{sent ? 'Verify email' : wait ? `Send again in ${wait}s` : 'Send code'}</Button>
      {sent && <><Button type="button" variant="ghost" disabled={busy || wait > 0} onClick={() => void send()}>{wait ? `Resend in ${wait}s` : 'Resend code'}</Button><Button type="button" variant="ghost" onClick={() => { setSent(false); setToken('') }}>Change email</Button></>}
      {reminder && <Button type="button" variant="ghost" onClick={() => { setDismissed(true); try { sessionStorage.setItem(key, 'true') } catch { /* Optional persistence. */ } }}>Later</Button>}
    </form>
    {sent && <p className="mt-2 text-xs text-(--muted)">Code sent to {email}. Use the newest code; it expires in one hour.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-(--coral)">{error}</p>}
  </section>
}
