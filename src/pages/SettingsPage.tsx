import { useMemo, useState } from 'react'
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  History,
  KeyRound,
  LogOut,
  RefreshCw,
  Send,
  ShieldCheck,
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
    updateHouseholdFeatures,
    updateHouseholdTaskReminders,
  } = useAppData()
  const [shareCode, setShareCode] = useState(
    () => sessionStorage.getItem('howsehowld:last-share-code') ?? '',
  )
  const [recoveryEmail, setRecoveryEmail] = useState('')
  const [recoveryStatus, setRecoveryStatus] = useState('')
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

  const installed = useMemo(
    () =>
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
    [],
  )

  return (
    <div className="page-stack">
      <header className="page-header">
        <div>
          <p className="eyebrow">HOUSE RULES & DEVICES</p>
          <h1>Settings</h1>
          <p>Manage people, reminders and the health of this installation.</p>
        </div>
        {hasSupabaseConfig && (
          <Button variant="ghost" onClick={() => signOut()}>
            <LogOut size={18} /> Sign out
          </Button>
        )}
      </header>

      <div className="settings-layout">
        <div className="settings-main">
          <section>
            <SectionHeader eyebrow="HOUSEHOLD" title="Features" />
            <div className="settings-feature-list">
              <p>
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
                <p className="settings-note">
                  Only the house owner can change available features.
                </p>
              )}
            </div>
          </section>

          {!currentMember.email && hasSupabaseConfig && (
            <section>
              <SectionHeader eyebrow="ACCOUNT RECOVERY" title="Protect this account" />
              <Card className="settings-card recovery-card">
                <div>
                  <strong>Add a recovery email before changing devices.</strong>
                  <p>
                    Your house-code account currently lives only on this device.
                    Supabase will send a verification message to link your identity.
                  </p>
                </div>
                <form
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
                {recoveryStatus && <p className="settings-note">{recoveryStatus}</p>}
              </Card>
            </section>
          )}

          {data.household.enabledFeatures.includes('notifications') && <section>
            <SectionHeader eyebrow="THIS DEVICE" title="Notification health" />
            <Card className="notification-health-card">
              <div className="health-score">
                <div className={data.notificationHealth.subscribed ? 'health-ring health-good' : 'health-ring'}>
                  {data.notificationHealth.subscribed ? <CheckCircle2 /> : <BellRing />}
                </div>
                <div>
                  <strong>{data.notificationHealth.subscribed ? 'Ready for reminders' : 'Reminders need setup'}</strong>
                  <span>Web Push is best-effort and cannot bypass Focus or silent mode.</span>
                </div>
              </div>
              <div className="health-checks">
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
              <div className="button-row">
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
                <button className="update-notice" onClick={() => updateServiceWorker(true)}>
                  <Download size={17} /> A new version is ready. Tap to update.
                </button>
              )}
            </Card>
          </section>}

          {data.household.enabledFeatures.includes('chores') && <section>
            <SectionHeader eyebrow="DEFAULTS" title="Chore reminders" />
            <Card className="settings-card">
              <Toggle checked={morning} onChange={setMorning} label="Morning assignment · 9:00 AM" />
              <Toggle checked={evening} onChange={setEvening} label="Evening check-in · 6:00 PM" />
              <Toggle checked={lastCall} onChange={setLastCall} label="Last calls · 10:00 & 11:30 PM" />
              <p className="settings-note"><Clock3 size={15} /> Individual chores can replace these household defaults.</p>
              {currentMember.role === 'owner' && (
                <Button
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
            <Card className="audit-list">
              {data.auditEvents.map((event) => {
                const actor = data.members.find((member) => member.id === event.actorMemberId)
                return (
                  <div className="audit-row" key={event.id}>
                    <div className="audit-icon"><History size={16} /></div>
                    <div><strong>{event.summary}</strong><span>{event.action} · {formatDateTime(event.createdAt)}</span></div>
                    {actor && <Avatar initials={actor.initials} color={actor.color} size="sm" />}
                  </div>
                )
              })}
            </Card>
          </section>
        </div>

        <aside>
          <SectionHeader eyebrow="MEMBERS" title={data.household.name} />
          <Card className="member-list-card">
            {data.members.map((member) => (
              <div className="member-row" key={member.id}>
                <Avatar initials={member.initials} color={member.color} />
                <div>
                  <strong>{member.displayName}</strong>
                  <span>{member.email || 'House-code account'}</span>
                </div>
                <Badge tone={member.role === 'owner' ? 'amber' : 'neutral'}>{member.role}</Badge>
              </div>
            ))}
          </Card>

          {currentMember.role === 'owner' && (
            <Card className="invite-card">
              <div className="invite-icon"><KeyRound /></div>
              <h3>House share code</h3>
              <p>
                Roommates can create a device-based account with this code.
                Rotating it immediately disables the old one.
              </p>
              {shareCode ? (
                <button
                  className="share-code-display"
                  onClick={() => navigator.clipboard.writeText(shareCode)}
                >
                  <strong>{shareCode}</strong>
                  <span><Copy size={14} /> Copy code</span>
                </button>
              ) : (
                <p className="masked-share-code">
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

          <Card className="house-details">
            <div><ShieldCheck /><span>Household security</span></div>
            <dl>
              <dt>Timezone</dt><dd>{data.household.timezone}</dd>
              <dt>Currency</dt><dd>{data.household.currency}</dd>
              <dt>Address</dt>
              <dd>
                {data.household.address.line1}, {data.household.address.city},{' '}
                {data.household.address.region}
              </dd>
              <dt>Features</dt>
              <dd>{data.household.enabledFeatures.length} enabled</dd>
            </dl>
            <button onClick={() => navigator.clipboard.writeText(data.household.id)}>
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
    <div className="health-row">
      {ready ? <CheckCircle2 className="health-ok" /> : <CircleAlert className="health-warn" />}
      <span>{label}</span>
      <strong>{value ?? (ready ? 'Ready' : 'Needs attention')}</strong>
    </div>
  )
}
