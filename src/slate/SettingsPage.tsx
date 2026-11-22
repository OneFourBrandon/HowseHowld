import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import {
  BellRing,
  Camera,
  Check,
  CircleAlert,
  Copy,
  Download,
  History,
  ImagePlus,
  KeyRound,
  LogOut,
  Moon,
  RefreshCw,
  Send,
  Sun,
  Trash2,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { EmailRecovery } from '../components/EmailRecovery'
import { FeatureChecklist } from '../components/FeatureChecklist'
import { GracePeriodSettings } from '../components/GracePeriodSettings'
import { PenaltySettings } from '../components/PenaltySettings'
import { Avatar } from '../components/ui'
import { signOut } from '../lib/api'
import { cn } from '../lib/cn'
import { setTheme, useAppearance } from '../lib/appearance'
import { hasSupabaseConfig } from '../lib/supabase'
import { switchDesign } from '../lib/switchDesign'
import { formatDateTime } from '../lib/utils'
import { useAppData } from '../state/AppDataContext'
import { AskDialog } from './AskDialog'
import { Chip, Empty, Face, Panel, Segmented, Switch, Tile } from './ui'
import { useHouse } from './useHouse'

/** A setting on one line: what it is on the left, its control on the right. */
function SettingRow({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="sl-cell-main whitespace-normal">{title}</p>
        {hint && <p className="sl-meta mt-0.5 leading-normal">{hint}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function CodeBox({ code, note }: { code: string; note: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="sl-well mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2.5">
      <code className="sl-num text-[.9375rem] font-[620] tracking-[.06em] text-(--sl-ink)">{code}</code>
      <button
        type="button"
        className="sl-btn sl-btn-sm"
        onClick={() => {
          void navigator.clipboard.writeText(code)
          setCopied(true)
        }}
      >
        {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Copied' : 'Copy'}
      </button>
      <span className="sl-micro basis-full">{note}</span>
    </div>
  )
}

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
  const { me, isOwner } = useHouse()
  const { theme } = useAppearance()
  const features = data.household.enabledFeatures
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW()

  const [profileName, setProfileName] = useState(me.displayName)
  const [profileAvatar, setProfileAvatar] = useState<File>()
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [profileError, setProfileError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const preview = useMemo(() => (profileAvatar ? URL.createObjectURL(profileAvatar) : undefined), [profileAvatar])
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const defaults = data.household.defaultTaskReminderTimes
  const [morning, setMorning] = useState(() => defaults.includes('09:00'))
  const [evening, setEvening] = useState(() => defaults.includes('18:00'))
  const [lastCall, setLastCall] = useState(() => defaults.includes('22:00') || defaults.includes('23:30'))

  const [shareCode, setShareCode] = useState(() => sessionStorage.getItem('howsehowld:last-share-code') ?? '')
  const [myRecoveryCode, setMyRecoveryCode] = useState('')
  const [recoveryCodes, setRecoveryCodes] = useState<Record<string, string>>({})
  const [removing, setRemoving] = useState<string | null>(null)
  const [switchFailed, setSwitchFailed] = useState(false)
  const removingMember = data.members.find(member => member.id === removing)

  const installed = useMemo(
    () => window.matchMedia('(display-mode: standalone)').matches
      || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    [],
  )
  const health = data.notificationHealth
  const hasPicture = Boolean(me.avatarUrl || profileAvatar) && !removeAvatar

  // House details fill the gap beside the reminders when the chore rules are not shown.
  const detailsBesideReminders = features.includes('chores') && !isOwner
  const houseDetails = (
    <Panel className={cn('col-span-12', detailsBesideReminders ? 'lg:col-span-6' : 'lg:col-span-4')} title="House details">
      <dl className="divide-y divide-(--sl-line)">
        {[
          ['Address', `${data.household.address.line1}, ${data.household.address.city}, ${data.household.address.region}`],
          ['Time zone', data.household.timezone.replace(/_/g, ' ')],
          ['Currency', data.household.currency],
          ['Features in use', `${features.length} of 6`],
        ].map(([label, value]) => (
          <div className="flex justify-between gap-4 py-2.5" key={label}>
            <dt className="sl-meta">{label}</dt>
            <dd className="m-0 text-right font-[520]">{value}</dd>
          </div>
        ))}
      </dl>
      <button type="button" className="sl-link mt-3" onClick={() => void navigator.clipboard.writeText(data.household.id)}>
        <Copy size={13} /> Copy household ID
      </button>
    </Panel>
  )

  return (
    <>
      {removingMember && (
        <AskDialog
          title={`Remove ${removingMember.displayName} from the house?`}
          description="They lose access straight away. Their past chores, purchases and payments stay in the history."
          confirmLabel="Remove access"
          danger
          onConfirm={() => removeHouseholdMember(removingMember.id)}
          onClose={() => setRemoving(null)}
        />
      )}

      <div className="sl-toolbar">
        <p className="text-(--sl-ink-2)">
          Signed in as <span className="font-[560] text-(--sl-ink)">{me.displayName}</span>,{' '}
          {isOwner ? 'admin of' : 'a member of'} {data.household.name}.
        </p>
        {hasSupabaseConfig && (
          <button type="button" className="sl-btn sl-btn-secondary" onClick={() => void signOut()}>
            <LogOut size={15} /> Sign out
          </button>
        )}
      </div>

      <div className="sl-grid">
        <h2 className="sl-band col-span-12">This device</h2>

        <Panel className="col-span-12 lg:col-span-6" title="Appearance" note="These two choices are saved on this device only.">
          <div className="divide-y divide-(--sl-line)">
            <SettingRow
              title="New design"
              hint="The layout you are looking at now. Turn it off to go back to the classic design."
            >
              <Switch
                label="New design"
                checked
                onChange={on => {
                  setSwitchFailed(false)
                  void switchDesign(on ? 'slate' : 'classic').catch(() => setSwitchFailed(true))
                }}
              />
            </SettingRow>
            {switchFailed && (
              <p className="py-3 text-(--sl-brick)" role="alert">
                The classic design could not be loaded. Check your connection, then reload the page and try again.
              </p>
            )}
            <SettingRow title="Theme" hint="The new design was drawn dark first. Light is there for bright rooms.">
              <Segmented
                label="Theme"
                value={theme}
                onChange={setTheme}
                options={[
                  { value: 'dark', label: <><Moon size={14} /> Dark</> },
                  { value: 'light', label: <><Sun size={14} /> Light</> },
                ]}
              />
            </SettingRow>
          </div>
        </Panel>

        {features.includes('notifications') ? (
          <Panel
            className="col-span-12 lg:col-span-6"
            title="Reminders on this device"
            note="Push reminders are best effort and cannot get past Focus or silent mode."
            tools={<Chip tone={health.subscribed ? 'moss' : 'brass'} dot>{health.subscribed ? 'Ready' : 'Needs setup'}</Chip>}
          >
            <ul className="divide-y divide-(--sl-line)">
              <HealthRow label="Installed on the Home Screen" ready={installed} />
              <HealthRow label="Notification permission" ready={health.permission === 'granted'} value={health.permission === 'granted' ? 'Allowed' : health.permission === 'denied' ? 'Blocked' : health.permission === 'unsupported' ? 'Not supported' : 'Not asked yet'} />
              <HealthRow label="Push subscription" ready={health.subscribed} value={health.subscribed ? 'Active' : 'None'} />
              <HealthRow label="Last delivery" ready={Boolean(health.lastSuccessAt)} value={health.lastSuccessAt ? formatDateTime(health.lastSuccessAt) : 'Not tested'} />
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="button" className="sl-btn sl-btn-primary" disabled={busy === 'notifications:enable'} onClick={() => void enableNotifications().catch(() => {})}>
                <BellRing size={15} /> Enable reminders
              </button>
              <button type="button" className="sl-btn sl-btn-secondary" disabled={busy === 'notifications:test'} onClick={() => void sendTestNotification().catch(() => {})}>
                <Send size={15} /> Send a test
              </button>
              {health.subscribed && (
                <button type="button" className="sl-btn" disabled={busy === 'notifications:disable'} onClick={() => void disableNotifications().catch(() => {})}>
                  Turn off on this device
                </button>
              )}
            </div>
            {needRefresh && (
              <button type="button" className="sl-btn sl-btn-secondary sl-tone-steel mt-3 w-full text-(--sl-steel)!" onClick={() => void updateServiceWorker(true)}>
                <Download size={15} /> A new version is ready. Update now
              </button>
            )}
          </Panel>
        ) : (
          <Panel className="col-span-12 lg:col-span-6" title="Reminders on this device">
            <Empty title="Notifications are switched off for this house">
              {isOwner ? 'Turn them on under Features below.' : 'The house admin can turn them on.'}
            </Empty>
          </Panel>
        )}

        <h2 className="sl-band col-span-12">You</h2>

        <Panel className="col-span-12 lg:col-span-6" title="Profile" note="Your name and picture appear on chores, payments and the driveway.">
          <form
            className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-5 gap-y-3 max-sm:grid-cols-1"
            onSubmit={async event => {
              event.preventDefault()
              setProfileError('')
              try {
                await updateProfile(profileName, removeAvatar ? null : profileAvatar)
                setProfileAvatar(undefined)
                setRemoveAvatar(false)
              } catch (cause) {
                setProfileError(cause instanceof Error ? cause.message : 'Could not update your profile.')
              }
            }}
          >
            <Avatar
              className="size-20! text-[1.25rem]!"
              initials={me.initials}
              color={me.color}
              imageUrl={removeAvatar ? undefined : preview ?? me.avatarUrl}
              size="xl"
            />
            <div className="grid min-w-0 gap-3">
              <label>
                Username
                <input value={profileName} onChange={event => setProfileName(event.target.value)} minLength={2} maxLength={80} autoComplete="nickname" required />
              </label>
              <input
                ref={fileInput}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={event => {
                  setProfileAvatar(event.target.files?.[0])
                  setRemoveAvatar(false)
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm" onClick={() => fileInput.current?.click()}>
                  {profileAvatar ? <Camera size={14} /> : <ImagePlus size={14} />}
                  {me.avatarUrl || profileAvatar ? 'Change picture' : 'Add picture'}
                </button>
                {hasPicture && (
                  <button type="button" className="sl-btn sl-btn-sm" onClick={() => { setProfileAvatar(undefined); setRemoveAvatar(true) }}>
                    <Trash2 size={14} /> Remove picture
                  </button>
                )}
                <span className="sl-micro">JPG, PNG or WebP up to 5 MB</span>
              </div>
              {profileError && <p className="text-(--sl-brick)" role="alert">{profileError}</p>}
              <button type="submit" className="sl-btn sl-btn-primary justify-self-start" disabled={busy === 'profile:update'}>
                {busy === 'profile:update' ? 'Saving…' : 'Save profile'}
              </button>
            </div>
          </form>
        </Panel>

        <Panel className="sl-embed col-span-12 lg:col-span-6" title="Sign in on another device" note="A device-based account cannot be recovered unless you add an email or save a code.">
          {!isOwner && (
            <>
              <SettingRow title="One-time recovery code" hint="Enter it in the house code box on your other device. Asking for a new one cancels the last.">
                <button
                  type="button"
                  className="sl-btn sl-btn-secondary sl-btn-sm"
                  disabled={busy === `member:recovery:${me.id}`}
                  onClick={async () => {
                    try {
                      setMyRecoveryCode(await issueMemberRecoveryCode(me.id))
                    } catch {
                      // The shared handler reports the failure.
                    }
                  }}
                >
                  <KeyRound size={14} /> {busy === `member:recovery:${me.id}` ? 'Generating…' : 'Get a code'}
                </button>
              </SettingRow>
              {myRecoveryCode && <CodeBox code={myRecoveryCode} note="Works once and expires in 30 days." />}
              <hr className="sl-divider my-3" />
            </>
          )}
          {hasSupabaseConfig
            ? <EmailRecovery />
            : <p className="sl-meta">Email sign-in is set up once the house is connected to live data.</p>}
        </Panel>

        <h2 className="sl-band col-span-12">The house</h2>

        <Panel
          className="col-span-12 lg:col-span-7"
          flush
          title={data.household.name}
          note={`${data.members.length} ${data.members.length === 1 ? 'person' : 'people'} in the house`}
        >
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {data.members.map(member => {
              const code = recoveryCodes[member.id]
              const manageable = isOwner && member.role !== 'owner'
              return (
                <div key={member.id} className="px-(--sl-pad) py-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Face member={member} size={32} />
                    <div className="min-w-0 flex-1">
                      <span className="sl-cell-main">{member.displayName}{member.id === me.id && <span className="font-[450] text-(--sl-muted)"> (you)</span>}</span>
                      <span className="sl-cell-sub">{member.email || 'Signed in with the house code'}</span>
                    </div>
                    <Chip tone={member.role === 'owner' ? 'brass' : undefined}>{member.role === 'owner' ? 'Admin' : 'Member'}</Chip>
                    {manageable && (
                      <div className="flex gap-1.5 max-sm:basis-full">
                        <button
                          type="button"
                          className="sl-btn sl-btn-secondary sl-btn-sm"
                          disabled={busy === `member:recovery:${member.id}`}
                          onClick={async () => {
                            try {
                              const next = await issueMemberRecoveryCode(member.id)
                              setRecoveryCodes(current => ({ ...current, [member.id]: next }))
                            } catch {
                              // The shared handler reports the failure.
                            }
                          }}
                        >
                          <KeyRound size={14} /> {busy === `member:recovery:${member.id}` ? 'Generating…' : 'Recovery code'}
                        </button>
                        <button type="button" className="sl-btn sl-btn-danger sl-btn-sm" disabled={busy === `member:remove:${member.id}`} onClick={() => setRemoving(member.id)}>
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                  {code && <CodeBox code={code} note={`Give this to ${member.displayName}. It works once and expires in 30 days.`} />}
                </div>
              )
            })}
          </div>
          {isOwner && (
            <div className="border-t border-(--sl-line) px-(--sl-pad) py-4">
              <SettingRow
                title="House share code"
                hint={shareCode
                  ? 'New roommates join with this code. Making a new one stops the old one working.'
                  : <>The current code ends in <strong className="sl-strong sl-num">{data.household.shareCodeLast4 ?? '••••'}</strong>. Make a new one to see it in full.</>}
              >
                <button type="button" className="sl-btn sl-btn-secondary sl-btn-sm" disabled={busy === 'share-code:rotate'} onClick={async () => setShareCode(await rotateShareCode())}>
                  <RefreshCw size={14} /> New code
                </button>
              </SettingRow>
              {shareCode && <CodeBox code={shareCode} note="Share it with the people moving in." />}
            </div>
          )}
        </Panel>

        <Panel className="sl-embed col-span-12 lg:col-span-5" title="Features" note={isOwner ? 'Choose the tools this house uses. Overview and Settings are always on.' : 'Only the house admin can change these.'}>
          <FeatureChecklist
            enabledFeatures={features}
            disabled={!isOwner || busy === 'household:features'}
            onToggle={feature => {
              const next = features.includes(feature) ? features.filter(item => item !== feature) : [...features, feature]
              void updateHouseholdFeatures(next).catch(() => {})
            }}
          />
        </Panel>

        {features.includes('chores') && (
          <Panel className={cn('col-span-12', isOwner ? 'lg:col-span-4' : 'lg:col-span-6')} title="Chore reminders" note="House defaults. A single chore can set its own.">
            <div className="divide-y divide-(--sl-line)">
              <SettingRow title="Morning" hint="9:00 AM">
                <Switch label="Morning reminder" checked={morning} onChange={setMorning} disabled={!isOwner} />
              </SettingRow>
              <SettingRow title="Evening check-in" hint="6:00 PM">
                <Switch label="Evening reminder" checked={evening} onChange={setEvening} disabled={!isOwner} />
              </SettingRow>
              <SettingRow title="Last calls" hint="10:00 PM and 11:30 PM">
                <Switch label="Last call reminders" checked={lastCall} onChange={setLastCall} disabled={!isOwner} />
              </SettingRow>
            </div>
            {isOwner && (
              <button
                type="button"
                className="sl-btn sl-btn-primary sl-btn-sm mt-3"
                disabled={busy === 'household:task-reminders'}
                onClick={() => void updateHouseholdTaskReminders([
                  ...(morning ? ['09:00'] : []),
                  ...(evening ? ['18:00'] : []),
                  ...(lastCall ? ['22:00', '23:30'] : []),
                ]).catch(() => {})}
              >
                Save reminder defaults
              </button>
            )}
          </Panel>
        )}

        {features.includes('chores') && isOwner && (
          <>
            <Panel className="sl-embed col-span-12 lg:col-span-4"><GracePeriodSettings /></Panel>
            <Panel className="sl-embed col-span-12 lg:col-span-4"><PenaltySettings /></Panel>
          </>
        )}

        {detailsBesideReminders && houseDetails}

        <h2 className="sl-band col-span-12">History</h2>

        <Panel className={cn('col-span-12', !detailsBesideReminders && 'lg:col-span-8')} flush title="Recent changes" note="What was changed in the house, and by whom.">
          <div className="sl-rows mt-3 border-t border-(--sl-line)">
            {data.auditEvents.map(event => {
              const actor = data.members.find(member => member.id === event.actorMemberId)
              return (
                <div className="sl-row grid-cols-[auto_minmax(0,1fr)_auto]" key={event.id}>
                  <Tile><History size={15} /></Tile>
                  <div className="min-w-0">
                    <span className="sl-cell-main font-[500]">{event.summary}</span>
                    <span className="sl-cell-sub">{formatDateTime(event.createdAt)}</span>
                  </div>
                  {actor && <Face member={actor} size={26} />}
                </div>
              )
            })}
          </div>
          {!data.auditEvents.length && <Empty title="Nothing has been changed yet" />}
        </Panel>

        {!detailsBesideReminders && houseDetails}
      </div>
    </>
  )
}

function HealthRow({ label, ready, value }: { label: string; ready: boolean; value?: string }) {
  return (
    <li className="flex items-center gap-2.5 py-2.5">
      {ready
        ? <Check size={15} className="shrink-0 text-(--sl-moss)" aria-hidden="true" />
        : <CircleAlert size={15} className="shrink-0 text-(--sl-brass)" aria-hidden="true" />}
      <span className="min-w-0 flex-1">{label}</span>
      <span className="sl-meta">{value ?? (ready ? 'Yes' : 'Not yet')}</span>
    </li>
  )
}
