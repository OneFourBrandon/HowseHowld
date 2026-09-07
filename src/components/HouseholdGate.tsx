import { type PropsWithChildren, type SubmitEvent, useState } from 'react'
import { Home, Plus } from 'lucide-react'
import { HOUSEHOLD_FEATURES, type HouseholdFeature } from '../types'
import { signOut } from '../lib/api'
import { useAppData } from '../state/AppDataContext'
import { Button, Card } from './ui'
import { BrandMark } from './BrandMark'
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
  if (initializing) return <div className={"app-loading min-h-screen grid place-items-center text-(--text) bg-(--bg) font-display"}>Opening your house…</div>
  if (bootstrapError) {
    return (
      <div className={"gate-page min-h-screen grid place-items-center p-5 bg-[radial-gradient(circle_at_50%_0,#e8eadf,var(--paper)_45%)]"}>
        <Card className="gate-card w-[min(460px,100%)] border-l-[3px] border-l-(--gold) bg-transparent p-8 text-center">
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

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
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
    <div className={"gate-page household-setup-page min-h-screen block p-[clamp(28px,4vw,64px)] bg-(--bg) max-[640px]:p-[22px_18px_36px]"}>
      <main className={"household-setup-shell w-[min(1240px,100%)] mx-auto"}>
        <header className="household-setup-header border-b border-b-(--line) pb-[clamp(28px,4vw,52px)]">
          <div className="brand gate-brand mb-[clamp(32px,5vw,64px)] flex items-center justify-start gap-3 max-[640px]:mb-8.5">
            <BrandMark size={38} />
            <strong className="block font-display text-[1.18rem] tracking-[-.02em] text-(--text)">HowseHowld</strong>
          </div>
          <div className="setup-intro grid grid-cols-[56px_minmax(0,720px)] items-start gap-5.5 max-[640px]:grid-cols-1 max-[640px]:gap-4">
            <div className="gate-icon m-0 grid h-13 w-13 place-items-center justify-center rounded-[10px] bg-(--violet-soft) text-(--text) max-[640px]:h-10.5 max-[640px]:w-10.5" aria-hidden="true"><Home className="m-0 block" /></div>
            <div>
              <p className={"eyebrow text-(--amber) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>SET UP YOUR HOUSE</p>
              <h1 className="mt-1.5 text-[clamp(2.4rem,4.4vw,4.6rem)] leading-[.98] max-[640px]:text-[2.25rem] max-[640px]:leading-[1.02]">Create your private household.</h1>
              <p className="muted mt-3.25 max-w-162.5 text-[.92rem] leading-[1.6] text-(--text-3)">
                You’ll be the admin. After setup, share the generated house code with
                everyone who lives here.
              </p>
            </div>
          </div>
        </header>

        <form className="household-setup-form grid grid-cols-[minmax(0,1.35fr)_minmax(330px,.85fr)] gap-x-[clamp(56px,8vw,120px)] gap-y-7 pt-[clamp(34px,5vw,64px)] max-[980px]:grid-cols-1 max-[980px]:gap-11.5 max-[640px]:gap-9.5 max-[640px]:pt-8.5" onSubmit={submit}>
          <div className="form-section grid grid-cols-2 content-start gap-4.5 max-[640px]:grid-cols-1">
            <h2 className="col-span-full mb-2 text-[1.35rem] font-[750]">House details</h2>
            <label className="col-span-full text-[.76rem]">
              Household name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="The Maple House"
                minLength={2}
                maxLength={100}
                required
                className="min-h-12.5 text-[.87rem]"
              />
            </label>
            <label className="col-span-full text-[.76rem]">
              Street address
              <input
                value={addressLine1}
                onChange={(event) => setAddressLine1(event.target.value)}
                placeholder="42 Maple Street"
                required
                className="min-h-12.5 text-[.87rem]"
              />
            </label>
            <label className="col-span-full text-[.76rem]">
              Unit or apartment <span className={"optional-label ml-1.25 text-(--text-3) font-medium"}>Optional</span>
              <input
                value={addressLine2}
                onChange={(event) => setAddressLine2(event.target.value)}
                placeholder="Unit 2"
                className="min-h-12.5 text-[.87rem]"
              />
            </label>
            <div className="form-grid-three col-span-full grid grid-cols-[1.35fr_.6fr_.9fr] gap-3 max-[640px]:grid-cols-1">
              <label className="text-[.76rem]">
                City
                <input className="min-h-12.5 text-[.87rem]" value={city} onChange={(event) => setCity(event.target.value)} required />
              </label>
              <label className="text-[.76rem]">
                Province
                <input
                  value={region}
                  onChange={(event) => setRegion(event.target.value.toUpperCase())}
                  maxLength={2}
                  required
                  className="min-h-12.5 text-[.87rem]"
                />
              </label>
              <label className="text-[.76rem]">
                Postal code
                <input
                  value={postalCode}
                  onChange={(event) => setPostalCode(event.target.value.toUpperCase())}
                  placeholder="M4B 1B3"
                  required
                  className="min-h-12.5 text-[.87rem]"
                />
              </label>
            </div>
          </div>

          <fieldset className="feature-picker col-auto m-0 border-0 p-0">
            <legend className="mb-2 text-[1.35rem] font-[750] text-(--text)">Choose your features</legend>
            <p className="mb-3.5 text-[.8rem] font-medium text-(--text-3)">Today and Settings are always included.</p>
            <FeatureChecklist
              enabledFeatures={enabledFeatures}
              onToggle={toggleFeature}
            />
          </fieldset>

          <div className="setup-actions col-[2] grid self-start gap-3 max-[980px]:col-[1]">
            {error && <p className={"form-error mt-1.25 text-[#ff8080] text-[.75rem]"}>{error}</p>}
            <Button className="w-full" type="submit" size="lg" disabled={Boolean(busy)}>
              <Plus size={18} /> Create household
            </Button>
            <button className="gate-switch m-0 justify-self-start border-0 bg-transparent p-2.5 text-[.78rem] font-bold text-[#7d9cff]" type="button" onClick={() => signOut()}>
              Sign out and use another account
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
