-- Admin-managed recovery and membership lifecycle for device-based accounts.
-- Recovery codes are bearer credentials: store only their hash and allow each
-- code to be redeemed once.

create table public.member_recovery_codes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  code_hash text not null unique,
  code_last4 text not null,
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  used_at timestamptz,
  revoked_at timestamptz
);

create index member_recovery_codes_member_idx
  on public.member_recovery_codes(member_id, created_at desc);
create index member_recovery_codes_household_idx
  on public.member_recovery_codes(household_id, created_at desc);

alter table public.member_recovery_codes enable row level security;
revoke all on public.member_recovery_codes from public, anon, authenticated;

create or replace function private.redeem_member_recovery_code_impl(
  p_code text,
  p_display_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_code_id uuid;
  v_member_id uuid;
  v_household_id uuid;
  v_previous_profile_id uuid;
  v_previous_name text;
  v_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  select rc.id, rc.member_id, rc.household_id, hm.profile_id, old_profile.display_name
  into v_code_id, v_member_id, v_household_id, v_previous_profile_id, v_previous_name
  from public.member_recovery_codes rc
  join public.household_members hm on hm.id = rc.member_id
  join public.profiles old_profile on old_profile.id = hm.profile_id
  where rc.code_hash = encode(
          extensions.digest(private.normalized_join_code(p_code), 'sha256'),
          'hex'
        )
    and rc.used_at is null
    and rc.revoked_at is null
    and rc.expires_at > now()
    and hm.active
  for update of rc, hm;

  if v_code_id is null then
    return null;
  end if;
  if v_user is null then
    raise exception 'Authentication required';
  end if;
  if not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) then
    raise exception 'Recovery codes are for device-based accounts';
  end if;
  if exists (
    select 1 from public.household_members
    where profile_id = v_user and active
  ) then
    raise exception 'This account already belongs to a household';
  end if;
  if exists (
    select 1 from public.household_members
    where household_id = v_household_id and profile_id = v_user
  ) then
    raise exception 'This device account already has household history';
  end if;

  update public.profiles
  set display_name = coalesce(v_name, v_previous_name),
      account_kind = 'house_code',
      updated_at = now()
  where id = v_user;

  update public.household_members
  set profile_id = v_user
  where id = v_member_id and active;

  update public.member_recovery_codes
  set used_at = now()
  where id = v_code_id;

  insert into public.audit_events (
    household_id, actor_member_id, action, entity_type, entity_id,
    before_data, after_data, summary
  ) values (
    v_household_id, v_member_id, 'member.recovered', 'household_members', v_member_id,
    jsonb_build_object('profile_id', v_previous_profile_id),
    jsonb_build_object('profile_id', v_user),
    'Roommate account recovered with a one-time code'
  );

  return v_household_id;
end
$$;

revoke all on function private.redeem_member_recovery_code_impl(text, text) from public;
grant execute on function private.redeem_member_recovery_code_impl(text, text) to authenticated;

create or replace function private.issue_member_recovery_code_impl(p_member_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household_id uuid;
  v_actor_member_id uuid;
  v_raw text := upper(substr(encode(extensions.gen_random_bytes(8), 'hex'), 1, 16));
  v_code text := 'REC-' || substr(v_raw, 1, 4) || '-' || substr(v_raw, 5, 4)
    || '-' || substr(v_raw, 9, 4) || '-' || substr(v_raw, 13, 4);
begin
  select household_id into v_household_id
  from public.household_members
  where id = p_member_id and active;
  if v_household_id is null then
    raise exception 'That roommate is no longer active';
  end if;
  if not private.is_household_owner(v_household_id) then
    raise exception 'Only the household owner can issue recovery codes';
  end if;
  if exists (
    select 1 from public.household_members
    where id = p_member_id and role = 'owner'
  ) then
    raise exception 'The household owner does not need a recovery code';
  end if;

  v_actor_member_id := private.current_member_id(v_household_id);
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
    v_household_id, v_actor_member_id, 'member.recovery_code_issued',
    'household_members', p_member_id, 'One-time roommate recovery code issued'
  );

  return v_code;
end
$$;

revoke all on function private.issue_member_recovery_code_impl(uuid) from public;
grant execute on function private.issue_member_recovery_code_impl(uuid) to authenticated;

create or replace function private.remove_household_member_impl(p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.household_members%rowtype;
  v_actor_member_id uuid;
begin
  select * into v_target
  from public.household_members
  where id = p_member_id and active;
  if v_target.id is null then
    raise exception 'That roommate is no longer active';
  end if;
  if not private.is_household_owner(v_target.household_id) then
    raise exception 'Only the household owner can remove roommates';
  end if;
  if v_target.role = 'owner' then
    raise exception 'The household owner cannot be removed';
  end if;

  v_actor_member_id := private.current_member_id(v_target.household_id);
  update public.household_members
  set active = false, left_at = now()
  where id = p_member_id and active;
  update public.member_recovery_codes
  set revoked_at = now()
  where member_id = p_member_id
    and used_at is null
    and revoked_at is null;

  insert into public.audit_events (
    household_id, actor_member_id, action, entity_type, entity_id,
    before_data, after_data, summary
  ) values (
    v_target.household_id, v_actor_member_id, 'member.removed',
    'household_members', p_member_id,
    jsonb_build_object('profile_id', v_target.profile_id, 'active', true),
    jsonb_build_object('profile_id', v_target.profile_id, 'active', false),
    'Roommate removed from the household'
  );
end
$$;

revoke all on function private.remove_household_member_impl(uuid) from public;
grant execute on function private.remove_household_member_impl(uuid) to authenticated;

create or replace function public.issue_member_recovery_code(p_member_id uuid)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.issue_member_recovery_code_impl(p_member_id) $$;

create or replace function public.remove_household_member(p_member_id uuid)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.remove_household_member_impl(p_member_id) $$;

revoke execute on function public.issue_member_recovery_code(uuid) from public, anon;
revoke execute on function public.remove_household_member(uuid) from public, anon;
grant execute on function public.issue_member_recovery_code(uuid) to authenticated;
grant execute on function public.remove_household_member(uuid) to authenticated;

-- Extend the existing join RPC to accept either a house share code or a
-- one-time member recovery code. Ordinary share-code behavior remains intact.
create or replace function private.join_household_by_code_impl(
  p_code text,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_household uuid;
  v_normalized text := private.normalized_join_code(p_code);
  v_recovered uuid;
begin
  v_recovered := private.redeem_member_recovery_code_impl(p_code, p_display_name);
  if v_recovered is not null then
    return v_recovered;
  end if;

  if v_user is null then raise exception 'Authentication required'; end if;
  if not coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) then
    raise exception 'This join flow is for share-code accounts';
  end if;
  if char_length(trim(p_display_name)) not between 2 and 80 then
    raise exception 'Display name must be between 2 and 80 characters';
  end if;
  if char_length(v_normalized) <> 12 then
    raise exception 'Share code is invalid';
  end if;
  if exists (
    select 1 from public.household_members
    where profile_id = v_user and active
  ) then
    raise exception 'This account already belongs to a household';
  end if;

  select id into v_household
  from public.households
  where join_code_hash = encode(extensions.digest(v_normalized, 'sha256'), 'hex')
  for share;
  if v_household is null then raise exception 'Share code is invalid'; end if;

  update public.profiles
  set display_name = trim(p_display_name), account_kind = 'house_code', updated_at = now()
  where id = v_user;
  insert into public.household_members(household_id, profile_id, role)
  values (v_household, v_user, 'member');
  return v_household;
end
$$;

revoke all on function private.join_household_by_code_impl(text, text) from public;
grant execute on function private.join_household_by_code_impl(text, text) to authenticated;
