create or replace function private.generate_task_occurrences(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
  v_house public.households%rowtype;
  v_date date;
  v_matches boolean;
  v_assignee uuid;
  v_count integer;
  v_inserted integer := 0;
  v_due timestamptz;
  v_interval integer;
  v_month_difference integer;
  v_month_last_day integer;
begin
  for v_task in
    select * from public.task_definitions where active
  loop
    select * into v_house from public.households where id = v_task.household_id;
    v_interval := greatest(coalesce((v_task.recurrence->>'interval')::integer, 1), 1);

    for v_date in
      select generate_series(
        greatest(v_task.starts_on, (now() at time zone v_house.timezone)::date),
        least(
          coalesce(v_task.ends_on, (now() at time zone v_house.timezone)::date + p_horizon_days),
          (now() at time zone v_house.timezone)::date + p_horizon_days
        ),
        interval '1 day'
      )::date
    loop
      v_month_difference :=
        (extract(year from v_date)::integer - extract(year from v_task.starts_on)::integer) * 12
        + extract(month from v_date)::integer - extract(month from v_task.starts_on)::integer;
      v_month_last_day := extract(
        day from (date_trunc('month', v_date) + interval '1 month - 1 day')
      )::integer;

      v_matches := case coalesce(v_task.recurrence->>'frequency', 'weekly')
        when 'daily' then
          ((v_date - v_task.starts_on) % v_interval) = 0
        when 'weekly' then
          ((v_date - v_task.starts_on) / 7) % v_interval = 0
          and (
            (
              coalesce(jsonb_array_length(v_task.recurrence->'weekdays'), 0) = 0
              and extract(isodow from v_date) = extract(isodow from v_task.starts_on)
            )
            or exists (
              select 1
              from jsonb_array_elements_text(coalesce(v_task.recurrence->'weekdays', '[]'::jsonb)) weekday(value)
              where weekday.value::integer = extract(isodow from v_date)::integer
            )
          )
        when 'monthly' then
          v_month_difference % v_interval = 0
          and extract(day from v_date)::integer = least(
            extract(day from v_task.starts_on)::integer,
            v_month_last_day
          )
        when 'once' then v_date = v_task.starts_on
        else false
      end;

      if not v_matches then continue; end if;

      if v_task.assignment_mode = 'fixed' then
        v_assignee := v_task.fixed_member_id;
      elsif v_task.assignment_mode = 'rotation' then
        select count(*) into v_count
        from public.task_occurrences
        where task_id = v_task.id;

        select member_id into v_assignee
        from public.task_rotation_members
        where task_id = v_task.id and active
        order by position
        offset (
          v_count % greatest(
            (select count(*) from public.task_rotation_members where task_id = v_task.id and active),
            1
          )
        )
        limit 1;
      else
        continue;
      end if;

      if v_assignee is null then continue; end if;
      v_due := (v_date + v_task.due_time) at time zone v_house.timezone;

      insert into public.task_occurrences(
        household_id, task_id, scheduled_date, assignee_member_id, due_at
      ) values (
        v_task.household_id, v_task.id, v_date, v_assignee, v_due
      ) on conflict (task_id, scheduled_date) do nothing;

      if found then
        v_inserted := v_inserted + 1;
        insert into public.notification_outbox(
          household_id, member_id, kind, entity_type, entity_id, scheduled_at,
          title, body, deep_link, urgency
        )
        select
          v_task.household_id, v_assignee, 'task_reminder', 'task_occurrence',
          occurrence.id,
          (v_date + reminder.local_time) at time zone v_house.timezone,
          case when reminder.local_time = '23:30' then 'Last call: ' || v_task.title else v_task.title end,
          'Due by ' || to_char(v_task.due_time, 'HH12:MI AM'),
          '/chores',
          case when reminder.local_time = '23:30' then 'high' else 'normal' end
        from public.task_occurrences occurrence
        cross join lateral (
          select (value->>'value')::time as local_time
          from jsonb_array_elements(coalesce(v_task.reminder_override, v_house.default_task_reminders))
          where value->>'type' = 'local_time'
        ) reminder
        where occurrence.task_id = v_task.id
          and occurrence.scheduled_date = v_date
          and (v_date + reminder.local_time) at time zone v_house.timezone < v_due
        on conflict do nothing;
      end if;
    end loop;
  end loop;

  return v_inserted;
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
  v_timezone text;
  v_today date;
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
  if v_row.status <> 'assigned' then
    raise exception 'This task can no longer be completed';
  end if;

  select timezone into v_timezone
  from public.households
  where id = v_row.household_id;
  v_today := (now() at time zone v_timezone)::date;

  if v_today < v_row.scheduled_date then
    raise exception 'This task can only be completed on its scheduled day';
  end if;
  if v_today > v_row.scheduled_date or now() > v_row.due_at then
    raise exception 'This task has expired';
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

create or replace function private.create_task_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_task uuid;
  v_mode public.task_assignment_mode := (p_input->>'assignmentMode')::public.task_assignment_mode;
  v_fixed uuid := nullif(p_input->>'fixedMemberId', '')::uuid;
  v_rotation jsonb := coalesce(p_input->'rotationMemberIds', '[]'::jsonb);
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if char_length(trim(coalesce(p_input->>'title', ''))) < 2 then
    raise exception 'Give the chore a name';
  end if;
  if v_mode = 'rotation' and jsonb_array_length(v_rotation) = 0 then
    raise exception 'A rotating task needs at least one roommate';
  end if;
  if v_mode = 'fixed' and not exists (
    select 1 from public.household_members
    where id = v_fixed and household_id = v_household and active
  ) then raise exception 'Choose an active fixed assignee'; end if;
  if exists (
    select 1
    from jsonb_array_elements_text(v_rotation) rotation_member
    left join public.household_members household_member
      on household_member.id = rotation_member.value::uuid
      and household_member.household_id = v_household
      and household_member.active
    where household_member.id is null
  ) then raise exception 'Rotation contains an invalid roommate'; end if;

  insert into public.task_definitions(
    household_id, title, description, area, assignment_mode, fixed_member_id,
    recurrence, starts_on, ends_on, due_time, reminder_override,
    penalty_enabled, created_by
  ) values (
    v_household,
    trim(p_input->>'title'),
    nullif(trim(p_input->>'description'), ''),
    coalesce(nullif(trim(p_input->>'area'), ''), 'House'),
    v_mode,
    case when v_mode = 'fixed' then v_fixed else null end,
    coalesce(p_input->'recurrence', '{"frequency":"weekly","interval":1}'::jsonb),
    coalesce(nullif(p_input->>'startsOn', '')::date, current_date),
    nullif(p_input->>'endsOn', '')::date,
    coalesce(nullif(p_input->>'dueTime', '')::time, '23:59'::time),
    case
      when p_input ? 'reminderTimes' then (
        select jsonb_agg(jsonb_build_object('type', 'local_time', 'value', value))
        from jsonb_array_elements_text(p_input->'reminderTimes')
      )
      else p_input->'reminderOverride'
    end,
    coalesce((p_input->>'penaltyEnabled')::boolean, true),
    v_member
  ) returning id into v_task;

  insert into public.task_rotation_members(task_id, household_id, member_id, position)
  select v_task, v_household, value::text::uuid, ordinality - 1
  from jsonb_array_elements_text(v_rotation) with ordinality;

  perform private.generate_task_occurrences(30);
  return v_task;
end
$$;

revoke all on function private.generate_task_occurrences(integer) from public, anon, authenticated;
revoke all on function private.complete_task_occurrence_impl(uuid) from public, anon;
grant execute on function private.complete_task_occurrence_impl(uuid) to authenticated;
revoke all on function private.create_task_impl(jsonb) from public, anon;
grant execute on function private.create_task_impl(jsonb) to authenticated;

-- Backfill every active non-queue recurrence immediately so the app does not
-- have to wait for the next cron tick after this migration is deployed.
select private.generate_task_occurrences(30);
