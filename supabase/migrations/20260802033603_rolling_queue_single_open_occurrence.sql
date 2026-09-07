-- A rolling queue exposes exactly one assigned occurrence per household. The
-- next queue item is created only after the current item completes or misses.

with duplicate_occurrences as (
  select occurrence.id
  from (
    select
      occurrence.id,
      row_number() over (
        partition by occurrence.household_id
        order by occurrence.scheduled_date, occurrence.due_at, occurrence.id
      ) as queue_position
    from public.task_occurrences occurrence
    join public.task_definitions task on task.id = occurrence.task_id
    where occurrence.status = 'assigned'
      and task.recurrence->>'frequency' = 'rolling_queue'
  ) occurrence
  where occurrence.queue_position > 1
)
delete from public.notification_outbox notification
where notification.entity_type = 'task_occurrence'
  and notification.entity_id in (select id from duplicate_occurrences);

with duplicate_occurrences as (
  select occurrence.id
  from (
    select
      occurrence.id,
      row_number() over (
        partition by occurrence.household_id
        order by occurrence.scheduled_date, occurrence.due_at, occurrence.id
      ) as queue_position
    from public.task_occurrences occurrence
    join public.task_definitions task on task.id = occurrence.task_id
    where occurrence.status = 'assigned'
      and task.recurrence->>'frequency' = 'rolling_queue'
  ) occurrence
  where occurrence.queue_position > 1
)
delete from public.task_occurrences occurrence
where occurrence.id in (select id from duplicate_occurrences);

create or replace function private.ensure_rolling_queue_occurrences_impl(
  p_household_id uuid,
  p_horizon_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_house public.households%rowtype;
  v_date date;
  v_start_date date;
  v_winner public.task_definitions%rowtype;
  v_queue_count integer;
  v_queue_offset integer;
  v_rotation_count integer;
  v_assignee uuid;
  v_due timestamptz;
  v_occurrence_id uuid;
  v_horizon integer := greatest(1, least(coalesce(p_horizon_days, 30), 90));
begin
  -- Calls from authenticated RPCs retain auth.uid(). Internal cron calls do
  -- not, and this private function is not executable by public/anon users.
  if (select auth.uid()) is not null
    and not private.is_household_member(p_household_id)
  then
    raise exception 'Household membership required';
  end if;

  select * into v_house
  from public.households
  where id = p_household_id;

  if not found then
    raise exception 'Household not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  if exists (
    select 1
    from public.task_occurrences occurrence
    join public.task_definitions task on task.id = occurrence.task_id
    where occurrence.household_id = p_household_id
      and occurrence.status = 'assigned'
      and task.recurrence->>'frequency' = 'rolling_queue'
  ) then
    return 0;
  end if;

  select greatest(
    (now() at time zone v_house.timezone)::date,
    coalesce(max(occurrence.scheduled_date) + 1, (now() at time zone v_house.timezone)::date)
  )
  into v_start_date
  from public.task_occurrences occurrence
  join public.task_definitions task on task.id = occurrence.task_id
  where occurrence.household_id = p_household_id
    and task.recurrence->>'frequency' = 'rolling_queue';

  for v_date in
    select generate_series(v_start_date, v_start_date + v_horizon, interval '1 day')::date
  loop
    select count(*)::integer
    into v_queue_count
    from public.task_definitions candidate
    where candidate.household_id = p_household_id
      and candidate.active
      and candidate.assignment_mode = 'rotation'
      and candidate.recurrence->>'frequency' = 'rolling_queue'
      and candidate.starts_on <= v_date
      and (candidate.ends_on is null or candidate.ends_on >= v_date);

    if coalesce(v_queue_count, 0) = 0 then
      continue;
    end if;

    select count(*)::integer % v_queue_count
    into v_queue_offset
    from public.task_occurrences occurrence
    join public.task_definitions task on task.id = occurrence.task_id
    where occurrence.household_id = p_household_id
      and task.recurrence->>'frequency' = 'rolling_queue';

    select candidate.* into v_winner
    from public.task_definitions candidate
    where candidate.household_id = p_household_id
      and candidate.active
      and candidate.assignment_mode = 'rotation'
      and candidate.recurrence->>'frequency' = 'rolling_queue'
      and candidate.starts_on <= v_date
      and (candidate.ends_on is null or candidate.ends_on >= v_date)
    order by candidate.starts_on, candidate.id
    offset v_queue_offset
    limit 1;

    select count(*)::integer into v_rotation_count
    from public.task_rotation_members
    where task_id = v_winner.id and active;

    if coalesce(v_rotation_count, 0) = 0 then
      continue;
    end if;

    select member_id into v_assignee
    from public.task_rotation_members
    where task_id = v_winner.id and active
    order by position
    offset (
      (select count(*) from public.task_occurrences where task_id = v_winner.id)
      % v_rotation_count
    )
    limit 1;

    if v_assignee is null then
      continue;
    end if;

    v_due := (v_date + v_winner.due_time) at time zone v_house.timezone;
    if v_due <= now() then
      continue;
    end if;

    v_occurrence_id := null;
    insert into public.task_occurrences(
      household_id, task_id, scheduled_date, assignee_member_id, due_at
    ) values (
      p_household_id, v_winner.id, v_date, v_assignee, v_due
    )
    on conflict (task_id, scheduled_date) do nothing
    returning id into v_occurrence_id;

    if v_occurrence_id is null then
      continue;
    end if;

    insert into public.notification_outbox(
      household_id, member_id, kind, entity_type, entity_id, scheduled_at,
      title, body, deep_link, urgency
    )
    select
      p_household_id, v_assignee, 'task_reminder', 'task_occurrence', v_occurrence_id,
      (v_date + reminder.local_time) at time zone v_house.timezone,
      case when reminder.local_time = '23:30' then 'Last call: ' || v_winner.title else v_winner.title end,
      'Due by ' || to_char(v_winner.due_time, 'HH12:MI AM'),
      '/chores',
      case when reminder.local_time = '23:30' then 'high' else 'normal' end
    from (
      select (value->>'value')::time as local_time
      from jsonb_array_elements(coalesce(v_winner.reminder_override, v_house.default_task_reminders))
      where value->>'type' = 'local_time'
    ) reminder
    where (v_date + reminder.local_time) at time zone v_house.timezone < v_due
    on conflict do nothing;

    return 1;
  end loop;

  return 0;
end
$$;

create or replace function private.complete_task_occurrence_impl(p_occurrence_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.task_occurrences%rowtype;
  v_member uuid;
  v_is_rolling_queue boolean;
begin
  select * into v_row
  from public.task_occurrences
  where id = p_occurrence_id
  for update;

  if not found then raise exception 'Occurrence not found'; end if;

  v_member := private.current_member_id(v_row.household_id);
  if v_member is null or v_member <> v_row.assignee_member_id then
    raise exception 'Only the assignee can complete this task';
  end if;
  if v_row.status <> 'assigned' or now() > v_row.due_at then
    raise exception 'This task can no longer be completed';
  end if;

  select task.recurrence->>'frequency' = 'rolling_queue'
  into v_is_rolling_queue
  from public.task_definitions task
  where task.id = v_row.task_id;

  update public.task_occurrences
  set status = 'completed', completed_at = now(), completed_by = v_member
  where id = p_occurrence_id
  returning * into v_row;

  update public.notification_outbox
  set status = 'cancelled'
  where entity_id = p_occurrence_id and status = 'pending';

  if coalesce(v_is_rolling_queue, false) then
    perform private.ensure_rolling_queue_occurrences_impl(v_row.household_id, 30);
  end if;

  return v_row;
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
  v_household_id uuid;
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

  -- This also creates the first item for a newly configured queue and advances
  -- queues whose previous item was marked missed above.
  for v_household_id in
    select distinct task.household_id
    from public.task_definitions task
    where task.active and task.recurrence->>'frequency' = 'rolling_queue'
  loop
    perform private.ensure_rolling_queue_occurrences_impl(v_household_id, 30);
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
