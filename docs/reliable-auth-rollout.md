# Anonymous sign-in and email recovery rollout

## Implemented

- Join a house uses anonymous Supabase authentication; Sign in uses email OTP with `shouldCreateUser: false`; Create a house explicitly allows email signup.
- Overview offers a session-dismissible email reminder. Settings keeps the verification control/status available. Verification uses `email_change`, refreshes auth claims, and checks the same user ID is now verified and non-anonymous.
- Six-digit inputs, one-time-code autocomplete, resend cooldowns and actionable errors replace link-only instructions. The existing Supabase storage key is unchanged.
- Network/refresh failures show reconnect/retry, not new-account onboarding. In particular, auth-js can emit `INITIAL_SESSION(null)` on an initialization error, so this is not treated as proof of logout.
- Interrupted join/recovery requests retain the new identity and check whether membership was already committed before retrying. Sign-out is scoped to the local device.
- Recovery codes preserve membership, name, avatar and completed onboarding. Emergency code recovery still transfers membership to a new anonymous identity; it is not the multi-device sign-in path. Use email OTP when you still have access to your verified email. If emergency recovery replaced an email-backed identity, that old email remains attached to the old auth user; use another unused recovery email or request support rather than merging identities implicitly.
- The service worker no longer caches authenticated database responses across account switches. Its old last-read data cache is removed on activation; auth storage is untouched.
- Cloudflare Pages middleware redirects the project's pages.dev production/preview hostnames to the canonical domain, retaining path and query. Localhost is excluded. Redirects become active with the branch deployment; master was not pushed or merged.

## Hosted Supabase changes (September 8, 2026)

- Enabled manual identity linking; anonymous sign-ins and email auth remain enabled.
- Set email OTP length to 6; expiry remains 3600 seconds. Secure email change remains enabled.
- Updated Magic Link/OTP, Confirm Signup, and Change Email templates to include `{{ .Token }}`. A secondary confirmation link remains for compatibility with the currently deployed older frontend.
- Verified single-session enforcement is off and session timebox/inactivity limits are both zero (never). Refresh-token rotation/replay protection remains on.
- Verified Site URL is `https://howse.brandon-barker.ca`. Explicit local redirects include localhost/127.0.0.1 on ports 5173 and 5174.
- Applied only `20260908233008_reliable_anonymous_recovery.sql`. Remote migration version and local filename match. Checked profile-preserving function and inherited-avatar policy; unauthenticated API role cannot execute recovery.
- The broader `20260907043820_household_refinements.sql` remains unapplied on production. Its avatar trigger/policy creation is now idempotent so it can follow this scoped rollout safely.
- Security advisors still report the existing `public.rls_auto_enable()` executable-function warning and expected anonymous-access policy notices; no new recovery-function warning was introduced. Leaked-password protection is unavailable on the current free plan. This app uses OTP rather than passwords.

## Checks

- `pnpm test`: auth transitions, email linking, unknown-user signup policy, profile recovery and existing UI/logic tests.
- `pnpm test:auth`: two isolated Chromium browser contexts using the real Supabase client with a deterministic mocked Auth API. Covers anonymous join, dismissal, email conversion, OTP errors, another-device sign-in, reload persistence, and local-only sign-out. Does not send real email or modify production users.
- `pnpm test:e2e`: existing mobile Chrome/Safari visual and workflow checks.
- `pnpm test:recovery-db`: actual recovery migration in embedded PostgreSQL, checking retained profile/membership and single-use permissions (fixture crypto is stubbed).
- `pnpm test:driveway-db`, `pnpm test:penalties-db`, `pnpm lint`, `pnpm build`.

## Release checks requiring real devices/inbox

Before merging, run the branch locally with production's public Supabase configuration and a consenting test roommate. Attach/verify their email, then sign in on a second device and confirm their existing household/avatar/history. Do not clear an anonymous user's browser storage before their email is verified or a recovery code has been saved.

Real inbox delivery, provider rate limiting, expiry/reuse enforcement, overnight device sleep, and installed-PWA updates need end-to-end validation; mocked browser tests do not prove these. The repository pgTAP suite remains a separate disposable-stack/CI check.

Preview URLs intentionally redirect to production per the selected plan, so test unmerged UI locally. Origin-bound sessions cannot move from pages.dev to the canonical domain: users who joined on an alternate hostname without a verified email may need one admin recovery code after the redirect. Never transfer refresh tokens through URL parameters.
