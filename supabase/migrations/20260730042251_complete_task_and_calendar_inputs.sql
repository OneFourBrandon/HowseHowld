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
    from jsonb_array_elements_text(v_rotation) r
    left join public.household_members hm
      on hm.id = r.value::uuid and hm.household_id = v_household and hm.active
    where hm.id is null
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
  return v_task;
end
$$;
revoke all on function private.create_task_impl(jsonb) from public, anon;
grant execute on function private.create_task_impl(jsonb) to authenticated;

create or replace function private.upsert_calendar_event_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_id uuid := coalesce(nullif(p_input->>'id', '')::uuid, gen_random_uuid());
  v_audience public.event_audience :=
    coalesce((p_input->>'audience')::public.event_audience, 'everyone');
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if v_audience = 'selected' and jsonb_array_length(
    coalesce(p_input->'audienceMemberIds', '[]'::jsonb)
  ) = 0 then raise exception 'Choose at least one roommate'; end if;

  insert into public.calendar_events(
    id, household_id, title, description, start_at, end_at, all_day,
    timezone, location, recurrence, audience, creator_member_id, reminder_offsets
  ) values (
    v_id, v_household, trim(p_input->>'title'), nullif(p_input->>'description', ''),
    (p_input->>'startAt')::timestamptz, (p_input->>'endAt')::timestamptz,
    coalesce((p_input->>'allDay')::boolean, false),
    coalesce(nullif(p_input->>'timezone', ''), 'America/Toronto'),
    nullif(p_input->>'location', ''),
    p_input->'recurrence',
    v_audience,
    v_member,
    coalesce(
      array(select jsonb_array_elements_text(p_input->'reminderOffsets')::integer),
      array[1440,60]
    )
  )
  on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    start_at = excluded.start_at,
    end_at = excluded.end_at,
    all_day = excluded.all_day,
    timezone = excluded.timezone,
    location = excluded.location,
    recurrence = excluded.recurrence,
    audience = excluded.audience,
    reminder_offsets = excluded.reminder_offsets,
    updated_at = now()
  where public.calendar_events.creator_member_id = v_member;

  delete from public.event_audiences where event_id = v_id;
  insert into public.event_audiences(event_id, household_id, member_id)
  select v_id, v_household, value::text::uuid
  from jsonb_array_elements_text(coalesce(p_input->'audienceMemberIds', '[]'::jsonb)) selected
  where exists (
    select 1 from public.household_members hm
    where hm.id = selected.value::uuid and hm.household_id = v_household and hm.active
  );
  return v_id;
end
$$;
revoke all on function private.upsert_calendar_event_impl(jsonb) from public, anon;
grant execute on function private.upsert_calendar_event_impl(jsonb) to authenticated;
