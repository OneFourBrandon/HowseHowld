# Household refinements: branch testing

Branch: `codex/household-refinements`; review PR #2 targets `master`. No direct production branch push or Edge Function deployment was performed. With user authorization, scoped driveway, expense editing, penalty/review, and recovery migrations were applied to production on September 8, 2026 UTC. The broader household-refinements migration remains unapplied. See [the current auth rollout notes](reliable-auth-rollout.md) for the new OTP flow, hosted configuration and validation limits; the original testing notes below describe the earlier refinement pass.

## UI preview

In PowerShell, run the app with demo data:

```powershell
$env:VITE_DEMO_MODE = 'true'
pnpm dev
```

Demo changes are in-memory. Test purchase-price hover and tap, price corrections, the sun/moon toggle, overview day cards, and the editable driveway below.

### Editable driveway

- Admin: choose **Add slot** to fill the next available cell, or **Edit layout** to change existing slots. Drag anywhere on a tile to move it right/down into new grid space; drag any of its four edges to stretch it. Grid space expands as you move, and zoom controls help with larger layouts.
- Tap a tile in editing mode to change its row, column, width, length or garage type. A stretched tile still holds one car. Slots cannot overlap. Unpark a car before deleting its slot.
- Choose **Save driveway** to share the layout. Cancel discards the draft. Saving a layout preserves current vehicle assignments, including changes made while the admin was editing.
- Residents can drag cars between slots (occupied slots swap cars), or tap a slot and select a vehicle. Newly added vehicles start in **Not parked**. Selecting Empty unparks a car without deleting its slot.
- Exit blockers are occupied slots above the car whose horizontal footprints overlap its path. A wide slot can have blockers in multiple lanes. Moving or unparking cars cancels pending warnings that no longer apply.
- Production has `20260908032721_driveway_slot_prerequisites.sql` and `20260908032739_editable_driveway_slots.sql` applied; local filenames match the remote migration versions. Both existing active cars were seeded into individual tiles. Apply these migrations to a separate test backend before testing there.
- `pnpm test:driveway-db` runs the actual slot migration and its routines in embedded PostgreSQL with a minimal household fixture. It verifies permissions, migration seeding, overlap rejection, occupancy preservation, swaps, blocker notifications and cancellation. Realtime transport and delivery to a real device still require Supabase integration testing.

## Backend testing required before release

Use a separate Supabase test project or an already-running disposable local stack. Do not point migration/testing commands at production. No containers were started during this task.

1. Apply the repository migrations to the test backend, including `20260907043820_household_refinements.sql`.
2. Run the pgTAP suite in `supabase/tests/database`, including `refinements.test.sql`. The new SQL tests cover recovery after linking email, retained name/avatar/onboarding, single-use codes, price corrections and permissions, immutable original ledger entries, and driveway layout permissions. These SQL tests have been added but were not executed during this task.
3. Configure the frontend to use that test backend and its publishable key. Disable demo mode for live integration tests.
4. Check an email-linked roommate can generate a recovery code in Settings. A code recovery transfers the existing membership to the new device identity, as in the existing recovery model; it does not keep the previous anonymous device signed in. Verified recovery-email sign-in is the multi-device path. Email delivery still requires working SMTP and allowed redirect URLs in the test project's Auth settings.
5. Redeem a code on a fresh device. Verify the original name, avatar and completed onboarding survive. Check admin roommate cards show creation timestamps and profile pictures.
6. Edit a purchase twice, including an odd-cent total. Verify shares, balances, audit entries, concurrent-edit rejection and subsequent purchase reversal. Only its creator can edit a purchase.
7. Save a multi-lane driveway with a garage tile spanning two cells. Schedule an exit from that tile and verify cars above either overlapping lane are notified, while cars beside or behind it are not.

## Notifications

Deploy the updated `push-dispatch` function to the TEST backend using the repository's `verify_jwt = false` configuration. The function authenticates user tests itself and requires `X-Dispatch-Secret` for scheduled dispatch.

Required Edge Function secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` and `DISPATCH_SECRET`. The frontend `VITE_VAPID_PUBLIC_KEY` must match the function public key. Never commit private keys or dispatch secrets.

For automatic dispatch, add Vault secrets named `project_url` (the test project's HTTPS URL) and `dispatch_secret` (matching `DISPATCH_SECRET`). The new cron job calls the function every minute; without these secrets it stays idle. The existing database scheduler still generates due reminders.

On each device, enable reminders again to replace an expired/old-key subscription. Test sends target that device's endpoint, not another browser's subscription, and do not drain unrelated household reminders. Push acceptance is not proof of a visible notification: OS permissions, Focus modes, and browser/platform restrictions still apply.

## Migration-history repair

Nine existing migration filenames now match the corresponding deployed version IDs verified from the remote history. Their SQL was not replaced with empty placeholders, and remote history was not rewritten. The GitHub check cannot reflect these local fixes until the branch is pushed and its workflow is run with your approval.

## Checks completed

- TypeScript and production build passed.
- Lint passed.
- 26 unit tests passed.
- 16 Playwright checks passed across mobile Chrome and Safari, including slot/car dragging and desktop screenshots.
- 3 embedded PostgreSQL integration tests passed for the editable driveway.
- Production email delivery, push delivery, and new database routines remain unverified until test-backend integration testing.
