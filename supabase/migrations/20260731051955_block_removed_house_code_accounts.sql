-- Keep removed device identities from rejoining with the ordinary house code.
-- Admin-issued recovery remains the explicit path for restoring an active member.

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
  if exists (
    select 1 from public.household_members
    where profile_id = v_user and active
  ) then
    raise exception 'This account already belongs to a household';
  end if;
  if exists (
    select 1 from public.household_members
    where profile_id = v_user and not active
  ) then
    raise exception 'This account was removed from the household';
  end if;
  if char_length(trim(p_display_name)) not between 2 and 80 then
    raise exception 'Display name must be between 2 and 80 characters';
  end if;
  if char_length(v_normalized) <> 12 then
    raise exception 'Share code is invalid';
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
