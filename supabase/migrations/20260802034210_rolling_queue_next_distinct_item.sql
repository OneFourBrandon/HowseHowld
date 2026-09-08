-- Keep a two-item rolling window: the current item and one distinct next item.
-- A single chore definition may never appear twice in that window.

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
  v_open_count integer;
  v_rotation_count integer;
  v_assignee uuid;
  v_due timestamptz;
  v_occurrence_id uuid;
  v_horizon integer := greatest(1, least(coalesce(p_horizon_days, 30), 90));
begin
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

  select count(*)::integer into v_open_count
  from public.task_occurrences occurrence
  join public.task_definitions task on task.id = occurrence.task_id
  where occurrence.household_id = p_household_id
    and occurrence.status = 'assigned'
    and task.recurrence->>'frequency' = 'rolling_queue';

  if v_open_count >= 2 then
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
    select candidate.* into v_winner
    from public.task_definitions candidate
    where candidate.household_id = p_household_id
      and candidate.active
      and candidate.assignment_mode = 'rotation'
      and candidate.recurrence->>'frequency' = 'rolling_queue'
      and candidate.starts_on <= v_date
      and (candidate.ends_on is null or candidate.ends_on >= v_date)
      and not exists (
        select 1
        from public.task_occurrences open_occurrence
        where open_occurrence.task_id = candidate.id
          and open_occurrence.status = 'assigned'
      )
    order by
      (select count(*) from public.task_occurrences history where history.task_id = candidate.id),
      candidate.starts_on,
      candidate.id
    limit 1;

    if not found then
      continue;
    end if;

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
