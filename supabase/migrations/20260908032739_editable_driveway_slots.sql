-- Each tile is a single parking space regardless of its grid footprint.
create table public.driveway_slots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  x integer not null check (x >= 0),
  y integer not null check (y >= 0),
  width integer not null default 1 check (width > 0),
  height integer not null default 1 check (height > 0),
  kind text not null default 'driveway' check (kind in ('driveway','garage')),
  vehicle_id uuid unique references public.vehicles(id) on delete set null,
  check (x::bigint + width <= 2147483647 and y::bigint + height <= 2147483647)
);
create index driveway_slots_household_position_idx on public.driveway_slots(household_id,y,x);
alter table public.driveway_slots enable row level security;
revoke all on public.driveway_slots from anon,authenticated;
grant select on public.driveway_slots to authenticated;
grant all on public.driveway_slots to service_role;
create policy driveway_slots_household_select on public.driveway_slots for select to authenticated
  using (private.current_member_id(household_id) is not null);
alter publication supabase_realtime add table public.driveway_slots;

-- Preserve the existing active lineup when moving to individual tiles.
insert into public.driveway_slots(household_id,x,y,kind,vehicle_id)
select household_id, (position % driveway_width)::integer, (position / driveway_width)::integer,
  case when position / driveway_width >= greatest(1, ceil(car_count::numeric / driveway_width)::integer - garage_rows)
    then 'garage' else 'driveway' end, vehicle_id
from (
  select v.household_id, v.id vehicle_id, h.driveway_width, h.garage_rows,
    row_number() over(partition by v.household_id order by p.position nulls last,v.id)-1 position,
    count(*) over(partition by v.household_id) car_count
  from public.vehicles v join public.households h on h.id=v.household_id
  left join public.driveway_positions p on p.vehicle_id=v.id where v.active
) cars;

create or replace function private.driveway_blockers(p_household_id uuid,p_vehicle_id uuid)
returns uuid[] language sql stable security invoker set search_path='' as $$
  select coalesce(array_agg(ahead.vehicle_id order by ahead.y,ahead.x),'{}'::uuid[])
  from public.driveway_slots target
  join public.driveway_slots ahead on ahead.household_id=target.household_id
    and ahead.y + ahead.height <= target.y
    and ahead.x < target.x + target.width and target.x < ahead.x + ahead.width
  join public.vehicles car on car.id=ahead.vehicle_id and car.active
  where target.household_id=p_household_id and target.vehicle_id=p_vehicle_id
$$;
revoke all on function private.driveway_blockers(uuid,uuid) from public;
grant execute on function private.driveway_blockers(uuid,uuid) to authenticated,service_role;

create or replace function private.refresh_driveway_paths(p_household_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  update public.departure_occurrences d
  set blocker_vehicle_ids=private.driveway_blockers(d.household_id,d.vehicle_id)
  where d.household_id=p_household_id and d.required_at >= now()
    and d.blocker_vehicle_ids is distinct from private.driveway_blockers(d.household_id,d.vehicle_id);
  update public.notification_outbox n set status='cancelled',last_error='Driveway path changed'
  from public.departure_occurrences d
  where n.kind='driveway_warning' and n.entity_id=d.id and d.household_id=p_household_id
    and n.status='pending' and not exists (
      select 1 from public.vehicles v where v.id=any(d.blocker_vehicle_ids) and v.owner_member_id=n.member_id and v.active
    );
end $$;
revoke all on function private.refresh_driveway_paths(uuid) from public,anon,authenticated;

create or replace function private.save_driveway_slots_impl(p_household_id uuid,p_slots jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not private.is_household_owner(p_household_id) then raise exception 'Only the admin can edit parking slots'; end if;
  if jsonb_typeof(p_slots) is distinct from 'array' then raise exception 'Expected parking slots'; end if;
  perform 1 from public.driveway_state where household_id=p_household_id for update;
  if exists (
    select 1 from jsonb_to_recordset(p_slots) as s(id uuid,x integer,y integer,width integer,height integer,kind text)
    where id is null or x is null or y is null or width is null or height is null or kind is null
      or x < 0 or y < 0 or width < 1 or height < 1 or kind not in ('driveway','garage')
      or x::bigint+width > 2147483647 or y::bigint+height > 2147483647
  ) then raise exception 'Invalid parking slot'; end if;
  if (select count(distinct value->>'id') from jsonb_array_elements(p_slots)) <> jsonb_array_length(p_slots) then
    raise exception 'Duplicate parking slot';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_slots) as a(id uuid,x integer,y integer,width integer,height integer)
    join jsonb_to_recordset(p_slots) as b(id uuid,x integer,y integer,width integer,height integer)
      on a.id < b.id and a.x < b.x+b.width and b.x < a.x+a.width and a.y < b.y+b.height and b.y < a.y+a.height
  ) then raise exception 'Parking slots must not overlap'; end if;
  if exists (select 1 from public.driveway_slots s join jsonb_array_elements(p_slots) item on s.id=(item->>'id')::uuid where s.household_id<>p_household_id) then
    raise exception 'Parking slot belongs to another household';
  end if;
  if exists (select 1 from public.driveway_slots s where s.household_id=p_household_id and s.vehicle_id is not null
    and not exists(select 1 from jsonb_array_elements(p_slots) item where (item->>'id')::uuid=s.id)) then
    raise exception 'Unpark cars before deleting their slots';
  end if;
  delete from public.driveway_slots s where s.household_id=p_household_id
    and not exists(select 1 from jsonb_array_elements(p_slots) item where (item->>'id')::uuid=s.id);
  insert into public.driveway_slots(id,household_id,x,y,width,height,kind)
    select id,p_household_id,x,y,width,height,kind from jsonb_to_recordset(p_slots) as s(id uuid,x integer,y integer,width integer,height integer,kind text)
    on conflict(id) do update set x=excluded.x,y=excluded.y,width=excluded.width,height=excluded.height,kind=excluded.kind;
  -- Occupancy is deliberately never read from an admin's layout draft.
  perform private.refresh_driveway_paths(p_household_id);
  update public.driveway_state set updated_by=private.current_member_id(p_household_id),updated_at=now() where household_id=p_household_id;
end $$;
revoke all on function private.save_driveway_slots_impl(uuid,jsonb) from public;
grant execute on function private.save_driveway_slots_impl(uuid,jsonb) to authenticated;
create or replace function public.save_driveway_slots(p_household_id uuid,p_slots jsonb)
returns void language sql security invoker set search_path='' as $$ select private.save_driveway_slots_impl(p_household_id,p_slots) $$;
revoke all on function public.save_driveway_slots(uuid,jsonb) from public,anon;
grant execute on function public.save_driveway_slots(uuid,jsonb) to authenticated;

create or replace function private.park_vehicle_impl(p_household_id uuid,p_vehicle_id uuid,p_slot_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare source_id uuid; displaced uuid;
begin
  if private.current_member_id(p_household_id) is null then raise exception 'Not a household member'; end if;
  perform 1 from public.driveway_state where household_id=p_household_id for update;
  perform 1 from public.vehicles where id=p_vehicle_id and household_id=p_household_id and active for update;
  if not found then raise exception 'Vehicle not found'; end if;
  select id into source_id from public.driveway_slots where household_id=p_household_id and vehicle_id=p_vehicle_id;
  if p_slot_id is not null then
    select vehicle_id into displaced from public.driveway_slots where id=p_slot_id and household_id=p_household_id;
    if not found then raise exception 'Parking slot not found'; end if;
    if p_slot_id=source_id then return; end if;
    if displaced is not null and source_id is null then raise exception 'That slot is occupied. Choose an empty slot.'; end if;
  end if;
  update public.driveway_slots set vehicle_id=null where household_id=p_household_id and (id=source_id or id=p_slot_id);
  update public.driveway_slots set vehicle_id=p_vehicle_id where id=p_slot_id and household_id=p_household_id;
  update public.driveway_slots set vehicle_id=displaced where id=source_id and household_id=p_household_id;
  perform private.refresh_driveway_paths(p_household_id);
  update public.driveway_state set updated_by=private.current_member_id(p_household_id),updated_at=now() where household_id=p_household_id;
end $$;
revoke all on function private.park_vehicle_impl(uuid,uuid,uuid) from public;
grant execute on function private.park_vehicle_impl(uuid,uuid,uuid) to authenticated;
create or replace function public.park_vehicle(p_household_id uuid,p_vehicle_id uuid,p_slot_id uuid)
returns void language sql security invoker set search_path='' as $$ select private.park_vehicle_impl(p_household_id,p_vehicle_id,p_slot_id) $$;
revoke all on function public.park_vehicle(uuid,uuid,uuid) from public,anon;
grant execute on function public.park_vehicle(uuid,uuid,uuid) to authenticated;

create or replace function private.unpark_archived_vehicle()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.active and not new.active then
    update public.driveway_slots set vehicle_id=null where vehicle_id=new.id;
    perform private.refresh_driveway_paths(new.household_id);
  end if;
  return new;
end $$;
revoke all on function private.unpark_archived_vehicle() from public,anon,authenticated;
create trigger unpark_archived_vehicle after update of active on public.vehicles
  for each row execute function private.unpark_archived_vehicle();

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
        values (
          v_rule.household_id, v_rule.id, v_rule.vehicle_id, v_rule.owner_member_id,
          v_required, private.driveway_blockers(v_rule.household_id,v_rule.vehicle_id)
        )
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
  set blocker_vehicle_ids=private.driveway_blockers(occurrence.household_id,occurrence.vehicle_id)
  where occurrence.required_at >= now()
    and occurrence.blocker_vehicle_ids is distinct from private.driveway_blockers(occurrence.household_id,occurrence.vehicle_id);

  -- Previously queued warnings may refer to cars in a different column after
  -- a layout change. Retain history but stop those pending warnings being sent.
  update public.notification_outbox queued
  set status='cancelled', last_error='Driveway path changed'
  from public.departure_occurrences occurrence
  where queued.kind='driveway_warning' and queued.entity_id=occurrence.id
    and queued.status='pending'
    and not exists (
      select 1 from public.vehicles vehicle
      where vehicle.id=any(occurrence.blocker_vehicle_ids)
        and vehicle.owner_member_id=queued.member_id and vehicle.active
    );

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
  where rule.active and occurrence.required_at between now() and now() + interval '31 days'
  on conflict (kind,entity_id,member_id,scheduled_at) do update
    set status='pending', last_error=null
    where public.notification_outbox.status='cancelled'
      and public.notification_outbox.last_error='Driveway path changed';
  get diagnostics v_count = row_count;
  return v_count;
end
$$;
