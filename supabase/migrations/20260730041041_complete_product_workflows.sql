-- Complete the workflows that were initially represented only in the client.
-- All browser-facing mutations remain authenticated and household-scoped.

create or replace function private.update_task_impl(p_task_id uuid, p_input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
  v_mode public.task_assignment_mode;
  v_fixed uuid;
  v_rotation jsonb;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found or not private.is_household_member(v_task.household_id) then
    raise exception 'Task not found';
  end if;

  v_mode := coalesce(
    nullif(p_input->>'assignmentMode', '')::public.task_assignment_mode,
    v_task.assignment_mode
  );
  v_fixed := case
    when p_input ? 'fixedMemberId' then nullif(p_input->>'fixedMemberId', '')::uuid
    else v_task.fixed_member_id
  end;
  if v_mode = 'fixed' and not exists (
    select 1 from public.household_members
    where id = v_fixed and household_id = v_task.household_id and active
  ) then
    raise exception 'Choose an active fixed assignee';
  end if;

  update public.task_definitions set
    title = coalesce(nullif(trim(p_input->>'title'), ''), title),
    description = case when p_input ? 'description' then nullif(trim(p_input->>'description'), '') else description end,
    area = coalesce(nullif(trim(p_input->>'area'), ''), area),
    assignment_mode = v_mode,
    fixed_member_id = case when v_mode = 'fixed' then v_fixed else null end,
    starts_on = coalesce(nullif(p_input->>'startsOn', '')::date, starts_on),
    ends_on = case when p_input ? 'endsOn' then nullif(p_input->>'endsOn', '')::date else ends_on end,
    due_time = coalesce(nullif(p_input->>'dueTime', '')::time, due_time),
    recurrence = coalesce(p_input->'recurrence', recurrence),
    reminder_override = case when p_input ? 'reminderOverride' then p_input->'reminderOverride' else reminder_override end,
    penalty_enabled = coalesce((p_input->>'penaltyEnabled')::boolean, penalty_enabled),
    active = coalesce((p_input->>'active')::boolean, active),
    updated_at = now()
  where id = p_task_id;

  if p_input ? 'rotationMemberIds' then
    v_rotation := coalesce(p_input->'rotationMemberIds', '[]'::jsonb);
    if v_mode = 'rotation' and jsonb_array_length(v_rotation) = 0 then
      raise exception 'A rotating task needs at least one roommate';
    end if;
    if exists (
      select 1
      from jsonb_array_elements_text(v_rotation) r
      left join public.household_members hm
        on hm.id = r.value::uuid
       and hm.household_id = v_task.household_id
       and hm.active
      where hm.id is null
    ) then
      raise exception 'Rotation contains an invalid roommate';
    end if;
    delete from public.task_rotation_members where task_id = p_task_id;
    insert into public.task_rotation_members(task_id, household_id, member_id, position)
    select p_task_id, v_task.household_id, value::text::uuid, ordinality - 1
    from jsonb_array_elements_text(v_rotation) with ordinality;
  end if;
end
$$;
revoke all on function private.update_task_impl(uuid, jsonb) from public, anon;
grant execute on function private.update_task_impl(uuid, jsonb) to authenticated;

create or replace function private.attach_expense_receipt_impl(
  p_expense_id uuid,
  p_receipt_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
begin
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found
    or private.current_member_id(v_expense.household_id) <> v_expense.created_by
    or v_expense.reversed_at is not null
  then
    raise exception 'Expense not found';
  end if;
  if split_part(p_receipt_path, '/', 1) <> v_expense.household_id::text
    or split_part(p_receipt_path, '/', 2) <> v_expense.id::text
  then
    raise exception 'Invalid receipt path';
  end if;
  update public.expenses set receipt_path = p_receipt_path where id = p_expense_id;
end
$$;
revoke all on function private.attach_expense_receipt_impl(uuid, text) from public, anon;
grant execute on function private.attach_expense_receipt_impl(uuid, text) to authenticated;

create or replace function public.attach_expense_receipt(
  p_expense_id uuid,
  p_receipt_path text
)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.attach_expense_receipt_impl(p_expense_id, p_receipt_path) $$;

create or replace function private.upsert_vehicle_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_id uuid := nullif(p_input->>'id', '')::uuid;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if char_length(trim(coalesce(p_input->>'label', ''))) < 2 then
    raise exception 'Give the vehicle a name';
  end if;

  if v_id is null then
    insert into public.vehicles(household_id, owner_member_id, label, color, plate)
    values (
      v_household, v_member, trim(p_input->>'label'),
      coalesce(nullif(p_input->>'color', ''), '#6278b5'),
      nullif(upper(trim(p_input->>'plate')), '')
    )
    returning id into v_id;
    insert into public.driveway_positions(household_id, vehicle_id, position)
    values (
      v_household,
      v_id,
      coalesce((select max(position) + 1 from public.driveway_positions where household_id = v_household), 0)
    );
    update public.driveway_state set version = version + 1, updated_by = v_member, updated_at = now()
    where household_id = v_household;
  else
    update public.vehicles set
      label = trim(p_input->>'label'),
      color = coalesce(nullif(p_input->>'color', ''), color),
      plate = nullif(upper(trim(p_input->>'plate')), '')
    where id = v_id and household_id = v_household and owner_member_id = v_member;
    if not found then raise exception 'Vehicle not found'; end if;
  end if;
  return v_id;
end
$$;
revoke all on function private.upsert_vehicle_impl(jsonb) from public, anon;
grant execute on function private.upsert_vehicle_impl(jsonb) to authenticated;

create or replace function public.upsert_vehicle(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.upsert_vehicle_impl(p_input) $$;

create or replace function private.archive_vehicle_impl(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not found
    or private.current_member_id(v_vehicle.household_id) <> v_vehicle.owner_member_id
  then raise exception 'Vehicle not found'; end if;
  update public.vehicles set active = false where id = p_vehicle_id;
  delete from public.driveway_positions where vehicle_id = p_vehicle_id;
  update public.driveway_state set version = version + 1,
    updated_by = v_vehicle.owner_member_id, updated_at = now()
  where household_id = v_vehicle.household_id;
end
$$;
revoke all on function private.archive_vehicle_impl(uuid) from public, anon;
grant execute on function private.archive_vehicle_impl(uuid) to authenticated;

create or replace function public.archive_vehicle(p_vehicle_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.archive_vehicle_impl(p_vehicle_id) $$;

create or replace function private.update_schedule_item_kind_impl(
  p_schedule_item_id uuid,
  p_kind public.schedule_item_kind
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.schedule_items%rowtype;
begin
  select * into v_item from public.schedule_items where id = p_schedule_item_id for update;
  if not found
    or private.current_member_id(v_item.household_id) <> v_item.owner_member_id
  then raise exception 'Schedule item not found'; end if;
  update public.schedule_items set kind = p_kind, updated_at = now()
  where id = p_schedule_item_id;
end
$$;
revoke all on function private.update_schedule_item_kind_impl(uuid, public.schedule_item_kind) from public, anon;
grant execute on function private.update_schedule_item_kind_impl(uuid, public.schedule_item_kind) to authenticated;

create or replace function public.update_schedule_item_kind(
  p_schedule_item_id uuid,
  p_kind public.schedule_item_kind
)
returns void language sql security invoker set search_path = ''
as $$ select private.update_schedule_item_kind_impl(p_schedule_item_id, p_kind) $$;

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
        where target.household_id = v_rule.household_id and target.vehicle_id = v_rule.vehicle_id
        group by target.position
        on conflict (rule_id, required_at) do update set
          blocker_vehicle_ids = excluded.blocker_vehicle_ids;
        if found then v_inserted := v_inserted + 1; end if;
      end if;
      exit when v_step is null;
      v_required := v_required + v_step;
    end loop;
  end loop;
  return v_inserted;
end
$$;

create or replace function private.enqueue_calendar_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select
    e.household_id, recipients.member_id, 'calendar_reminder', 'calendar_event', e.id,
    e.start_at - make_interval(mins => reminder.offset_minutes),
    e.title,
    case when e.all_day then 'All day event' else 'Starts soon' end,
    '/calendar', 'normal'
  from public.calendar_events e
  cross join lateral unnest(e.reminder_offsets) reminder(offset_minutes)
  cross join lateral (
    select hm.id as member_id
    from public.household_members hm
    where hm.household_id = e.household_id and hm.active
      and (
        e.audience = 'everyone'
        or (e.audience = 'self' and hm.id = e.creator_member_id)
        or (e.audience = 'selected' and exists (
          select 1 from public.event_audiences ea
          where ea.event_id = e.id and ea.member_id = hm.id
        ))
      )
  ) recipients
  where e.start_at between now() and now() + interval '31 days'
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
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
  -- Refresh blockers immediately before reminders enter the due window.
  update public.departure_occurrences occurrence
  set blocker_vehicle_ids = blockers.ids
  from (
    select target.vehicle_id,
      coalesce(array_agg(dp.vehicle_id order by dp.position)
        filter (where dp.position < target.position), '{}'::uuid[]) ids
    from public.driveway_positions target
    left join public.driveway_positions dp
      on dp.household_id = target.household_id and dp.position < target.position
    group by target.household_id, target.vehicle_id, target.position
  ) blockers
  where occurrence.vehicle_id = blockers.vehicle_id
    and occurrence.required_at between now() and now() + interval '2 days';

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
  where occurrence.required_at between now() and now() + interval '31 days'
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function private.process_due_work()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.task_occurrences%rowtype;
  v_infraction public.infractions%rowtype;
  v_prior integer;
  v_missed integer := 0;
  v_finalized integer := 0;
  v_departures integer := 0;
  v_calendar_notifications integer := 0;
  v_driveway_notifications integer := 0;
begin
  perform private.generate_task_occurrences(30);
  v_departures := private.generate_departure_occurrences(30);
  v_calendar_notifications := private.enqueue_calendar_reminders();
  v_driveway_notifications := private.enqueue_departure_reminders();
  for v_occurrence in
    select * from public.task_occurrences
    where status = 'assigned' and due_at < now()
    for update skip locked
  loop
    update public.task_occurrences set status = 'missed' where id = v_occurrence.id;
    select count(*) into v_prior
    from public.infractions
    where member_id = v_occurrence.assignee_member_id
      and status in ('upheld', 'paid')
      and created_at >= v_occurrence.due_at - interval '30 days'
      and created_at < v_occurrence.due_at;
    insert into public.infractions(
      household_id, occurrence_id, member_id, amount_cents, dispute_deadline
    ) values (
      v_occurrence.household_id, v_occurrence.id, v_occurrence.assignee_member_id,
      least(1000 + (v_prior * 500), 3000),
      v_occurrence.due_at + interval '24 hours'
    ) on conflict (occurrence_id) do nothing;
    update public.notification_outbox set status = 'cancelled'
    where entity_id = v_occurrence.id and status = 'pending';
    v_missed := v_missed + 1;
  end loop;
  for v_infraction in
    select * from public.infractions
    where status in ('pending', 'disputed', 'upheld')
      and dispute_deadline < now()
      and ledger_transaction_id is null
    for update skip locked
  loop
    perform private.post_penalty(v_infraction.id);
    v_finalized := v_finalized + 1;
  end loop;
  return jsonb_build_object(
    'missed', v_missed,
    'finalized', v_finalized,
    'departures', v_departures,
    'calendar_notifications', v_calendar_notifications,
    'driveway_notifications', v_driveway_notifications
  );
end
$$;

revoke all on function private.generate_departure_occurrences(integer) from public, anon, authenticated;
revoke all on function private.enqueue_calendar_reminders() from public, anon, authenticated;
revoke all on function private.enqueue_departure_reminders() from public, anon, authenticated;
grant execute on function private.generate_departure_occurrences(integer) to service_role;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.attach_expense_receipt(uuid, text) to authenticated;
grant execute on function public.upsert_vehicle(jsonb) to authenticated;
grant execute on function public.archive_vehicle(uuid) to authenticated;
grant execute on function public.update_schedule_item_kind(uuid, public.schedule_item_kind) to authenticated;

-- Small-house Postgres Changes is appropriate here. RLS still authorizes every
-- delivered row; the client additionally filters each table by household_id.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'task_definitions','task_occurrences','infractions','infraction_votes',
    'expenses','expense_payers','expense_shares','settlements','fund_payments',
    'calendar_events','event_audiences','courses','schedule_items',
    'vehicles','driveway_state','driveway_positions','departure_occurrences',
    'push_subscriptions'
  ]
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    exception when duplicate_object then
      null;
    end;
  end loop;
end
$$;
