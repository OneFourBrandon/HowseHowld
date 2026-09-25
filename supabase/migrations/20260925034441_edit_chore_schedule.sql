-- Rebuild only open assignments when an owner changes a chore's schedule.
-- Completed/missed occurrences and their financial history stay intact.
create or replace function private.update_task_impl(p_task_id uuid, p_input jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.task_definitions%rowtype;
  v_mode public.task_assignment_mode;
  v_fixed uuid;
  v_rotation jsonb;
  v_recurrence jsonb;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found or v_task.deleted_at is not null then
    raise exception 'Task not found';
  end if;
  if not private.is_household_owner(v_task.household_id) then
    raise exception 'Only the household admin can edit chores';
  end if;

  v_mode := coalesce(nullif(p_input->>'assignmentMode', '')::public.task_assignment_mode, v_task.assignment_mode);
  v_fixed := case when p_input ? 'fixedMemberId' then nullif(p_input->>'fixedMemberId', '')::uuid else v_task.fixed_member_id end;
  if v_mode in ('fixed', 'manual', 'one_off') and v_fixed is not null and not exists (
    select 1 from public.household_members where id = v_fixed and household_id = v_task.household_id and active
  ) then raise exception 'Choose an active assignee'; end if;
  if v_mode = 'fixed' and v_fixed is null then raise exception 'Choose an active fixed assignee'; end if;

  v_recurrence := coalesce(p_input->'recurrence', v_task.recurrence);
  if v_recurrence->>'frequency' not in ('daily', 'weekly', 'monthly', 'once', 'rolling_queue')
    or coalesce((v_recurrence->>'interval')::integer, 0) not between 1 and 30
    or (v_recurrence->>'frequency' = 'rolling_queue' and v_mode <> 'rotation')
  then raise exception 'Invalid chore schedule'; end if;
  if v_recurrence->>'frequency' = 'weekly' and jsonb_array_length(coalesce(v_recurrence->'weekdays', '[]'::jsonb)) = 0 then
    raise exception 'Choose at least one weekday';
  end if;

  if p_input ?| array['startsOn', 'endsOn', 'dueTime', 'recurrence', 'assignmentMode', 'fixedMemberId', 'rotationMemberIds', 'reminderOverride', 'active'] then
    update public.notification_outbox set status = 'cancelled'
    where entity_type = 'task_occurrence' and status in ('pending', 'processing')
      and entity_id in (select id from public.task_occurrences where task_id = p_task_id and status = 'assigned');
    delete from public.task_occurrences o where o.task_id = p_task_id and o.status = 'assigned'
      and not exists (select 1 from public.infractions i where i.occurrence_id = o.id);
  end if;

  update public.task_definitions set
    title = coalesce(nullif(trim(p_input->>'title'), ''), title),
    description = case when p_input ? 'description' then nullif(trim(p_input->>'description'), '') else description end,
    area = coalesce(nullif(trim(p_input->>'area'), ''), area),
    assignment_mode = v_mode,
    fixed_member_id = case when v_mode in ('fixed', 'manual', 'one_off') then v_fixed else null end,
    starts_on = coalesce(nullif(p_input->>'startsOn', '')::date, starts_on),
    ends_on = case when p_input ? 'endsOn' then nullif(p_input->>'endsOn', '')::date else ends_on end,
    due_time = coalesce(nullif(p_input->>'dueTime', '')::time, due_time),
    recurrence = v_recurrence,
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
      select 1 from jsonb_array_elements_text(v_rotation) r
      left join public.household_members hm on hm.id = r.value::uuid and hm.household_id = v_task.household_id and hm.active
      where hm.id is null
    ) then raise exception 'Rotation contains an invalid roommate'; end if;
    delete from public.task_rotation_members where task_id = p_task_id;
    insert into public.task_rotation_members(task_id, household_id, member_id, position)
    select p_task_id, v_task.household_id, value::text::uuid, ordinality - 1
    from jsonb_array_elements_text(v_rotation) with ordinality;
  end if;

  if p_input ?| array['startsOn', 'endsOn', 'dueTime', 'recurrence', 'assignmentMode', 'fixedMemberId', 'rotationMemberIds', 'reminderOverride', 'active'] then
    perform private.generate_task_occurrences(30);
    perform private.ensure_rolling_queue_occurrences_impl(v_task.household_id, 30);
  end if;
end;
$$;

drop policy task_definitions_member_update on public.task_definitions;
create policy task_definitions_owner_update on public.task_definitions for update to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));
