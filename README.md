# HowseHowld

A mobile-first household PWA for chores, shared money, events, course
schedules, driveway coordination, peer-reviewed infractions, and reliable
server-authoritative deadlines.

## What is implemented

- One Supabase project for any number of isolated households
- Email magic-link admin accounts, anonymous share-code resident accounts, and optional later identity linking
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
pnpm dev:stack
```

`dev:stack` is the single local full-stack entry point. When
`VITE_SUPABASE_URL` is absent, a placeholder, or localhost, it starts the
Supabase CLI stack first and then the Compose app. Stopping the run stops both
sets of containers without deleting their data. When the URL is a real hosted
Supabase URL, it starts only the app.

Development builds automatically use the standard local Supabase URL and
public local key when no values are configured. Production builds never use
those defaults and still require hosted environment variables.

Local auth emails appear in Mailpit at `http://127.0.0.1:54324`.
Anonymous Auth is enabled in the local Supabase configuration. A roommate can
join with the house share code and a display name without providing an email.

## Docker Compose and WebStorm

The Compose service itself runs the Vite development server with hot reload:

```powershell
docker compose up --build
```

Open `http://localhost:5173`. Supabase local development is managed by its CLI,
which generates its own Docker services from `supabase/config.toml`; it is not
duplicated inside `compose.yaml`.

In WebStorm, create an npm run configuration for `dev:stack` and use that
instead of the raw Compose configuration when you want the complete local
application. The WebStorm Stop button reaches the script cleanup block, which
stops both the app and local Supabase while preserving their volumes.

Running `docker compose up --build` directly remains app-only. This is useful
when `VITE_SUPABASE_URL` points at a hosted project.

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
3. Configure Resend under Supabase Auth SMTP, copy the
   `supabase/templates/magic_link.html` content into the hosted Magic Link
   template, and add the final Vercel URL to Auth redirect URLs.
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
