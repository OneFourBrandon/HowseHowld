create or replace function private.create_one_off_occurrence()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
  v_timezone text;
  v_occurrence uuid;
  v_due timestamptz;
begin
  if new.position <> 0 then return new; end if;
  select * into v_task from public.task_definitions where id = new.task_id;
  if v_task.assignment_mode <> 'one_off' then return new; end if;
  select timezone into v_timezone from public.households where id = v_task.household_id;
  v_due := (v_task.starts_on + v_task.due_time) at time zone v_timezone;
  insert into public.task_occurrences(
    household_id, task_id, scheduled_date, assignee_member_id, due_at
  ) values (
    v_task.household_id, v_task.id, v_task.starts_on, new.member_id, v_due
  )
  on conflict (task_id, scheduled_date) do nothing
  returning id into v_occurrence;
  if v_occurrence is not null then
    insert into public.notification_outbox(
      household_id, member_id, kind, entity_type, entity_id, scheduled_at,
      title, body, deep_link, urgency
    ) values
      (
        v_task.household_id, new.member_id, 'task_assignment', 'task_occurrence',
        v_occurrence, now(), v_task.title, 'A one-time chore was assigned to you',
        '/chores', 'normal'
      ),
      (
        v_task.household_id, new.member_id, 'task_reminder', 'task_occurrence',
        v_occurrence, v_due - interval '30 minutes', 'Last call: ' || v_task.title,
        'Due in 30 minutes', '/chores', 'high'
      )
    on conflict do nothing;
  end if;
  return new;
end
$$;
revoke all on function private.create_one_off_occurrence() from public, anon, authenticated;

drop trigger if exists task_rotation_create_one_off on public.task_rotation_members;
create trigger task_rotation_create_one_off
after insert on public.task_rotation_members
for each row execute function private.create_one_off_occurrence();

create or replace function private.assign_manual_task_impl(
  p_task_id uuid,
  p_member_id uuid,
  p_scheduled_date date
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
  v_timezone text;
  v_occurrence uuid;
  v_due timestamptz;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found
    or v_task.assignment_mode <> 'manual'
    or not private.is_household_member(v_task.household_id)
  then raise exception 'Manual task not found'; end if;
  if not exists (
    select 1 from public.household_members
    where id = p_member_id and household_id = v_task.household_id and active
  ) then raise exception 'Choose an active roommate'; end if;
  if p_scheduled_date < current_date - 1 then raise exception 'Choose a current or future date'; end if;
  select timezone into v_timezone from public.households where id = v_task.household_id;
  v_due := (p_scheduled_date + v_task.due_time) at time zone v_timezone;
  insert into public.task_occurrences(
    household_id, task_id, scheduled_date, assignee_member_id, due_at
  ) values (
    v_task.household_id, v_task.id, p_scheduled_date, p_member_id, v_due
  )
  returning id into v_occurrence;
  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  ) values (
    v_task.household_id, p_member_id, 'task_assignment', 'task_occurrence',
    v_occurrence, now(), v_task.title, 'A chore was assigned to you',
    '/chores', 'normal'
  ) on conflict do nothing;
  return v_occurrence;
end
$$;
revoke all on function private.assign_manual_task_impl(uuid, uuid, date) from public, anon;
grant execute on function private.assign_manual_task_impl(uuid, uuid, date) to authenticated;

create or replace function public.assign_manual_task(
  p_task_id uuid,
  p_member_id uuid,
  p_scheduled_date date
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.assign_manual_task_impl(p_task_id, p_member_id, p_scheduled_date) $$;
revoke all on function public.assign_manual_task(uuid, uuid, date) from public, anon;
grant execute on function public.assign_manual_task(uuid, uuid, date) to authenticated;
