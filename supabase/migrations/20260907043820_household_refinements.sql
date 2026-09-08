-- Branch-only changes. Apply to a test backend before testing these features.
alter table public.households add column if not exists driveway_width integer not null default 1 check (driveway_width between 1 and 4);
alter table public.households add column if not exists garage_rows integer not null default 0 check (garage_rows between 0 and 3);

create or replace function private.set_driveway_layout_impl(p_household_id uuid, p_width integer, p_garage_rows integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_household_owner(p_household_id) then raise exception 'Only the household owner can change the layout'; end if;
  if p_width is null or p_width not between 1 and 4 or p_garage_rows is null or p_garage_rows not between 0 and 3 then raise exception 'Invalid driveway size'; end if;
  perform 1 from public.driveway_state where household_id = p_household_id for update;
  update public.households set driveway_width=p_width, garage_rows=p_garage_rows where id=p_household_id;
end $$;
revoke all on function private.set_driveway_layout_impl(uuid,integer,integer) from public;
grant execute on function private.set_driveway_layout_impl(uuid,integer,integer) to authenticated;
create or replace function public.set_driveway_layout(p_household_id uuid, p_width integer, p_garage_rows integer)
returns void language sql security invoker set search_path = '' as $$ select private.set_driveway_layout_impl(p_household_id,p_width,p_garage_rows) $$;
revoke all on function public.set_driveway_layout(uuid,integer,integer) from public,anon;
grant execute on function public.set_driveway_layout(uuid,integer,integer) to authenticated;

-- An inherited avatar may retain its original storage path after device recovery.
alter table public.profiles drop constraint profiles_avatar_path_shape;
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
create trigger guard_profile_avatar_path before update on public.profiles for each row execute function private.guard_profile_avatar_path();
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

create or replace function private.generate_departure_occurrences(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.departure_rules%rowtype;
  v_required timestamptz;
  v_until timestamptz := now() + make_interval(days => greatest(1, least(p_horizon_days, 90)));
  v_step interval;
  v_inserted integer := 0;
begin
  for v_rule in select * from public.departure_rules where active loop
    v_required := v_rule.first_required_at;
    v_step := case coalesce(v_rule.recurrence->>'frequency', 'once')
      when 'daily' then make_interval(days => greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      when 'weekly' then make_interval(days => 7 * greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      when 'monthly' then make_interval(months => greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      else null
    end;
    while v_required <= v_until loop
      if v_required >= now() - interval '1 day' then
        insert into public.departure_occurrences(
          household_id, rule_id, vehicle_id, owner_member_id, required_at, blocker_vehicle_ids
        )
        select
          v_rule.household_id, v_rule.id, v_rule.vehicle_id, v_rule.owner_member_id,
          v_required,
          coalesce(array_agg(dp.vehicle_id order by dp.position)
            filter (where dp.position < target.position), '{}'::uuid[])
        from public.driveway_positions target
        left join public.driveway_positions dp
          on dp.household_id = target.household_id and dp.position < target.position
          and mod(dp.position, (select driveway_width from public.households where id = target.household_id)) = mod(target.position, (select driveway_width from public.households where id = target.household_id))
        where target.household_id = v_rule.household_id and target.vehicle_id = v_rule.vehicle_id
        group by target.position
        on conflict (rule_id, required_at) do update set
          blocker_vehicle_ids = excluded.blocker_vehicle_ids
        where public.departure_occurrences.blocker_vehicle_ids
          is distinct from excluded.blocker_vehicle_ids;
        if found then v_inserted := v_inserted + 1; end if;
      end if;
      exit when v_step is null;
      v_required := v_required + v_step;
    end loop;
  end loop;
  return v_inserted;
end
$$;

create or replace function private.enqueue_departure_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  update public.departure_occurrences occurrence
  set blocker_vehicle_ids = blockers.ids
  from (
    select target.vehicle_id,
      coalesce(array_agg(dp.vehicle_id order by dp.position)
        filter (where dp.position < target.position), '{}'::uuid[]) ids
    from public.driveway_positions target
    left join public.driveway_positions dp
      on dp.household_id = target.household_id and dp.position < target.position
          and mod(dp.position, (select driveway_width from public.households where id = target.household_id)) = mod(target.position, (select driveway_width from public.households where id = target.household_id))
    group by target.household_id, target.vehicle_id, target.position
  ) blockers
  where occurrence.vehicle_id = blockers.vehicle_id
    and occurrence.required_at between now() and now() + interval '2 days'
    and occurrence.blocker_vehicle_ids is distinct from blockers.ids;

  -- Previously queued warnings may refer to cars in a different column after
  -- a layout change. Retain history but stop those pending warnings being sent.
  update public.notification_outbox queued
  set status='cancelled', last_error='Driveway path changed'
  from public.departure_occurrences occurrence
  where queued.kind='driveway_warning' and queued.entity_id=occurrence.id
    and queued.status='pending'
    and not exists (
      select 1 from public.vehicles vehicle
      where vehicle.id=any(occurrence.blocker_vehicle_ids)
        and vehicle.owner_member_id=queued.member_id and vehicle.active
    );

  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select
    occurrence.household_id, blocker_vehicle.owner_member_id,
    'driveway_warning', 'departure_occurrence', occurrence.id,
    occurrence.required_at - make_interval(mins => warning.minutes),
    'Driveway move needed',
    owner_vehicle.label || ' needs a clear path for ' ||
      to_char(occurrence.required_at at time zone household.timezone, 'FMHH12:MI AM'),
    '/driveway',
    case when warning.minutes <= 60 then 'high' else 'normal' end
  from public.departure_occurrences occurrence
  join public.departure_rules rule on rule.id = occurrence.rule_id
  join public.households household on household.id = occurrence.household_id
  join public.vehicles owner_vehicle on owner_vehicle.id = occurrence.vehicle_id
  cross join lateral unnest(rule.warning_minutes) warning(minutes)
  cross join lateral unnest(occurrence.blocker_vehicle_ids) blocker_id(id)
  join public.vehicles blocker_vehicle on blocker_vehicle.id = blocker_id.id and blocker_vehicle.active
  where rule.active and occurrence.required_at between now() and now() + interval '31 days'
  on conflict (kind,entity_id,member_id,scheduled_at) do update
    set status='pending', last_error=null
    where public.notification_outbox.status='cancelled'
      and public.notification_outbox.last_error='Driveway path changed';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;


-- Post a compensating transaction and a replacement transaction atomically.
-- Existing ledger entries remain unchanged, including after repeated corrections.
create or replace function private.update_expense_amount_impl(p_expense_id uuid, p_amount integer, p_expected integer)
returns void language plpgsql security definer set search_path = '' as $$
declare
  e public.expenses%rowtype;
  actor uuid;
  reversal uuid;
  replacement uuid;
  shares jsonb;
  payers jsonb;
begin
  select * into e from public.expenses where id=p_expense_id for update;
  if not found then raise exception 'Purchase not found'; end if;
  actor := private.current_member_id(e.household_id);
  if actor is null or actor <> e.created_by then raise exception 'Only the creator can edit this purchase'; end if;
  if e.reversed_at is not null then raise exception 'This purchase was reversed'; end if;
  if p_expected is null or e.amount_cents <> p_expected then raise exception 'This purchase changed. Reload it before editing.'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a positive total'; end if;
  if p_amount=e.amount_cents then return; end if;

  select jsonb_agg(jsonb_build_object('member_id', member_id, 'amount', next_amount)) into payers from (
    select member_id,
      round(sum(amount_cents) over (order by member_id)::numeric * p_amount / e.amount_cents)
      - round((sum(amount_cents) over (order by member_id) - amount_cents)::numeric * p_amount / e.amount_cents) as next_amount
    from public.expense_payers where expense_id=e.id
  ) scaled;
  select jsonb_agg(jsonb_build_object('member_id', member_id, 'amount', next_amount)) into shares from (
    select member_id,
      round(sum(amount_cents) over (order by member_id)::numeric * p_amount / e.amount_cents)
      - round((sum(amount_cents) over (order by member_id) - amount_cents)::numeric * p_amount / e.amount_cents) as next_amount
    from public.expense_shares where expense_id=e.id
  ) scaled;
  if exists (select 1 from jsonb_array_elements(payers || shares) item where (item->>'amount')::integer < 1) then
    raise exception 'The total is too small for this split';
  end if;

  insert into public.ledger_transactions(household_id,type,source_id,reversal_of,description,created_by,posted_at)
    values(e.household_id,'expense_reversal',gen_random_uuid(),e.transaction_id,'Price correction: ' || e.title,actor,now()) returning id into reversal;
  insert into public.ledger_entries(household_id,transaction_id,member_id,household_fund,amount_cents,contribution_cents,resource_use_cents,settlement_adjustment_cents,fund_liability_cents)
    select household_id,reversal,member_id,household_fund,-amount_cents,-contribution_cents,-resource_use_cents,-settlement_adjustment_cents,-fund_liability_cents
    from public.ledger_entries where transaction_id=e.transaction_id;
  perform private.assert_balanced_transaction(reversal);

  insert into public.ledger_transactions(household_id,type,source_id,description,created_by,posted_at)
    values(e.household_id,'expense',gen_random_uuid(),'Corrected total: ' || e.title,actor,now()) returning id into replacement;
  update public.expense_payers p set amount_cents=(item->>'amount')::integer
    from jsonb_array_elements(payers) item where p.expense_id=e.id and p.member_id=(item->>'member_id')::uuid;
  update public.expense_shares s set amount_cents=(item->>'amount')::integer
    from jsonb_array_elements(shares) item where s.expense_id=e.id and s.member_id=(item->>'member_id')::uuid;
  insert into public.ledger_entries(household_id,transaction_id,member_id,amount_cents,contribution_cents)
    select e.household_id,replacement,member_id,amount_cents,amount_cents from public.expense_payers where expense_id=e.id;
  insert into public.ledger_entries(household_id,transaction_id,member_id,amount_cents,resource_use_cents)
    select e.household_id,replacement,member_id,-amount_cents,amount_cents from public.expense_shares where expense_id=e.id;
  perform private.assert_balanced_transaction(replacement);
  update public.expenses set amount_cents=p_amount,transaction_id=replacement where id=e.id;
end $$;
revoke all on function private.update_expense_amount_impl(uuid,integer,integer) from public;
grant execute on function private.update_expense_amount_impl(uuid,integer,integer) to authenticated;
create or replace function public.update_expense_amount(p_expense_id uuid, p_amount integer, p_expected integer)
returns void language sql security invoker set search_path = '' as $$ select private.update_expense_amount_impl(p_expense_id,p_amount,p_expected) $$;
revoke all on function public.update_expense_amount(uuid,integer,integer) from public,anon;
grant execute on function public.update_expense_amount(uuid,integer,integer) to authenticated;

-- An unconfigured test database stays idle and never contacts production.
create or replace function private.dispatch_scheduled_push()
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  dispatch_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name='project_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name='dispatch_secret';
  if project_url is null or dispatch_secret is null then
    raise warning 'Push scheduler needs project_url and dispatch_secret in Vault';
    return null;
  end if;
  return net.http_post(url := project_url || '/functions/v1/push-dispatch',
    headers := jsonb_build_object('Content-Type','application/json','X-Dispatch-Secret',dispatch_secret),
    body := '{}'::jsonb, timeout_milliseconds := 10000);
end $$;
revoke all on function private.dispatch_scheduled_push() from public,anon,authenticated;
select cron.schedule('howsehowld-dispatch-web-push','* * * * *','select private.dispatch_scheduled_push()');
