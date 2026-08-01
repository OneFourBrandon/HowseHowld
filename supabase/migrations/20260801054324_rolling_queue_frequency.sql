-- Keep queue tasks out of the normal daily occurrence generator. The
-- dedicated recurrence value is already treated as non-matching by that
-- generator and is materialized only by ensure_rolling_queue_occurrences.

alter table public.task_definitions
  drop constraint if exists task_rolling_queue_requires_rotation;

alter table public.task_definitions
  add constraint task_rolling_queue_requires_rotation
  check (
    coalesce(recurrence->>'frequency', '') <> 'rolling_queue'
    or assignment_mode = 'rotation'
  );

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
  v_winner public.task_definitions%rowtype;
  v_queue_count integer;
  v_queue_start date;
  v_queue_offset integer;
  v_rotation_count integer;
  v_assignee uuid;
  v_due timestamptz;
  v_horizon integer := greatest(0, least(coalesce(p_horizon_days, 30), 90));
  v_inserted integer := 0;
begin
  if not private.is_household_member(p_household_id) then
    raise exception 'Household membership required';
  end if;

  select * into v_house
  from public.households
  where id = p_household_id;

  if not found then
    raise exception 'Household not found';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_household_id::text, 0));

  for v_date in
    select generate_series(
      (now() at time zone v_house.timezone)::date,
      (now() at time zone v_house.timezone)::date + v_horizon,
      interval '1 day'
    )::date
  loop
    select count(*)::integer, min(candidate.starts_on)
    into v_queue_count, v_queue_start
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

    v_queue_offset := greatest(v_date - v_queue_start, 0) % v_queue_count;

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
    if coalesce(v_rotation_count, 0) = 0 then continue; end if;

    select member_id into v_assignee
    from public.task_rotation_members
    where task_id = v_winner.id and active
    order by position
    offset (
      (select count(*) from public.task_occurrences where task_id = v_winner.id)
      % v_rotation_count
    )
    limit 1;
    if v_assignee is null then continue; end if;

    v_due := (v_date + v_winner.due_time) at time zone v_house.timezone;
    insert into public.task_occurrences(
      household_id, task_id, scheduled_date, assignee_member_id, due_at
    ) values (
      p_household_id, v_winner.id, v_date, v_assignee, v_due
    ) on conflict (task_id, scheduled_date) do nothing;

    if found then
      v_inserted := v_inserted + 1;
      insert into public.notification_outbox(
        household_id, member_id, kind, entity_type, entity_id, scheduled_at,
        title, body, deep_link, urgency
      )
      select
        p_household_id, v_assignee, 'task_reminder', 'task_occurrence', occurrence.id,
        (v_date + reminder.local_time) at time zone v_house.timezone,
        case when reminder.local_time = '23:30' then 'Last call: ' || v_winner.title else v_winner.title end,
        'Due by ' || to_char(v_winner.due_time, 'HH12:MI AM'),
        '/chores',
        case when reminder.local_time = '23:30' then 'high' else 'normal' end
      from public.task_occurrences occurrence
      cross join lateral (
        select (value->>'value')::time as local_time
        from jsonb_array_elements(coalesce(v_winner.reminder_override, v_house.default_task_reminders))
        where value->>'type' = 'local_time'
      ) reminder
      where occurrence.task_id = v_winner.id
        and occurrence.scheduled_date = v_date
        and (v_date + reminder.local_time) at time zone v_house.timezone < v_due
      on conflict do nothing;
    end if;
  end loop;

  return v_inserted;
end
$$;
