create or replace function private.update_household_task_reminders_impl(
  p_household_id uuid,
  p_local_times time[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only the howse owner can change household defaults';
  end if;
  if cardinality(p_local_times) > 8 then raise exception 'Too many reminder times'; end if;
  update public.households
  set default_task_reminders = coalesce((
    select jsonb_agg(jsonb_build_object('type', 'local_time', 'value', value::text) order by value)
    from unnest(p_local_times) value
  ), '[]'::jsonb),
  updated_at = now()
  where id = p_household_id;
end
$$;
revoke all on function private.update_household_task_reminders_impl(uuid, time[]) from public, anon;
grant execute on function private.update_household_task_reminders_impl(uuid, time[]) to authenticated;

create or replace function public.update_household_task_reminders(
  p_household_id uuid,
  p_local_times time[]
)
returns void language sql security invoker set search_path = ''
as $$ select private.update_household_task_reminders_impl(p_household_id, p_local_times) $$;
revoke all on function public.update_household_task_reminders(uuid, time[]) from public, anon;
grant execute on function public.update_household_task_reminders(uuid, time[]) to authenticated;

create or replace function private.update_course_impl(
  p_course_id uuid,
  p_name text,
  p_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_course public.courses%rowtype;
begin
  select * into v_course from public.courses where id = p_course_id for update;
  if not found
    or private.current_member_id(v_course.household_id) <> v_course.owner_member_id
  then raise exception 'Course not found'; end if;
  if char_length(trim(p_name)) < 2 then raise exception 'Give the course a name'; end if;
  if p_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Invalid course color'; end if;
  update public.courses set name = trim(p_name), color = lower(p_color)
  where id = p_course_id;
end
$$;
revoke all on function private.update_course_impl(uuid, text, text) from public, anon;
grant execute on function private.update_course_impl(uuid, text, text) to authenticated;

create or replace function public.update_course(
  p_course_id uuid,
  p_name text,
  p_color text
)
returns void language sql security invoker set search_path = ''
as $$ select private.update_course_impl(p_course_id, p_name, p_color) $$;
revoke all on function public.update_course(uuid, text, text) from public, anon;
grant execute on function public.update_course(uuid, text, text) to authenticated;
