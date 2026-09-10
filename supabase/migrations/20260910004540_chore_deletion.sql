alter table public.task_definitions add column deleted_at timestamptz;
alter table public.task_definitions add constraint deleted_tasks_inactive check (deleted_at is null or not active);

create or replace function private.delete_task_impl(p_task_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.task_definitions%rowtype;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found or private.current_member_id(v_task.household_id) is null then
    raise exception 'Chore not found';
  end if;
  update public.task_definitions set active = false, deleted_at = coalesce(deleted_at, now()) where id = p_task_id;
  update public.notification_outbox set status = 'cancelled'
  where entity_type = 'task_occurrence' and status in ('pending', 'processing')
    and entity_id in (select id from public.task_occurrences where task_id = p_task_id and status = 'assigned');
  delete from public.task_occurrences o where o.task_id = p_task_id and o.status = 'assigned'
    and not exists (select 1 from public.infractions i where i.occurrence_id = o.id);
end;
$$;
revoke all on function private.delete_task_impl(uuid) from public, anon;
grant execute on function private.delete_task_impl(uuid) to authenticated;
create or replace function public.delete_task(p_task_id uuid)
returns void language sql security invoker set search_path = '' as $$ select private.delete_task_impl(p_task_id) $$;
revoke all on function public.delete_task(uuid) from public, anon;
grant execute on function public.delete_task(uuid) to authenticated;
