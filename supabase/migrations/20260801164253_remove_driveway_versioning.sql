drop function if exists public.reorder_driveway(uuid, bigint, uuid[]);
drop function if exists private.reorder_driveway_impl(uuid, bigint, uuid[]);

create or replace function private.upsert_vehicle_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_id uuid := nullif(p_input->>'id', '')::uuid;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if char_length(trim(coalesce(p_input->>'label', ''))) < 2 then
    raise exception 'Give the vehicle a name';
  end if;

  if v_id is null then
    insert into public.vehicles(household_id, owner_member_id, label, color, plate)
    values (
      v_household, v_member, trim(p_input->>'label'),
      coalesce(nullif(p_input->>'color', ''), '#6278b5'),
      nullif(upper(trim(p_input->>'plate')), '')
    )
    returning id into v_id;
    insert into public.driveway_positions(household_id, vehicle_id, position)
    values (
      v_household,
      v_id,
      coalesce((select max(position) + 1 from public.driveway_positions where household_id = v_household), 0)
    );
    update public.driveway_state
    set updated_by = v_member, updated_at = now()
    where household_id = v_household;
  else
    update public.vehicles set
      label = trim(p_input->>'label'),
      color = coalesce(nullif(p_input->>'color', ''), color),
      plate = nullif(upper(trim(p_input->>'plate')), '')
    where id = v_id and household_id = v_household and owner_member_id = v_member;
    if not found then raise exception 'Vehicle not found'; end if;
  end if;
  return v_id;
end
$$;

create or replace function private.archive_vehicle_impl(p_vehicle_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_vehicle public.vehicles%rowtype;
begin
  select * into v_vehicle from public.vehicles where id = p_vehicle_id for update;
  if not found
    or private.current_member_id(v_vehicle.household_id) <> v_vehicle.owner_member_id
  then raise exception 'Vehicle not found'; end if;
  update public.vehicles set active = false where id = p_vehicle_id;
  delete from public.driveway_positions where vehicle_id = p_vehicle_id;
  update public.driveway_state
  set updated_by = v_vehicle.owner_member_id, updated_at = now()
  where household_id = v_vehicle.household_id;
end
$$;

create or replace function private.reorder_driveway_impl(
  p_household_id uuid, p_ordered_vehicle_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id(p_household_id);
begin
  if v_member is null then raise exception 'Not a household member'; end if;

  perform 1 from public.driveway_state
  where household_id = p_household_id for update;

  if cardinality(p_ordered_vehicle_ids) <> (
      select count(*) from public.vehicles
      where household_id = p_household_id and active
    )
    or exists (
      select 1
      from unnest(p_ordered_vehicle_ids) as ordered(id)
      left join public.vehicles v
        on v.id = ordered.id
       and v.household_id = p_household_id
       and v.active
      where v.id is null
    )
    or (
      select count(distinct id) from unnest(p_ordered_vehicle_ids) as ordered(id)
    ) <> cardinality(p_ordered_vehicle_ids)
  then
    raise exception 'The lineup must include every active vehicle exactly once';
  end if;

  delete from public.driveway_positions where household_id = p_household_id;
  insert into public.driveway_positions(household_id, vehicle_id, position)
  select p_household_id, id, ordinality - 1
  from unnest(p_ordered_vehicle_ids) with ordinality as ordered(id, ordinality);

  update public.driveway_state
  set updated_by = v_member, updated_at = now()
  where household_id = p_household_id;
end
$$;

revoke all on function private.reorder_driveway_impl(uuid, uuid[]) from public;
grant execute on function private.reorder_driveway_impl(uuid, uuid[]) to authenticated;

create or replace function public.reorder_driveway(
  p_household_id uuid, p_ordered_vehicle_ids uuid[]
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.reorder_driveway_impl(p_household_id, p_ordered_vehicle_ids)
$$;

revoke all on function public.reorder_driveway(uuid, uuid[]) from public;
grant execute on function public.reorder_driveway(uuid, uuid[]) to authenticated;

alter table public.driveway_state drop column version;
