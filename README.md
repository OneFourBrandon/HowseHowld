# HowseHowld

A mobile-first household PWA for chores, shared money, events, course
schedules, driveway coordination, peer-reviewed infractions, and reliable
server-authoritative deadlines.

## What is implemented

- Email OTP authentication, household creation, owner invites, and equal-member access
- Per-task rotations, fixed/manual/one-off tasks, Toronto-time deadlines, reminders, completion, escalation, disputes, and peer voting
- Immutable double-entry expense ledger, multiple payers/beneficiaries, deterministic cent splitting, confirmed settlements, receipt storage, and household-fund payments
- Household calendar, `.ics` file/URL import, full roommate course visibility, and recurring schedule preservation
- Versioned drag-and-drop driveway lineup, manual/course departures, blocker calculation, and targeted warnings
- Installable offline app shell, Web Push subscriptions, test delivery, dead-subscription cleanup, notification outbox, Cron processing, audit history, and demo mode

## Local development

Requirements: Node 24+, pnpm 11+, Docker Desktop.

```powershell
pnpm install
pnpm exec supabase start
pnpm dev
```

Copy `.env.example` to `.env.local` and use the local values printed by
`supabase status`. Without those values, the app deliberately opens in a
fully interactive demo household.

Local auth emails appear in Mailpit at `http://127.0.0.1:54324`.

## Docker Compose and WebStorm

The default Compose service runs the Vite development server with hot reload:

```powershell
docker compose up --build
```

Open `http://localhost:5173`. Without an `.env.local`, it starts in the
interactive demo household.

For the complete local backend, start Supabase on the host first:

```powershell
pnpm supabase:start
pnpm exec supabase status
```

Copy `.env.example` to `.env.local`, then set the URL to
`http://127.0.0.1:54321` and copy the publishable key printed by
`supabase status`. The URL is intentionally localhost because the Supabase
client runs in your browser, even though Vite runs in a container.

In WebStorm, add `compose.yaml` as a Docker Compose run configuration and
select the `app` service. For full-stack development, create a compound run
configuration containing:

1. An npm configuration for `supabase:start`.
2. The Docker Compose `app` configuration.

Run `pnpm supabase:stop` when you want to stop the local backend without
deleting its data. Rebuild the `app` service after changing dependencies.

## Verification

```powershell
pnpm test
pnpm lint
pnpm build
pnpm exec supabase db reset --local
pnpm exec supabase db lint --local --schema public,private --fail-on error
pnpm exec supabase test db supabase/tests/database --local
pnpm test:e2e
```

Install icons can be regenerated from `public/favicon.svg` with `pnpm icons`.
The same checks run in `.github/workflows/ci.yml`.

The final physical-device gate must be completed on the actual three Android
phones and iPhone. On iOS, install from Safari to the Home Screen before
requesting notification permission. Web Push is best-effort and does not claim
to bypass Focus or silent mode.

## Production setup

1. Create a hosted Supabase project and run the migration.
2. Configure Resend under Supabase Auth SMTP, set OTP length to six, and add the
   final Vercel URL to Auth redirect URLs.
3. Create the first auth user in Supabase, then use owner invites for roommates.
4. Generate one VAPID key pair. Add the values from
   `supabase/functions/.env.example` as Edge Function secrets.
5. Deploy `push-subscribe`, `push-dispatch`, and `import-ics`.
6. Replace the placeholders in `supabase/setup_push_cron.sql` and run it once.
7. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
   `VITE_VAPID_PUBLIC_KEY` to Vercel, then deploy the static Vite build.
8. Run Supabase database advisors and complete the four-device acceptance
   checklist before household rollout.

Never expose the service-role key, VAPID private key, SMTP password, or
dispatcher secret through a `VITE_` environment variable.
