-- Multi-tenant household onboarding.
-- One Supabase project serves every household; membership rows remain the
-- authorization boundary for all business data.

alter table public.profiles
  add column account_kind text not null default 'email'
    check (account_kind in ('email', 'house_code'));

alter table public.households
  add column address_line1 text,
  add column address_line2 text,
  add column city text,
  add column region text,
  add column postal_code text,
  add column country_code text not null default 'CA'
    check (country_code ~ '^[A-Z]{2}$'),
  add column enabled_features jsonb not null default
    '["chores","money","calendar","courses","driveway","notifications"]'::jsonb,
  add column join_code_hash text,
  add column join_code_last4 text,
  add column join_code_rotated_at timestamptz;

alter table public.households
  add constraint households_enabled_features_array
  check (
    jsonb_typeof(enabled_features) = 'array'
    and enabled_features <@
      '["chores","money","calendar","courses","driveway","notifications"]'::jsonb
  );

create unique index households_join_code_hash_idx
  on public.households(join_code_hash)
  where join_code_hash is not null;

-- A resident account belongs to one active household in v1. This prevents a
-- leaked session from being attached to a second tenant through another code.
create unique index household_members_one_active_household_idx
  on public.household_members(profile_id)
  where active;

-- Give PostgREST an explicit relationship for the nested driveway snapshot
-- query. The original two tables only shared separate household FKs.
alter table public.driveway_positions
  add constraint driveway_positions_state_fk
  foreign key (household_id)
  references public.driveway_state(household_id)
  on delete cascade;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email, account_kind)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Roommate'
    ),
    coalesce(new.email, ''),
    case when coalesce(new.is_anonymous, false) then 'house_code' else 'email' end
  )
  on conflict (id) do update set
    email = excluded.email,
    account_kind = excluded.account_kind,
    updated_at = now();
  return new;
end
$$;

create or replace function private.normalized_join_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'))
$$;

create or replace function private.new_join_code()
returns text
language sql
volatile
set search_path = ''
as $$
  select upper(substr(encode(extensions.gen_random_bytes(9), 'hex'), 1, 12))
$$;

revoke all on function private.normalized_join_code(text) from public;
revoke all on function private.new_join_code() from public;

create or replace function private.create_household_v2_impl(p_input jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_household uuid;
  v_code text := private.new_join_code();
  v_features jsonb := coalesce(
    p_input->'enabledFeatures',
    '["chores","money","calendar","courses","driveway","notifications"]'::jsonb
  );
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if coalesce((select (auth.jwt()->>'is_anonymous')::boolean), false) then
    raise exception 'A recoverable email account is required to create a household';
  end if;
  if exists (
    select 1 from public.household_members
    where profile_id = v_user and active
  ) then
    raise exception 'This account already belongs to a household';
  end if;
  if nullif(trim(p_input->>'name'), '') is null then
    raise exception 'Household name is required';
  end if;
  if nullif(trim(p_input->>'addressLine1'), '') is null
    or nullif(trim(p_input->>'city'), '') is null
    or nullif(trim(p_input->>'region'), '') is null
    or nullif(trim(p_input->>'postalCode'), '') is null then
    raise exception 'A complete household address is required';
  end if;
  if jsonb_typeof(v_features) <> 'array' or exists (
    select 1 from jsonb_array_elements_text(v_features) feature(value)
    where feature.value not in (
      'chores', 'money', 'calendar', 'courses', 'driveway', 'notifications'
    )
  ) then
    raise exception 'Invalid household feature selection';
  end if;

  insert into public.households (
    name, address_line1, address_line2, city, region, postal_code,
    country_code, enabled_features, join_code_hash, join_code_last4,
    join_code_rotated_at, created_by
  ) values (
    trim(p_input->>'name'),
    trim(p_input->>'addressLine1'),
    nullif(trim(p_input->>'addressLine2'), ''),
    trim(p_input->>'city'),
    trim(p_input->>'region'),
    upper(trim(p_input->>'postalCode')),
    upper(coalesce(nullif(trim(p_input->>'countryCode'), ''), 'CA')),
    v_features,
    encode(extensions.digest(private.normalized_join_code(v_code), 'sha256'), 'hex'),
    right(v_code, 4),
    now(),
    v_user
  )
  returning id into v_household;

  insert into public.household_members(household_id, profile_id, role)
  values (v_household, v_user, 'owner');
  insert into public.driveway_state(household_id) values (v_household);

  return jsonb_build_object(
    'householdId', v_household,
    'shareCode',
    substr(v_code, 1, 3) || '-' || substr(v_code, 4, 3) || '-' ||
    substr(v_code, 7, 3) || '-' || substr(v_code, 10, 3)
  );
end
$$;

revoke all on function private.create_household_v2_impl(jsonb) from public;
grant execute on function private.create_household_v2_impl(jsonb) to authenticated;

create or replace function public.create_household_v2(p_input jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$ select private.create_household_v2_impl(p_input) $$;

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
begin
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
  where join_code_hash =
    encode(extensions.digest(v_normalized, 'sha256'), 'hex')
  for share;

  if v_household is null then raise exception 'Share code is invalid'; end if;

  update public.profiles
  set display_name = trim(p_display_name),
      account_kind = 'house_code',
      updated_at = now()
  where id = v_user;

  insert into public.household_members(household_id, profile_id, role)
  values (v_household, v_user, 'member');

  return v_household;
end
$$;

revoke all on function private.join_household_by_code_impl(text, text) from public;
grant execute on function private.join_household_by_code_impl(text, text) to authenticated;

create or replace function public.join_household_by_code(
  p_code text,
  p_display_name text
)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.join_household_by_code_impl(p_code, p_display_name) $$;

create or replace function private.rotate_household_share_code_impl(
  p_household_id uuid
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := private.new_join_code();
begin
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only the household owner can rotate the share code';
  end if;

  update public.households
  set join_code_hash =
        encode(extensions.digest(private.normalized_join_code(v_code), 'sha256'), 'hex'),
      join_code_last4 = right(v_code, 4),
      join_code_rotated_at = now(),
      updated_at = now()
  where id = p_household_id;

  return substr(v_code, 1, 3) || '-' || substr(v_code, 4, 3) || '-' ||
    substr(v_code, 7, 3) || '-' || substr(v_code, 10, 3);
end
$$;

revoke all on function private.rotate_household_share_code_impl(uuid) from public;
grant execute on function private.rotate_household_share_code_impl(uuid) to authenticated;

create or replace function public.rotate_household_share_code(
  p_household_id uuid
)
returns text
language sql
security invoker
set search_path = ''
as $$ select private.rotate_household_share_code_impl(p_household_id) $$;

revoke execute on function public.create_household(text) from authenticated;
revoke execute on function public.accept_household_invite(text) from authenticated;
revoke execute on function public.create_household_invite(uuid, text) from authenticated;
revoke execute on function public.create_household_v2(jsonb) from public, anon;
revoke execute on function public.join_household_by_code(text, text) from public, anon;
revoke execute on function public.rotate_household_share_code(uuid) from public, anon;
grant execute on function public.create_household_v2(jsonb) to authenticated;
grant execute on function public.join_household_by_code(text, text) to authenticated;
grant execute on function public.rotate_household_share_code(uuid) to authenticated;
