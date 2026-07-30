import { type FormEvent, type PropsWithChildren, useState } from 'react'
import { Home, Plus } from 'lucide-react'
import { HOUSEHOLD_FEATURES, type HouseholdFeature } from '../types'
import { signOut } from '../lib/api'
import { useAppData } from '../state/AppDataContext'
import { Button, Card } from './ui'
import { FeatureChecklist } from './FeatureChecklist'

export function HouseholdGate({ children }: PropsWithChildren) {
  const {
    demoMode,
    initializing,
    needsHousehold,
    bootstrapError,
    busy,
    createHousehold,
  } = useAppData()
  const [name, setName] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [addressLine2, setAddressLine2] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('ON')
  const [postalCode, setPostalCode] = useState('')
  const [enabledFeatures, setEnabledFeatures] = useState<HouseholdFeature[]>(
    [...HOUSEHOLD_FEATURES],
  )
  const [error, setError] = useState('')

  if (demoMode) return children
  if (initializing) return <div className="app-loading">Opening your house…</div>
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

  const toggleFeature = (feature: HouseholdFeature) => {
    setEnabledFeatures((current) =>
      current.includes(feature)
        ? current.filter((item) => item !== feature)
        : [...current, feature],
    )
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    if (!enabledFeatures.length) {
      setError('Choose at least one household feature.')
      return
    }
    try {
      await createHousehold({
        name: name.trim(),
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        region: region.trim(),
        postalCode: postalCode.trim(),
        countryCode: 'CA',
        enabledFeatures,
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create the household.')
    }
  }

  return (
    <div className="gate-page household-setup-page">
      <main className="household-setup-shell">
        <header className="household-setup-header">
          <div className="brand gate-brand">
            <div className="brand-mark">H</div>
            <strong>HowseHowld</strong>
          </div>
          <div className="setup-intro">
            <div className="gate-icon" aria-hidden="true"><Home /></div>
            <div>
              <p className="eyebrow">SET UP YOUR HOUSE</p>
              <h1>Create your private household.</h1>
              <p className="muted">
                You’ll be the admin. After setup, share the generated house code with
                everyone who lives here.
              </p>
            </div>
          </div>
        </header>

        <form className="household-setup-form" onSubmit={submit}>
          <div className="form-section">
            <h2>House details</h2>
            <label>
              Household name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="The Maple House"
                minLength={2}
                maxLength={100}
                required
              />
            </label>
            <label>
              Street address
              <input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                placeholder="42 Maple Street"
                required
              />
            </label>
            <label>
              Unit or apartment <span className="optional-label">Optional</span>
              <input
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
                placeholder="Unit 2"
              />
            </label>
            <div className="form-grid-three">
              <label>
                City
                <input value={city} onChange={(event) => setCity(event.target.value)} required />
              </label>
              <label>
                Province
                <input
                  value={region}
                  onChange={(event) => setRegion(event.target.value.toUpperCase())}
                  maxLength={2}
                  required
                />
              </label>
              <label>
                Postal code
                <input
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value.toUpperCase())}
                  placeholder="M4B 1B3"
                  required
                />
              </label>
            </div>
          </div>

          <fieldset className="feature-picker">
            <legend>Choose your features</legend>
            <p>Today and Settings are always included.</p>
            <FeatureChecklist
              enabledFeatures={enabledFeatures}
              onToggle={toggleFeature}
            />
          </fieldset>

          <div className="setup-actions">
            {error && <p className="form-error">{error}</p>}
            <Button type="submit" size="lg" disabled={Boolean(busy)}>
              <Plus size={18} /> Create household
            </Button>
            <button className="gate-switch" type="button" onClick={() => signOut()}>
              Sign out and use another account
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
