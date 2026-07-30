import { useMemo, useState } from 'react'
import {
  BellRing,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Copy,
  Download,
  History,
  LogOut,
  Mail,
  Plus,
  Send,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { signOut } from '../lib/api'
import { hasSupabaseConfig } from '../lib/supabase'
import { useAppData } from '../state/AppDataContext'
import { Avatar, Badge, Button, Card, SectionHeader, Toggle } from '../components/ui'
import { formatDateTime } from '../lib/utils'

export function SettingsPage() {
  const {
    data,
    busy,
    demoMode,
    enableNotifications,
    sendTestNotification,
    createInvite,
  } = useAppData()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLink, setInviteLink] = useState('')
  const [morning, setMorning] = useState(true)
  const [evening, setEvening] = useState(true)
  const [lastCall, setLastCall] = useState(true)
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
              </div>
              {needRefresh && (
                <button className="update-notice" onClick={() => updateServiceWorker(true)}>
                  <Download size={17} /> A new version is ready. Tap to update.
                </button>
              )}
            </Card>
          </section>

          <section>
            <SectionHeader eyebrow="DEFAULTS" title="Chore reminders" />
            <Card className="settings-card">
              <Toggle checked={morning} onChange={setMorning} label="Morning assignment · 9:00 AM" />
              <Toggle checked={evening} onChange={setEvening} label="Evening check-in · 6:00 PM" />
              <Toggle checked={lastCall} onChange={setLastCall} label="Last calls · 10:00 & 11:30 PM" />
              <p className="settings-note"><Clock3 size={15} /> Individual chores can replace these household defaults.</p>
            </Card>
          </section>

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
                <div><strong>{member.displayName}</strong><span>{member.email}</span></div>
                <Badge tone={member.role === 'owner' ? 'amber' : 'neutral'}>{member.role}</Badge>
              </div>
            ))}
          </Card>

          {currentMember.role === 'owner' && (
            <Card className="invite-card">
              <div className="invite-icon"><UserRoundPlus /></div>
              <h3>Invite a roommate</h3>
              <p>Only invited email addresses can request a sign-in code.</p>
              <form
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (demoMode) {
                    setInviteLink(`${window.location.origin}/?invite=demo-invite`)
                  } else {
                    setInviteLink(await createInvite(inviteEmail))
                  }
                  setInviteEmail('')
                }}
              >
                <label>Email
                  <div className="input-with-icon">
                    <Mail size={16} />
                    <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="roommate@example.com" required />
                  </div>
                </label>
                <Button type="submit" size="sm"><Plus size={16} /> Create invite</Button>
              </form>
              {inviteLink && (
                <button
                  className="invite-link"
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                >
                  <Copy size={14} /> Copy invite link
                </button>
              )}
            </Card>
          )}

          <Card className="house-details">
            <div><ShieldCheck /><span>Household security</span></div>
            <dl>
              <dt>Timezone</dt><dd>{data.household.timezone}</dd>
              <dt>Currency</dt><dd>{data.household.currency}</dd>
              <dt>Mode</dt><dd>{demoMode ? 'Demo data' : 'Live Supabase'}</dd>
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
