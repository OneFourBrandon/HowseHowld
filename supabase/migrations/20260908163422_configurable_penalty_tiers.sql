-- Existing households keep their current $10/$15/$20/$25/$30 schedule.
create or replace function private.valid_penalty_tiers(p_tiers integer[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    array_ndims(p_tiers) = 1 and array_lower(p_tiers, 1) = 1
    and cardinality(p_tiers) between 1 and 20
    and not exists (
      select 1 from unnest(p_tiers) with ordinality as tier(amount, position)
      where amount is null or amount < 1 or amount > 1000000
        or (position > 1 and amount < p_tiers[position::integer - 1])
    ), false);
$$;
revoke all on function private.valid_penalty_tiers(integer[]) from public, anon;
grant execute on function private.valid_penalty_tiers(integer[]) to authenticated, service_role;

alter table public.households add column penalty_tiers integer[] not null
  default array[1000,1500,2000,2500,3000]
  constraint households_valid_penalty_tiers check (private.valid_penalty_tiers(penalty_tiers));

-- Amounts are snapshotted when an infraction is created; existing rows stay unchanged.
alter table public.infractions drop constraint infractions_amount_cents_check;
alter table public.infractions add constraint infractions_amount_cents_check
  check (amount_cents between 0 and 1000000);

create or replace function private.update_penalty_tiers_impl(p_household_id uuid, p_tiers integer[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.household_members
    where id = private.current_member_id(p_household_id)
      and household_id = p_household_id and active and role = 'owner'
  ) then raise exception 'Only the admin can change penalty tiers.'; end if;
  if not private.valid_penalty_tiers(p_tiers) then
    raise exception 'Choose 1 to 20 increasing penalty tiers between $0.01 and $10,000.00.';
  end if;
  update public.households set penalty_tiers = p_tiers where id = p_household_id;
end;
$$;
revoke all on function private.update_penalty_tiers_impl(uuid,integer[]) from public, anon;
grant execute on function private.update_penalty_tiers_impl(uuid,integer[]) to authenticated;
create or replace function public.update_penalty_tiers(p_household_id uuid, p_tiers integer[])
returns void language sql security invoker set search_path = '' as $$
  select private.update_penalty_tiers_impl(p_household_id,p_tiers);
$$;
revoke all on function public.update_penalty_tiers(uuid,integer[]) from public, anon;
grant execute on function public.update_penalty_tiers(uuid,integer[]) to authenticated;

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
  v_tiers integer[];
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
    select penalty_tiers into v_tiers from public.households where id = v_occurrence.household_id;
    insert into public.infractions(
      household_id, occurrence_id, member_id, amount_cents, dispute_deadline
    ) values (
      v_occurrence.household_id, v_occurrence.id, v_occurrence.assignee_member_id,
      v_tiers[least(v_prior + 1, cardinality(v_tiers))],
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
