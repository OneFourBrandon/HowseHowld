import { type FormEvent, type PropsWithChildren, useState } from 'react'
import { Home, Link2, Plus, Users } from 'lucide-react'
import { useAppData } from '../state/AppDataContext'
import { Button, Card } from './ui'

export function HouseholdGate({ children }: PropsWithChildren) {
  const {
    demoMode,
    initializing,
    needsHousehold,
    bootstrapError,
    busy,
    createHousehold,
    acceptInvite,
  } = useAppData()
  const [mode, setMode] = useState<'create' | 'join'>(
    new URLSearchParams(window.location.search).has('invite') ? 'join' : 'create',
  )
  const [name, setName] = useState('')
  const [token, setToken] = useState(
    new URLSearchParams(window.location.search).get('invite') ?? '',
  )

  if (demoMode) return children
  if (initializing) return <div className="app-loading">Opening the house…</div>
  if (bootstrapError) {
    return (
      <div className="gate-page">
        <Card className="gate-card">
          <h2>We couldn’t open the house.</h2>
          <p>{bootstrapError}</p>
          <Button onClick={() => window.location.reload()}>Try again</Button>
        </Card>
      </div>
    )
  }
  if (!needsHousehold) return children

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === 'create') await createHousehold(name.trim())
    else await acceptInvite(token.trim())
  }

  return (
    <div className="gate-page">
      <Card className="gate-card">
        <div className="brand gate-brand">
          <div className="brand-mark">H</div>
          <strong>HowseHowld</strong>
        </div>
        <div className="gate-icon">{mode === 'create' ? <Home /> : <Users />}</div>
        <p className="eyebrow">{mode === 'create' ? 'START A HOUSE' : 'JOIN YOUR ROOMMATES'}</p>
        <h2>{mode === 'create' ? 'Give the household a name.' : 'Use your private invite.'}</h2>
        <p className="muted">
          {mode === 'create'
            ? 'You’ll become the owner for invitations and household settings.'
            : 'The invite must match the email address you used to sign in.'}
        </p>
        <form onSubmit={submit}>
          {mode === 'create' ? (
            <label>Household name
              <input value={name} onChange={(event) => setName(event.target.value)} placeholder="The Maple House" minLength={2} required />
            </label>
          ) : (
            <label>Invite token
              <input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste your invite token" required />
            </label>
          )}
          <Button type="submit" size="lg" disabled={Boolean(busy)}>
            {mode === 'create' ? <><Plus size={18} /> Create household</> : <><Link2 size={18} /> Join household</>}
          </Button>
        </form>
        <button className="gate-switch" onClick={() => setMode(mode === 'create' ? 'join' : 'create')}>
          {mode === 'create' ? 'I already have an invite' : 'Create a new household instead'}
        </button>
      </Card>
    </div>
  )
}
