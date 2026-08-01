-- Make the recovery-code table's deny-by-default posture explicit to RLS tooling.
-- All browser access still goes through the authenticated owner/recovery RPCs.

create policy member_recovery_codes_no_direct_access
  on public.member_recovery_codes
  for all
  to authenticated
  using (false)
  with check (false);
