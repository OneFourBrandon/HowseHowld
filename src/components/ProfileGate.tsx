import {
  type PropsWithChildren,
  type SubmitEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Camera, ImagePlus, UserRound } from 'lucide-react'
import {
  getCurrentProfile,
  updateCurrentProfile,
  type CurrentProfile,
} from '../lib/api'
import { hasSupabaseConfig } from '../lib/supabase'
import { initials } from '../lib/utils'
import { Avatar, Button } from './ui'

export function ProfileGate({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<CurrentProfile | null>(null)
  const [loading, setLoading] = useState(hasSupabaseConfig)
  const [username, setUsername] = useState('')
  const [avatar, setAvatar] = useState<File>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const localPreview = useMemo(
    () => avatar ? URL.createObjectURL(avatar) : undefined,
    [avatar],
  )

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let active = true
    void getCurrentProfile()
      .then((nextProfile) => {
        if (!active) return
        setProfile(nextProfile)
        setUsername(nextProfile.displayName)
      })
      .catch((cause) => {
        if (!active) return
        setError(cause instanceof Error ? cause.message : 'Could not open your profile.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (!hasSupabaseConfig) return children
  if (loading) {
    return <div className="min-h-screen grid place-items-center bg-(--paper) text-(--forest) font-display">Opening your profile…</div>
  }
  if (profile?.onboardingCompletedAt) return children

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await updateCurrentProfile({
        displayName: username,
        avatar,
        completeOnboarding: true,
      })
      setProfile((current) => current ? {
        ...current,
        displayName: username.trim(),
        avatarUrl: localPreview ?? current.avatarUrl,
        onboardingCompletedAt: new Date().toISOString(),
      } : current)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your profile.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen grid grid-cols-[minmax(320px,.8fr)_minmax(520px,1.2fr)] bg-(--paper) max-[900px]:grid-cols-1">
      <section className="flex flex-col justify-between gap-12 p-[clamp(32px,6vw,88px)] bg-(--forest) text-white max-[900px]:hidden">
        <div className="flex items-center gap-3 font-display text-[1.18rem] font-bold">
          <span className="size-9.5 grid place-items-center rounded-xl bg-[#f1d799] text-(--forest) text-[1.3rem]">H</span>
          HowseHowld
        </div>
        <div>
          <p className="text-(--gold) text-[.75rem] font-extrabold tracking-[.11em]">MAKE IT YOURS</p>
          <h1 className="mt-3 text-[clamp(3rem,6vw,5.8rem)] leading-[.92]">Who’s joining the house?</h1>
          <p className="max-w-130 mt-6 text-[#cadac4] leading-[1.65]">
            Your username and picture help roommates recognize assignments,
            payments, events, and driveway alerts at a glance.
          </p>
        </div>
        <p className="flex items-center gap-2 text-[#cadac4] text-[.8rem]"><UserRound size={18} /> You can edit this later in Settings</p>
      </section>

      <section className="grid content-center p-[clamp(28px,8vw,96px)]">
        <form className="w-[min(620px,100%)] mx-auto" onSubmit={submit}>
          <p className="text-(--gold) text-[.75rem] font-extrabold tracking-[.11em]">YOUR PROFILE</p>
          <h2 className="mt-3 text-[clamp(2.5rem,5vw,4.4rem)] leading-[.98]">Choose how housemates see you.</h2>
          <p className="max-w-135 mt-4 text-(--muted) leading-[1.6]">
            A username is required. A profile picture is optional and can be skipped.
          </p>

          <div className="grid grid-cols-[auto_1fr] items-center gap-5 mt-9 pb-8 border-b border-(--line) max-[520px]:grid-cols-1">
            <Avatar
              initials={initials(username || profile?.displayName || 'Roommate')}
              color={profile?.avatarColor ?? '#568742'}
              imageUrl={localPreview ?? profile?.avatarUrl}
              size="xl"
            />
            <div className="grid gap-2">
              <strong className="text-[.9rem]">Profile picture <span className="text-(--muted) font-medium">Optional</span></strong>
              <p className="text-(--muted) text-[.75rem] leading-[1.45]">JPG, PNG, or WebP up to 5 MB.</p>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setAvatar(event.target.files?.[0])}
              />
              <Button type="button" size="sm" variant="secondary" onClick={() => fileInput.current?.click()}>
                {avatar ? <Camera size={16} /> : <ImagePlus size={16} />}
                {avatar ? 'Choose a different picture' : 'Choose a picture'}
              </Button>
            </div>
          </div>

          <label className="block mt-7 text-[.78rem] font-bold">
            Username
            <input
              className="min-h-13 mt-2 text-[.95rem]"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={2}
              maxLength={80}
              autoComplete="nickname"
              placeholder="How should your roommates know you?"
              autoFocus
              required
            />
          </label>
          {error && <p className="mt-3 text-(--coral) text-[.78rem]">{error}</p>}
          <Button className="w-full mt-6" size="lg" type="submit" disabled={busy}>
            {busy ? 'Saving profile…' : avatar ? 'Save profile' : 'Continue without a picture'}
          </Button>
        </form>
      </section>
    </main>
  )
}
