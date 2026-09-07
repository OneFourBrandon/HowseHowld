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
import { Avatar, Badge, Button, Card, SectionHeader, Toggle } from '../components/ui'
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
  const [selfRecoveryCode, setSelfRecoveryCode] = useState('')
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
    <div className={"page-stack grid gap-14.5 max-[980px]:gap-13 max-[640px]:gap-11.5"}>
      <header className="page-header flex items-end justify-between gap-10 border-b border-b-(--line-strong) pb-7.5 max-[640px]:flex-col max-[640px]:items-start max-[640px]:gap-5.5 max-[640px]:pb-4.5">
        <div className="grid gap-3.75">
          <p className={"eyebrow text-(--gold) font-sans text-[.75rem] font-extrabold leading-[1.3] tracking-[.11em] max-[640px]:text-[.75rem]"}>HOUSE RULES & DEVICES</p>
          <h1 className="text-[clamp(3.15rem,4.5vw,4.8rem)] max-[640px]:text-[clamp(2.55rem,13vw,3.35rem)]">Settings</h1>
          <p>Manage people, reminders and the health of this installation.</p>
        </div>
        {hasSupabaseConfig && (
          <Button className="max-[640px]:w-full" variant="ghost" onClick={() => signOut()}>
            <LogOut size={18} /> Sign out
          </Button>
        )}
      </header>

      <div className={"settings-layout grid items-start grid-cols-[minmax(0,1.3fr)_minmax(300px,.7fr)] max-[980px]:grid-cols-1 gap-14.5 max-[980px]:gap-12.5"}>
        <div className={"settings-main grid max-[980px]:gap-6.25 gap-14.5"}>
          <section>
            <SectionHeader eyebrow="YOUR ACCOUNT" title="Profile" />
            <form
              className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-6 gap-y-5 py-4 border-b border-(--line) max-[640px]:grid-cols-1"
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
                <p className="text-(--muted) text-[.74rem]">JPG, PNG, or WebP up to 5 MB.</p>
              </div>
              {profileError && <p className="col-span-full text-(--coral) text-[.76rem]">{profileError}</p>}
              <Button className="col-2 justify-self-start max-640px:col-1" type="submit" disabled={busy === 'profile:update'}>
                {busy === 'profile:update' ? 'Saving…' : 'Save profile'}
              </Button>
            </form>
          </section>

          <section>
            <SectionHeader eyebrow="HOUSEHOLD" title="Features" />
            <div className="settings-feature-list">
              <p className="mb-3.5 max-w-155 text-[.84rem] leading-[1.55] text-(--muted)">
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
                <p className="settings-note mt-3.5 flex items-center gap-1.5 text-[.75rem] text-(--muted)">
                  Only the house owner can change available features.
                </p>
              )}
            </div>
          </section>

          {!currentMember.email && hasSupabaseConfig && (
            <section>
              <SectionHeader eyebrow="ACCOUNT RECOVERY" title="Protect this account" />
              <Card className="settings-card recovery-card grid gap-5 border-b border-b-(--line) px-1 py-6.5">
                <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,.75fr)] items-end gap-7 max-[640px]:grid-cols-1">
                  <div>
                    <strong className="text-[.9rem]">Use this account on another device</strong>
                    <p className="mt-1.25 text-[.75rem] leading-[1.5] text-(--muted)">
                      Generate a one-time code, then enter it in the house share or recovery code box on your other device.
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={busy === `member:recovery:${currentMember.id}`}
                    onClick={async () => {
                      try {
                        setSelfRecoveryCode(await issueMemberRecoveryCode(currentMember.id))
                      } catch {
                        // The shared context displays the server error.
                      }
                    }}
                  >
                    <KeyRound size={15} />
                    {busy === `member:recovery:${currentMember.id}` ? 'Generating…' : 'Request recovery code'}
                  </Button>
                </div>
                {selfRecoveryCode && (
                  <div className="grid grid-cols-[1fr_auto] items-center gap-x-2.5 gap-y-1 rounded-lg border border-(--line) bg-(--sage-2) px-3 py-2.5">
                    <code className="font-mono text-[.78rem] font-extrabold tracking-[.08em] text-(--forest)">{selfRecoveryCode}</code>
                    <button
                      className="inline-flex items-center gap-1.25 border-0 bg-transparent py-0.75 text-[.72rem] font-[750] text-(--forest)"
                      type="button"
                      onClick={() => navigator.clipboard.writeText(selfRecoveryCode)}
                    >
                      <Copy size={14} /> Copy
                    </button>
                    <span className="col-span-full text-[.7rem] text-(--muted)">
                      Single use · expires in 30 days · requesting another code revokes this one
                    </span>
                  </div>
                )}
                <div className="border-t border-(--line) pt-5">
                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(240px,.75fr)] items-end gap-7 max-[640px]:grid-cols-1">
                    <div>
                      <strong className="text-[.9rem]">Or add a recovery email</strong>
                      <p className="mt-1.25 text-[.75rem] leading-[1.5] text-(--muted)">
                        Supabase will send a verification message to link your identity permanently.
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
                  </div>
                  {recoveryStatus && <p className="settings-note mt-2.25 flex items-center gap-1.5 text-[.75rem] text-(--muted)">{recoveryStatus}</p>}
                </div>
              </Card>
            </section>
          )}

          {data.household.enabledFeatures.includes('notifications') && <section>
            <SectionHeader eyebrow="THIS DEVICE" title="Notification health" />
            <Card className={"notification-health-card p-[20px_4px] border-b border-b-(--line) py-6.5"}>
              <div className="health-score flex items-center gap-3.25 border-b border-b-(--line) pb-4.5">
                <div
                  className={cn(
                    'health-ring w-11.25 h-11.25 grid place-items-center text-[#9b6a23] bg-(--gold-soft) rounded-lg',
                    data.notificationHealth.subscribed && 'health-good bg-(--green)! text-white!',
                  )}
                >
                  {data.notificationHealth.subscribed ? <CheckCircle2 /> : <BellRing />}
                </div>
                <div>
                  <strong className="block text-[.94rem]">{data.notificationHealth.subscribed ? 'Ready for reminders' : 'Reminders need setup'}</strong>
                  <span className="mt-0.75 block text-[.75rem] text-(--muted)">Web Push is best-effort and cannot bypass Focus or silent mode.</span>
                </div>
              </div>
              <div className={"health-checks grid p-[11px_0]"}>
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
                <button className={"update-notice w-full mt-3 p-2.5 flex items-center justify-center gap-1.75 border-0 text-[#465987] bg-(--blue-soft) font-bold rounded-[7px] min-h-10.5 text-[.76rem]"} onClick={() => updateServiceWorker(true)}>
                  <Download size={17} /> A new version is ready. Tap to update.
                </button>
              )}
            </Card>
          </section>}

          {data.household.enabledFeatures.includes('chores') && <section>
            <SectionHeader eyebrow="DEFAULTS" title="Chore reminders" />
            <Card className={"settings-card p-[20px_4px] border-b border-b-(--line) py-6.5"}>
              <Toggle checked={morning} onChange={setMorning} label="Morning assignment · 9:00 AM" />
              <Toggle checked={evening} onChange={setEvening} label="Evening check-in · 6:00 PM" />
              <Toggle checked={lastCall} onChange={setLastCall} label="Last calls · 10:00 & 11:30 PM" />
              <p className={"settings-note flex items-center gap-1.5 mt-2.25 text-(--muted) text-[.75rem]"}><Clock3 size={15} /> Individual chores can replace these household defaults.</p>
              {currentMember.role === 'owner' && (
                <Button
                  className={"m-4"}
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
          </section>}

          <section>
            <SectionHeader eyebrow="TRANSPARENCY" title="Recent audit history" />
            <Card className={"audit-list p-0"}>
              {data.auditEvents.map((event) => {
                const actor = data.members.find((member) => member.id === event.actorMemberId)
                return (
                  <div className="audit-row grid min-h-21 grid-cols-[auto_1fr_auto] items-center gap-2.25 border-t border-(--line) px-1 first:border-t-0" key={event.id}>
                    <div className={"audit-icon w-7.75 h-7.75 grid place-items-center text-(--muted) bg-[#efeee8] rounded-[7px]"}><History size={16} /></div>
                    <div><strong>{event.summary}</strong><span>{event.action} · {formatDateTime(event.createdAt)}</span></div>
                    {actor && <Avatar initials={actor.initials} color={actor.color} imageUrl={actor.avatarUrl} size="sm" />}
                  </div>
                )
              })}
            </Card>
          </section>
        </div>

        <aside>
          <SectionHeader eyebrow="MEMBERS" title={data.household.name} />
          <Card className={"member-list-card p-0"}>
            {data.members.map((member) => (
                <div className="member-row grid min-h-21 grid-cols-[auto_1fr_auto] items-center gap-2.25 border-t border-(--line) px-1 first:border-t-0" key={member.id}>
                <Avatar initials={member.initials} color={member.color} imageUrl={member.avatarUrl} />
                <div>
                  <strong className="block text-[.82rem]">{member.displayName}</strong>
                  <span className="mt-0.75 block text-[.75rem] text-(--muted)">{member.email || 'House-code account'}</span>
                </div>
                <Badge tone={member.role === 'owner' ? 'amber' : 'neutral'}>{member.role}</Badge>
              </div>
            ))}
          </Card>

          {currentMember.role === 'owner' && data.members.some((member) => member.role !== 'owner') && (
            <section className={"member-admin-section mt-8.5"}>
              <SectionHeader eyebrow="OWNER CONTROLS" title="Roommate access" />
              <div className={"member-admin-list border-t border-t-(--line)"}>
                {data.members
                  .filter((member) => member.role !== 'owner')
                  .map((member) => {
                    const recoveryCode = memberRecoveryCodes[member.id]
                    return (
                      <div className={"member-admin-item grid gap-3 p-[18px_4px] border-b border-b-(--line)"} key={member.id}>
                        <div className="member-admin-heading flex items-center justify-between gap-3 text-(--muted)">
                          <div className="grid gap-0.75">
                            <strong className="text-[.82rem] text-(--ink)">{member.displayName}</strong>
                            <span className="text-[.72rem]">{member.email || 'Device-based account'}</span>
                          </div>
                          <UserRoundX size={17} />
                        </div>
                        <div className={"member-admin-actions flex flex-wrap gap-2"}>
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
                          <div className="member-recovery-code grid grid-cols-[1fr_auto] items-center gap-[4px_10px] rounded-lg border border-(--line) bg-(--sage-2) p-[10px_12px]">
                            <code className="font-mono text-[.78rem] font-extrabold tracking-[.08em] text-(--forest)">{recoveryCode}</code>
                            <button className="inline-flex items-center gap-1.25 border-0 bg-transparent py-0.75 text-[.72rem] font-[750] text-(--forest)"
                              type="button"
                              onClick={() => navigator.clipboard.writeText(recoveryCode)}
                            >
                              <Copy size={14} /> Copy
                            </button>
                            <span>Single use · expires in 30 days</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
              </div>
            </section>
          )}

          {currentMember.role === 'owner' && (
            <Card className="invite-card mt-8.5 border-t border-t-(--line) px-1 pt-6">
              <div className={"invite-icon w-10 h-10 grid place-items-center text-(--blue) bg-(--blue-soft) rounded-lg"}><KeyRound /></div>
              <h3 className="mt-3">House share code</h3>
              <p className="mt-1.25 text-[.75rem] leading-[1.45] text-(--muted)">
                Roommates can create a device-based account with this code.
                Rotating it immediately disables the old one.
              </p>
              {shareCode ? (
                <button
                  className="share-code-display my-[15px] mb-3 grid w-full gap-1.25 rounded-lg border border-(--forest-2) bg-(--sage-2) p-4 text-left text-(--forest)"
                  onClick={() => navigator.clipboard.writeText(shareCode)}
                >
                  <strong className="text-[1.15rem] tracking-[.08em] tabular-nums">{shareCode}</strong>
                  <span className="inline-flex items-center gap-1.25 text-[.75rem] text-(--muted)"><Copy size={14} /> Copy code</span>
                </button>
              ) : (
                <p className={"masked-share-code !m-[14px_0_12px] p-[12px_0] border-t border-t-(--line) border-b border-b-(--line)"}>
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

          <Card className="house-details mt-8.5 border-t border-t-(--line) px-1 pt-6">
            <div className="flex items-center gap-1.75 text-[.82rem] font-[750]"><ShieldCheck /><span>Household security</span></div>
            <dl className="my-3.5 grid grid-cols-[1fr_auto] gap-y-2 text-[.75rem]">
              <dt className="text-(--muted)">Timezone</dt><dd className="m-0 max-w-45 text-right font-bold">{data.household.timezone}</dd>
              <dt className="text-(--muted)">Currency</dt><dd className="m-0 max-w-45 text-right font-bold">{data.household.currency}</dd>
              <dt className="text-(--muted)">Address</dt>
              <dd className="m-0 max-w-45 text-right font-bold">
                {data.household.address.line1}, {data.household.address.city},{' '}
                {data.household.address.region}
              </dd>
              <dt className="text-(--muted)">Features</dt>
              <dd className="m-0 max-w-45 text-right font-bold">{data.household.enabledFeatures.length} enabled</dd>
            </dl>
            <button className="flex items-center gap-1.25 border-0 bg-transparent text-[.75rem] text-(--muted)" onClick={() => navigator.clipboard.writeText(data.household.id)}>
              <Copy size={14} /> Copy household ID
            </button>
          </Card>
        </aside>
      </div>
    </div>
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
    <div className="health-row grid min-h-11.25 grid-cols-[auto_1fr_auto] items-center gap-2 text-[.78rem]">
      {ready ? <CheckCircle2 className="health-ok w-4 text-(--green)" /> : <CircleAlert className="health-warn w-4 text-(--gold)" />}
      <span>{label}</span>
      <strong className="text-[.75rem] font-semibold text-(--muted)">{value ?? (ready ? 'Ready' : 'Needs attention')}</strong>
    </div>
  )
}
