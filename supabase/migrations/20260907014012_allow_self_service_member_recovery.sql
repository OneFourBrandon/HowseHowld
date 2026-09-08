-- Let a device-based roommate issue a recovery code for their own membership.
-- Household owners retain their existing ability to issue one for a roommate.
create or replace function private.issue_member_recovery_code_impl(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_target_role public.household_role;
  v_actor_member_id uuid;
  v_is_self boolean;
  v_raw text := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 16));
  v_code text := 'REC-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4)
    || '-' || substr(v_raw, 9, 4) || '-' || substr(v_raw, 13, 4);
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required';
  end if;

  select household_id, role
  into v_household_id, v_target_role
  from public.household_members
  where id = p_member_id and active;

  if v_household_id is null then
    raise exception 'That roommate is no longer active';
  end if;

  v_actor_member_id := private.current_member_id(v_household_id);
  if v_actor_member_id is null then
    raise exception 'You do not belong to this household';
  end if;

  v_is_self := v_actor_member_id = p_member_id;
  if not v_is_self and not private.is_household_owner(v_household_id) then
    raise exception 'Only the household owner can issue a code for another roommate';
  end if;
  if v_is_self and not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) then
    raise exception 'Use your email sign-in link to access this account on another device';
  end if;
  if v_target_role = 'owner' then
    raise exception 'The household owner can recover access by email';
  end if;

  update public.member_recovery_codes
  set revoked_at = now()
  where member_id = p_member_id
    and used_at is null
    and revoked_at is null;

  insert into public.member_recovery_codes (
    household_id, member_id, code_hash, code_last4, created_by
  ) values (
    v_household_id,
    p_member_id,
    encode(extensions.digest(private.normalized_join_code(v_code), 'sha256'), 'hex'),
    right(v_code, 4),
    v_actor_member_id
  );

  insert into public.audit_events (
    household_id, actor_member_id, action, entity_type, entity_id, summary
  ) values (
    v_household_id,
    v_actor_member_id,
    case when v_is_self then 'member.recovery_code_requested' else 'member.recovery_code_issued' end,
    'household_members',
    p_member_id,
    case
      when v_is_self then 'Roommate requested a one-time recovery code'
      else 'One-time roommate recovery code issued'
    end
  );

  return v_code;
end
$$;

revoke all on function private.issue_member_recovery_code_impl(uuid) from public;
grant execute on function private.issue_member_recovery_code_impl(uuid) to authenticated;
