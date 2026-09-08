create or replace function private.generate_departure_occurrences(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule public.departure_rules%rowtype;
  v_required timestamptz;
  v_until timestamptz := now() + make_interval(days => greatest(1, least(p_horizon_days, 90)));
  v_step interval;
  v_inserted integer := 0;
begin
  for v_rule in select * from public.departure_rules where active loop
    v_required := v_rule.first_required_at;
    v_step := case coalesce(v_rule.recurrence->>'frequency', 'once')
      when 'daily' then make_interval(days => greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      when 'weekly' then make_interval(days => 7 * greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      when 'monthly' then make_interval(months => greatest(coalesce((v_rule.recurrence->>'interval')::integer, 1), 1))
      else null
    end;
    while v_required <= v_until loop
      if v_required >= now() - interval '1 day' then
        insert into public.departure_occurrences(
          household_id, rule_id, vehicle_id, owner_member_id, required_at, blocker_vehicle_ids
        )
        select
          v_rule.household_id, v_rule.id, v_rule.vehicle_id, v_rule.owner_member_id,
          v_required,
          coalesce(array_agg(dp.vehicle_id order by dp.position)
            filter (where dp.position < target.position), '{}'::uuid[])
        from public.driveway_positions target
        left join public.driveway_positions dp
          on dp.household_id = target.household_id and dp.position < target.position
        where target.household_id = v_rule.household_id and target.vehicle_id = v_rule.vehicle_id
        group by target.position
        on conflict (rule_id, required_at) do update set
          blocker_vehicle_ids = excluded.blocker_vehicle_ids
        where public.departure_occurrences.blocker_vehicle_ids
          is distinct from excluded.blocker_vehicle_ids;
        if found then v_inserted := v_inserted + 1; end if;
      end if;
      exit when v_step is null;
      v_required := v_required + v_step;
    end loop;
  end loop;
  return v_inserted;
end
$$;

create or replace function private.enqueue_departure_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
begin
  update public.departure_occurrences occurrence
  set blocker_vehicle_ids = blockers.ids
  from (
    select target.vehicle_id,
      coalesce(array_agg(dp.vehicle_id order by dp.position)
        filter (where dp.position < target.position), '{}'::uuid[]) ids
    from public.driveway_positions target
    left join public.driveway_positions dp
      on dp.household_id = target.household_id and dp.position < target.position
    group by target.household_id, target.vehicle_id, target.position
  ) blockers
  where occurrence.vehicle_id = blockers.vehicle_id
    and occurrence.required_at between now() and now() + interval '2 days'
    and occurrence.blocker_vehicle_ids is distinct from blockers.ids;

  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select
    occurrence.household_id, blocker_vehicle.owner_member_id,
    'driveway_warning', 'departure_occurrence', occurrence.id,
    occurrence.required_at - make_interval(mins => warning.minutes),
    'Driveway move needed',
    owner_vehicle.label || ' needs a clear path for ' ||
      to_char(occurrence.required_at at time zone household.timezone, 'FMHH12:MI AM'),
    '/driveway',
    case when warning.minutes <= 60 then 'high' else 'normal' end
  from public.departure_occurrences occurrence
  join public.departure_rules rule on rule.id = occurrence.rule_id
  join public.households household on household.id = occurrence.household_id
  join public.vehicles owner_vehicle on owner_vehicle.id = occurrence.vehicle_id
  cross join lateral unnest(rule.warning_minutes) warning(minutes)
  cross join lateral unnest(occurrence.blocker_vehicle_ids) blocker_id(id)
  join public.vehicles blocker_vehicle on blocker_vehicle.id = blocker_id.id and blocker_vehicle.active
  where occurrence.required_at between now() and now() + interval '31 days'
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
