-- Allow affected members to participate in their household's review.
create or replace function private.cast_infraction_vote_impl(
  p_infraction_id uuid, p_vote public.infraction_vote_choice
)
returns public.infraction_status
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.infractions%rowtype;
  v_voter uuid;
  v_uphold integer;
  v_excuse integer;
  v_status public.infraction_status;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if not found or v_row.status <> 'disputed' or now() >= v_row.dispute_deadline then
    raise exception 'This vote is closed';
  end if;
  v_voter := private.current_member_id(v_row.household_id);
  if v_voter is null then raise exception 'Only household members can vote'; end if;
  if p_vote is null then raise exception 'Choose excuse or uphold'; end if;
  insert into public.infraction_votes(household_id, infraction_id, voter_member_id, choice)
  values (v_row.household_id, p_infraction_id, v_voter, p_vote)
  on conflict (infraction_id, voter_member_id)
  do update set choice = excluded.choice, created_at = now();
  select count(*) filter (where choice = 'uphold'), count(*) filter (where choice = 'excuse')
  into v_uphold, v_excuse from public.infraction_votes where infraction_id = p_infraction_id;
  v_status := (case when v_uphold >= 2 then 'upheld'
    when v_excuse >= 2 then 'excused' else 'disputed' end)::public.infraction_status;
  if v_status <> 'disputed' then
    update public.infractions set status = v_status, resolved_at = now() where id = p_infraction_id;
  end if;
  return v_status;
end
$$;
revoke all on function private.cast_infraction_vote_impl(uuid, public.infraction_vote_choice) from public, anon;
grant execute on function private.cast_infraction_vote_impl(uuid, public.infraction_vote_choice) to authenticated;

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
      now() + interval '7 days'
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

-- Extend only reviews that are still open; never reopen a finalized penalty.
update public.infractions
set dispute_deadline = greatest(dispute_deadline, created_at + interval '7 days')
where status in ('pending', 'disputed') and dispute_deadline > now()
  and ledger_transaction_id is null;
