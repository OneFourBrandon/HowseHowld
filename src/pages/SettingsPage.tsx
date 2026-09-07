import { cn } from '../lib/cn'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BellRing,
  Camera,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  History,
  ImagePlus,
  KeyRound,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundX,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { addRecoveryEmail, signOut } from '../lib/api'
import { hasSupabaseConfig } from '../lib/supabase'
import { useAppData } from '../state/AppDataContext'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Inner,
  PageHeader,
  SectionHeader,
  Tile,
  Toggle,
} from '../components/ui'
import { FeatureChecklist } from '../components/FeatureChecklist'
import { formatDateTime } from '../lib/utils'

export function SettingsPage() {
  const {
    data,
    busy,
    enableNotifications,
    disableNotifications,
    sendTestNotification,
    rotateShareCode,
    issueMemberRecoveryCode,
    removeHouseholdMember,
    updateProfile,
    updateHouseholdFeatures,
    updateHouseholdTaskReminders,
  } = useAppData()
  const [shareCode, setShareCode] = useState(
    () => sessionStorage.getItem('howsehowld:last-share-code') ?? '',
  )
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState('')
  const [memberRecoveryCodes, setMemberRecoveryCodes] = useState<Record<string, string>>({})
  const [morning, setMorning] = useState(
    () => data.household.defaultTaskReminderTimes.includes('09:00'),
  )
  const [evening, setEvening] = useState(
    () => data.household.defaultTaskReminderTimes.includes('18:00'),
  )
  const [lastCall, setLastCall] = useState(
    () => data.household.defaultTaskReminderTimes.includes('22:00')
      || data.household.defaultTaskReminderTimes.includes('23:30'),
  )
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()
  const currentMember = data.members.find(
    (member) => member.id === data.household.currentMemberId,
  )!
  const [profileName, setProfileName] = useState(currentMember.displayName)
  const [profileAvatar, setProfileAvatar] = useState<File>()
  const [removeProfileAvatar, setRemoveProfileAvatar] = useState(false)
  const [profileError, setProfileError] = useState('')
  const profileFileInput = useRef<HTMLInputElement>(null)
  const profilePreview = useMemo(
    () => profileAvatar ? URL.createObjectURL(profileAvatar) : undefined,
    [profileAvatar],
  )

  useEffect(() => {
    return () => {
      if (profilePreview) URL.revokeObjectURL(profilePreview)
    }
  }, [profilePreview])

  const installed = useMemo(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    [],
  )

  return (
    <>
      <PageHeader
        title="Settings"
        description="Manage people, reminders and the health of this installation."
        actions={
          hasSupabaseConfig ? (
            <Button variant="secondary" onClick={() => signOut()}>
              <LogOut size={16} /> Sign out
            </Button>
          ) : undefined
        }
      />

      <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(340px,.7fr)] items-start gap-5 max-[1100px]:grid-cols-1">
        <div className="grid content-start gap-5">
          <Card className="p-5">
            <SectionHeader title="Profile" />
            <form
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-5 max-[640px]:grid-cols-1"
              onSubmit={async (event) => {
                event.preventDefault()
                setProfileError('')
                try {
                  await updateProfile(
                    profileName,
                    removeProfileAvatar ? null : profileAvatar,
                  )
                  setProfileAvatar(undefined)
                  setRemoveProfileAvatar(false)
                } catch (cause) {
                  setProfileError(cause instanceof Error ? cause.message : 'Could not update your profile.')
                }
              }}
            >
              <Avatar
                initials={currentMember.initials}
                color={currentMember.color}
                imageUrl={removeProfileAvatar ? undefined : profilePreview ?? currentMember.avatarUrl}
                size="xl"
              />
              <div className="grid gap-2">
                <label className="text-[.78rem] font-bold">
                  Username
                  <input
                    className="min-h-12.5 mt-2 text-[.9rem]"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    minLength={2}
                    maxLength={80}
                    autoComplete="nickname"
                    required
                  />
                </label>
                <input
                  ref={profileFileInput}
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    setProfileAvatar(event.target.files?.[0])
                    setRemoveProfileAvatar(false)
                  }}
                />
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => profileFileInput.current?.click()}>
                    {profileAvatar ? <Camera size={15} /> : <ImagePlus size={15} />}
                    {currentMember.avatarUrl || profileAvatar ? 'Change picture' : 'Add picture'}
                  </Button>
                  {(currentMember.avatarUrl || profileAvatar) && !removeProfileAvatar && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setProfileAvatar(undefined)
                        setRemoveProfileAvatar(true)
                      }}
                    >
                      <Trash2 size={15} /> Remove picture
                    </Button>
                  )}
                </div>
                <p className="text-(--text-3) text-[.74rem]">JPG, PNG, or WebP up to 5 MB.</p>
              </div>
              {profileError && <p className="col-span-full text-[#ff8080] text-[.76rem]">{profileError}</p>}
              <Button className="col-2 justify-self-start max-640px:col-1" type="submit" disabled={busy === 'profile:update'}>
                {busy === 'profile:update' ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          </Card>

          <Card className="p-5">
            <SectionHeader title="Features" />
            <div>
              <p className="mb-3.5 max-w-155 text-[.84rem] leading-[1.55] text-(--text-3)">
                Choose which tools this household uses. Overview and Settings are
                always available.
              </p>
              <FeatureChecklist
                enabledFeatures={data.household.enabledFeatures}
                disabled={
                  currentMember.role !== 'owner' ||
                  busy === 'household:features'
                }
                onToggle={(feature) => {
                  const nextFeatures = data.household.enabledFeatures.includes(feature)
                    ? data.household.enabledFeatures.filter((item) => item !== feature)
                    : [...data.household.enabledFeatures, feature]
                  void updateHouseholdFeatures(nextFeatures).catch(() => {})
                }}
              />
              {currentMember.role !== 'owner' && (
                <p className="settings-note mt-3.5 flex items-center gap-1.5 text-[.75rem] text-(--text-3)">
                  Only the house owner can change available features.
                </p>
              )}
            </div>
          </Card>

          {!currentMember.email && hasSupabaseConfig && (
            <Card className="p-5">
              <SectionHeader title="Protect this account" />
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,.75fr)] items-end gap-6 max-[640px]:grid-cols-1">
                <div>
                  <strong className="text-[.9rem]">Add a recovery email before changing devices.</strong>
                  <p className="mt-1.25 text-[.75rem] leading-[1.5] text-(--text-3)">
                    Your house-code account currently lives only on this device.
                    Supabase will send a verification message to link your identity.
                  </p>
                </div>
                <form className="grid grid-cols-[1fr_auto] items-end gap-2.25 max-[640px]:grid-cols-1"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    setRecoveryStatus('')
                    try {
                      await addRecoveryEmail(recoveryEmail)
                      setRecoveryStatus('Check your inbox to finish linking this account.')
                      setRecoveryEmail('')
                    } catch (cause) {
                      setRecoveryStatus(
                        cause instanceof Error ? cause.message : 'Could not add that email.',
                      )
                    }
                  }}
                >
                  <label>
                    Recovery email
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(event) => setRecoveryEmail(event.target.value)}
                      placeholder="you@example.com"
                      required
                    />
                  </label>
                  <Button type="submit" size="sm">Send verification</Button>
                </form>
                {recoveryStatus && <p className="col-span-full mt-2 flex items-center gap-1.5 text-[.78rem] text-(--text-3)">{recoveryStatus}</p>}
              </div>
            </Card>
          )}

          {data.household.enabledFeatures.includes('notifications') && (
            <Card className="grid gap-4 p-5">
              <div className="flex items-center gap-3.5">
                <div
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-2xl bg-(--amber-soft) text-(--amber)',
                    data.notificationHealth.subscribed && 'bg-(--green)! text-(--bg)!',
                  )}
                >
                  {data.notificationHealth.subscribed ? <CheckCircle2 /> : <BellRing />}
                </div>
                <div>
                  <strong className="block text-[.94rem]">{data.notificationHealth.subscribed ? 'Ready for reminders' : 'Reminders need setup'}</strong>
                  <span className="mt-0.75 block text-[.75rem] text-(--text-3)">Web Push is best-effort and cannot bypass Focus or silent mode.</span>
                </div>
              </div>
              <div className="grid">
                <HealthRow label="Installed on Home Screen" ready={installed} />
                <HealthRow
                  label="Notification permission"
                  ready={data.notificationHealth.permission === 'granted'}
                  value={data.notificationHealth.permission}
                />
                <HealthRow label="Active push subscription" ready={data.notificationHealth.subscribed} />
                <HealthRow
                  label="Last successful delivery"
                  ready={Boolean(data.notificationHealth.lastSuccessAt)}
                  value={
                    data.notificationHealth.lastSuccessAt
                      ? formatDateTime(data.notificationHealth.lastSuccessAt)
                      : 'Not tested'
                  }
                />
              </div>
              <div className={"button-row flex items-center gap-2.25 flex-wrap"}>
                <Button
                  disabled={busy === 'notifications:enable'}
                  onClick={enableNotifications}
                >
                  <BellRing size={17} /> Enable reminders
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy === 'notifications:test'}
                  onClick={sendTestNotification}
                >
                  <Send size={17} /> Send a test
                </Button>
                {data.notificationHealth.subscribed && (
                  <Button
                    variant="ghost"
                    disabled={busy === 'notifications:disable'}
                    onClick={disableNotifications}
                  >
                    Disable on this device
                  </Button>
                )}
              </div>
              {needRefresh && (
                <button type="button" className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-0 bg-(--violet-soft) p-2.5 text-[.8rem] font-bold text-(--violet)" onClick={() => updateServiceWorker(true)}>
                  <Download size={17} /> A new version is ready. Tap to update.
                </button>
              )}
            </Card>
          )}

          {data.household.enabledFeatures.includes('chores') && (
            <Card className="grid gap-1 p-5">
              <SectionHeader title="Chore reminders" />
              <Toggle checked={morning} onChange={setMorning} label="Morning assignment · 9:00 AM" />
              <Toggle checked={evening} onChange={setEvening} label="Evening check-in · 6:00 PM" />
              <Toggle checked={lastCall} onChange={setLastCall} label="Last calls · 10:00 & 11:30 PM" />
              <p className="mt-3 flex items-center gap-1.5 border-t border-(--line) pt-3 text-[.78rem] text-(--text-3)"><Clock3 size={14} /> Individual chores can replace these household defaults.</p>
              {currentMember.role === 'owner' && (
                <Button
                  className="mt-3 justify-self-start"
                  size="sm"
                  disabled={busy === 'household:task-reminders'}
                  onClick={() => updateHouseholdTaskReminders([
                    ...(morning ? ['09:00'] : []),
                    ...(evening ? ['18:00'] : []),
                    ...(lastCall ? ['22:00', '23:30'] : []),
                  ])}
                >
                  Save reminder defaults
                </Button>
              )}
            </Card>
          )}

          <Card className="p-5">
            <SectionHeader title="Recent audit history" />
            <div>
              {data.auditEvents.map((event) => {
                const actor = data.members.find((member) => member.id === event.actorMemberId)
                return (
                  <div className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-(--line) first:border-t-0" key={event.id}>
                    <Tile icon={History} size={34} radius={10} />
                    <div className="grid min-w-0 gap-0.5"><strong className="truncate text-[.86rem]">{event.summary}</strong><span className="truncate text-[.75rem] text-(--text-3)">{event.action} · {formatDateTime(event.createdAt)}</span></div>
                    {actor && <Avatar initials={actor.initials} color={actor.color} imageUrl={actor.avatarUrl} size="sm" />}
                  </div>
                )
              })}
            </div>
          </Card>
        </div>

        <aside className="grid content-start gap-5">
          <Card className="p-5">
            <SectionHeader title={data.household.name} description={`${data.members.length} members`} />
            <div>
            {data.members.map((member) => (
                <div className="grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-3 border-t border-(--line) first:border-t-0" key={member.id}>
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} />
                <div>
                  <strong className="block text-[.82rem]">{member.displayName}</strong>
                  <span className="mt-0.75 block text-[.75rem] text-(--text-3)">{member.email || 'House-code account'}</span>
                </div>
                <Badge tone={member.role === 'owner' ? 'amber' : 'neutral'}>{member.role}</Badge>
              </div>
            ))}
            </div>
          </Card>

          {currentMember.role === 'owner' && data.members.some((member) => member.role !== 'owner') && (
            <Card className="p-5">
              <SectionHeader title="Roommate access" description="Owner controls" />
              <div className="grid gap-2.5">
                {data.members
                  .filter((member) => member.role !== 'owner')
                  .map((member) => {
                    const recoveryCode = memberRecoveryCodes[member.id]
                    return (
                      <Inner className="grid gap-3 p-4" key={member.id}>
                        <div className="flex items-center justify-between gap-3 text-(--text-3)">
                          <div className="flex items-center gap-2.5">
                            <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} size="sm" />
                            <div className="grid gap-0.5">
                              <strong className="text-[.85rem] text-(--text)">{member.displayName}</strong>
                              <span className="text-[.73rem]">{member.email || 'Device-based account'}</span>
                            </div>
                          </div>
                          <UserRoundX size={16} />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={busy === `member:recovery:${member.id}`}
                            onClick={async () => {
                              try {
                                const code = await issueMemberRecoveryCode(member.id)
                                setMemberRecoveryCodes((current) => ({
                                  ...current,
                                  [member.id]: code,
                                }))
                              } catch {
                                // The shared context displays the server error.
                              }
                            }}
                          >
                            <KeyRound size={15} />
                            {busy === `member:recovery:${member.id}` ? 'Generating…' : 'Give recovery code'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy === `member:remove:${member.id}`}
                            onClick={async () => {
                              if (!window.confirm(`Remove ${member.displayName} from this household?`)) return
                              try {
                                await removeHouseholdMember(member.id)
                              } catch {
                                // The shared context displays the server error.
                              }
                            }}
                          >
                            Remove access
                          </Button>
                        </div>
                        {recoveryCode && (
                          <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-xl border border-[rgba(59,107,255,.3)] bg-(--blue-soft) px-3 py-2.5">
                            <code className="font-mono text-[.78rem] font-extrabold tracking-[.08em] text-[#9db4ff]">{recoveryCode}</code>
                            <button className="inline-flex items-center gap-1.25 border-0 bg-transparent py-0.75 text-[.72rem] font-[750] text-(--text)"
                              type="button"
                              onClick={() => navigator.clipboard.writeText(recoveryCode)}
                            >
                              <Copy size={14} /> Copy
                            </button>
                            <span className="col-span-full text-[.72rem] text-(--text-3)">Single use · expires in 30 days</span>
                          </div>
                        )}
                      </Inner>
                    )
                  })}
              </div>
            </Card>
          )}

          {currentMember.role === 'owner' && (
            <Card className="grid gap-2.5 p-5">
              <Tile icon={KeyRound} tone="violet" />
              <h3 className="mt-1 text-[1.15rem] font-extrabold tracking-[-.02em]">House share code</h3>
              <p className="text-[.78rem] leading-relaxed text-(--text-3)">
                Roommates can create a device-based account with this code.
                Rotating it immediately disables the old one.
              </p>
              {shareCode ? (
                <button
                  className="hh-inner mt-1 mb-1 grid w-full gap-1.5 p-4 text-left text-(--text)"
                  onClick={() => navigator.clipboard.writeText(shareCode)}
                >
                  <strong className="text-[1.15rem] tracking-[.08em] tabular-nums">{shareCode}</strong>
                  <span className="inline-flex items-center gap-1.25 text-[.75rem] text-(--text-3)"><Copy size={14} /> Copy code</span>
                </button>
              ) : (
                <p className="my-1 border-y border-(--line) py-3 text-[.82rem] text-(--text-3)">
                  Current code ends in <strong>{data.household.shareCodeLast4 ?? '••••'}</strong>.
                  Rotate it to reveal a new code.
                </p>
              )}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy === 'share-code:rotate'}
                onClick={async () => setShareCode(await rotateShareCode())}
              >
                <RefreshCw size={15} /> Rotate and reveal code
              </Button>
            </Card>
          )}

          <Card className="grid gap-3 p-5">
            <div className="flex items-center gap-2 text-[.9rem] font-bold"><ShieldCheck size={18} /><span>Household security</span></div>
            <dl className="m-0 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-[.78rem]">
              <dt className="text-(--text-3)">Timezone</dt><dd className="m-0 max-w-45 text-right font-bold">{data.household.timezone}</dd>
              <dt className="text-(--text-3)">Currency</dt><dd className="m-0 max-w-45 text-right font-bold">{data.household.currency}</dd>
              <dt className="text-(--text-3)">Address</dt>
              <dd className="m-0 max-w-45 text-right font-bold">
                {data.household.address.line1}, {data.household.address.city},{' '}
                {data.household.address.region}
              </dd>
              <dt className="text-(--text-3)">Features</dt>
              <dd className="m-0 max-w-45 text-right font-bold">{data.household.enabledFeatures.length} enabled</dd>
            </dl>
            <button type="button" className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-[.78rem] text-(--text-3) hover:text-(--text)" onClick={() => navigator.clipboard.writeText(data.household.id)}>
              <Copy size={14} /> Copy household ID
            </button>
          </Card>
        </aside>
      </div>
    </>
  )
}

function HealthRow({
  label,
  ready,
  value,
}: {
  label: string
  ready: boolean
  value?: string
}) {
  return (
    <div className="grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2.5 border-t border-(--line) text-[.82rem] first:border-t-0">
      {ready ? <CheckCircle2 size={16} className="text-(--green)" /> : <CircleAlert size={16} className="text-(--amber)" />}
      <span>{label}</span>
      <strong className="text-[.78rem] font-semibold text-(--text-3)">{value ?? (ready ? 'Ready' : 'Needs attention')}</strong>
    </div>
  )
}
