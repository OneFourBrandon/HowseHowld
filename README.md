# HowseHowld

A mobile-first household PWA for chores, shared money, events, course
schedules, driveway coordination, peer-reviewed infractions, and reliable
server-authoritative deadlines.

## What is implemented

- One Supabase project for any number of isolated households
- Email OTP admin accounts, anonymous share-code resident accounts, and optional later identity linking
- Household setup with address, feature selection, and owner-rotatable hashed share codes
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
Anonymous Auth is enabled in the local Supabase configuration. A roommate can
join with the house share code and a display name without providing an email.

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

1. Create one hosted Supabase project and run every migration. Do not create a
   separate Supabase project for each customer household.
2. Under Auth providers, enable **Allow anonymous sign-ins** and **Allow manual
   linking**. Enable Cloudflare Turnstile or hCaptcha before opening signups to
   the public; anonymous users otherwise create database records cheaply.
3. Configure Resend under Supabase Auth SMTP, set OTP length to six, copy the
   `supabase/templates/magic_link.html` content into the hosted Magic Link
   template so it sends `{{ .Token }}`, and add the final Vercel URL to Auth
   redirect URLs.
4. Sign in with the house admin email, create the house with its address and
   enabled features, then share the generated code with residents. House codes
   are stored only as SHA-256 hashes and can be rotated from Settings.
5. Generate one VAPID key pair. Add the values from
   `supabase/functions/.env.example` as Edge Function secrets.
6. Deploy `push-subscribe`, `push-dispatch`, and `import-ics`.
7. Replace the placeholders in `supabase/setup_push_cron.sql` and run it once.
8. Add `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and
   `VITE_VAPID_PUBLIC_KEY` to Vercel, then deploy the static Vite build.
9. Run Supabase database advisors and complete the four-device acceptance
   checklist before household rollout.

House-code accounts are device-based until the resident links an email or OAuth
identity. If they sign out, clear browser data, or change devices before linking
an identity, Supabase cannot recover that anonymous account. Schedule cleanup of
unjoined anonymous Auth users and monitor anonymous-signup rate limits.

Never expose the service-role key, VAPID private key, SMTP password, or
dispatcher secret through a `VITE_` environment variable.
