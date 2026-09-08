-- Applied independently of the broader UI refinement migration for auth rollout.
-- An inherited avatar may retain its original storage path after device recovery.
alter table public.profiles drop constraint if exists profiles_avatar_path_shape;
alter table public.profiles add constraint profiles_avatar_path_shape check (
  avatar_path is null or avatar_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f-]+\.(jpg|png|webp)$'
);
create or replace function private.guard_profile_avatar_path()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('authenticated','anon') and new.avatar_path is distinct from old.avatar_path
    and new.avatar_path is not null and split_part(new.avatar_path,'/',1) <> new.id::text then
    raise exception 'Choose a picture uploaded to your account';
  end if;
  return new;
end $$;
drop trigger if exists guard_profile_avatar_path on public.profiles;
create trigger guard_profile_avatar_path before update on public.profiles for each row execute function private.guard_profile_avatar_path();
drop policy if exists avatars_recovered_household_select on storage.objects;
create policy avatars_recovered_household_select on storage.objects for select to authenticated using (
  bucket_id='avatars' and exists (
    select 1 from public.profiles p join public.household_members subject on subject.profile_id=p.id and subject.active
    join public.household_members viewer on viewer.household_id=subject.household_id and viewer.active
    where viewer.profile_id=(select auth.uid()) and p.avatar_path=storage.objects.name
  )
);
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
  v_previous_avatar text;
  v_previous_color text;
  v_onboarded timestamptz;
begin
  select rc.id, rc.member_id, rc.household_id, hm.profile_id, old_profile.display_name, old_profile.avatar_path, old_profile.avatar_color, old_profile.onboarding_completed_at
  into v_code_id, v_member_id, v_household_id, v_previous_profile_id, v_previous_name, v_previous_avatar, v_previous_color, v_onboarded
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
  set display_name = v_previous_name,
      avatar_path = v_previous_avatar,
      avatar_color = v_previous_color,
      onboarding_completed_at = coalesce(v_onboarded, now()),
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
  where id = p_member_id and active
  for update;

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
