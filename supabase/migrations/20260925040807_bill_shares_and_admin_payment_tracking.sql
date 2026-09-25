alter table public.household_bill_members
  add column share_weight integer not null default 1 check (share_weight > 0);

create table public.household_bill_period_shares (
  period_id uuid not null references public.household_bill_periods(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  amount_cents integer not null check (amount_cents >= 0),
  primary key (period_id, member_id)
);
create index household_bill_period_shares_member_idx
  on public.household_bill_period_shares(household_id, member_id);
alter table public.household_bill_period_shares enable row level security;
create policy household_bill_period_shares_household_select
on public.household_bill_period_shares for select to authenticated
using ((select private.is_household_member(household_id)));
grant select on public.household_bill_period_shares to authenticated;
revoke insert, update, delete on public.household_bill_period_shares from authenticated, anon;

-- Allocate each month by the configured weights. Cumulative rounding keeps
-- the individual cent amounts adding up exactly to the bill total.
create function private.sync_household_bill_shares_impl(
  p_bill_id uuid, p_from_month date, p_include_paid boolean default false
) returns void language plpgsql security definer set search_path = '' as $$
declare v_period public.household_bill_periods%rowtype;
begin
  for v_period in
    select * from public.household_bill_periods bill_period
    where bill_id = p_bill_id and period_month >= p_from_month
      and (p_include_paid or not exists (
        select 1 from public.household_bill_payments payment where payment.period_id = bill_period.id
      ))
    order by period_month for update
  loop
    delete from public.household_bill_period_shares where period_id = v_period.id;
    if v_period.amount_cents is null then continue; end if;
    insert into public.household_bill_period_shares(period_id, household_id, member_id, amount_cents)
    select v_period.id, v_period.household_id, allocation.member_id,
      (round(v_period.amount_cents::numeric * allocation.running_weight / allocation.total_weight)
       - round(v_period.amount_cents::numeric * (allocation.running_weight - allocation.share_weight) / allocation.total_weight))::integer
    from (
      select member_id, share_weight,
        sum(share_weight) over (order by member_id) as running_weight,
        sum(share_weight) over () as total_weight
      from public.household_bill_members where bill_id = p_bill_id
    ) allocation;
  end loop;
end;
$$;
revoke all on function private.sync_household_bill_shares_impl(uuid,date,boolean) from public, anon, authenticated;

-- Snapshot existing bills using the equal shares they already represented.
do $$ declare v_bill record; begin
  for v_bill in select id from public.household_bills loop
    perform private.sync_household_bill_shares_impl(v_bill.id, date '0001-01-01', true);
  end loop;
end $$;

-- The old edit RPC cannot maintain member shares; replace it with one save
-- operation that validates the complete bill form.
drop function public.edit_household_bill(uuid,text,integer,date,integer,boolean);
drop function private.edit_household_bill_impl(uuid,text,integer,date,integer,boolean);

create function private.save_household_bill_impl(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_bill public.household_bills%rowtype;
  v_household uuid := (p_input->>'householdId')::uuid;
  v_id uuid := nullif(p_input->>'id', '')::uuid;
  v_owner uuid := private.current_member_id(v_household);
  v_month date := nullif(p_input->>'periodMonth', '')::date;
  v_current_month date;
  v_effective_month date;
  v_timezone text;
  v_amount integer := nullif(p_input->>'amountCents', '')::integer;
  v_monthly_amount integer := nullif(p_input->>'monthlyAmountCents', '')::integer;
  v_requires boolean := coalesce((p_input->>'requiresMonthlyPrice')::boolean, false);
  v_member jsonb;
  v_member_id uuid;
  v_weight integer;
  v_member_count integer := 0;
begin
  if v_owner is null then raise exception 'Household membership required'; end if;
  if v_id is not null and not private.is_household_owner(v_household) then
    raise exception 'Only the admin can edit bills';
  end if;
  if v_month is not null and v_month <> date_trunc('month', v_month)::date then
    raise exception 'Choose a valid month';
  end if;
  if trim(coalesce(p_input->>'name','')) = '' then raise exception 'Bill name is required'; end if;
  if v_amount is not null and v_amount <= 0 or v_monthly_amount is not null and v_monthly_amount <= 0 then
    raise exception 'Bill amounts must be positive';
  end if;
  select timezone, date_trunc('month', now() at time zone timezone)::date
    into v_timezone, v_current_month from public.households where id = v_household;
  if v_month is null then v_month := v_current_month; end if;
  v_effective_month := greatest(v_month, v_current_month);

  if v_id is null then
    insert into public.household_bills(household_id,name,category,amount_cents,due_day,
      reminder_days_before,requires_monthly_price,created_by)
    values(v_household,trim(p_input->>'name'),p_input->>'category',v_amount,
      (p_input->>'dueDay')::smallint,
      array(select value::integer from jsonb_array_elements_text(coalesce(p_input->'reminderDaysBefore','[]'::jsonb))),
      v_requires,v_owner) returning * into v_bill;
    v_id := v_bill.id;
  else
    select * into v_bill from public.household_bills
      where id = v_id and household_id = v_household and active for update;
    if not found then raise exception 'Bill not found'; end if;
    update public.household_bills set name = trim(p_input->>'name'), category = p_input->>'category',
      amount_cents = v_amount, due_day = (p_input->>'dueDay')::smallint,
      reminder_days_before = array(select value::integer from jsonb_array_elements_text(coalesce(p_input->'reminderDaysBefore','[]'::jsonb))),
      requires_monthly_price = v_requires, updated_at = now()
    where id = v_id returning * into v_bill;
  end if;

  delete from public.household_bill_members where bill_id = v_id;
  for v_member in select value from jsonb_array_elements(coalesce(p_input->'members','[]'::jsonb)) loop
    v_member_id := (v_member->>'memberId')::uuid;
    v_weight := (v_member->>'shareWeight')::integer;
    if v_weight is null or v_weight <= 0 or not exists (
      select 1 from public.household_members
      where id = v_member_id and household_id = v_household and active
    ) then raise exception 'Bill shares require active roommates and positive amounts'; end if;
    insert into public.household_bill_members(household_id,bill_id,member_id,share_weight)
    values(v_household,v_id,v_member_id,v_weight);
    v_member_count := v_member_count + 1;
  end loop;
  if v_member_count = 0 then raise exception 'Choose at least one roommate'; end if;

  perform private.generate_household_bill_periods(2);
  update public.household_bill_periods period
  set amount_cents = case when v_requires then null else v_amount end,
    due_at = make_timestamptz(extract(year from period.period_month)::integer,
      extract(month from period.period_month)::integer, v_bill.due_day, 9, 0, 0, v_timezone)
  where period.bill_id = v_id and period.period_month >= v_effective_month
    and not period.price_confirmed and not exists (
      select 1 from public.household_bill_payments payment where payment.period_id = period.id
    );

  if v_month >= v_current_month or v_monthly_amount is not null then
    insert into public.household_bill_periods(household_id,bill_id,period_month,amount_cents,due_at,price_confirmed)
    values(v_household,v_id,v_month,
      coalesce(v_monthly_amount, case when v_requires then null else v_amount end),
      make_timestamptz(extract(year from v_month)::integer,extract(month from v_month)::integer,
        v_bill.due_day,9,0,0,v_timezone),v_monthly_amount is not null)
    on conflict (bill_id,period_month) do update
    set amount_cents=excluded.amount_cents,price_confirmed=excluded.price_confirmed
    where excluded.price_confirmed or not exists (
      select 1 from public.household_bill_payments payment where payment.period_id=household_bill_periods.id
    );
  end if;

  perform private.sync_household_bill_shares_impl(v_id, v_effective_month);
  if v_monthly_amount is not null and v_month < v_current_month then
    perform private.sync_household_bill_shares_impl(v_id, v_month, true);
  end if;
  return v_id;
end;
$$;
revoke all on function private.save_household_bill_impl(jsonb) from public, anon;
grant execute on function private.save_household_bill_impl(jsonb) to authenticated;

create function public.save_household_bill(p_input jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_household_bill_impl(p_input)
$$;
revoke all on function public.save_household_bill(jsonb) from public, anon;
grant execute on function public.save_household_bill(jsonb) to authenticated;

-- Keep existing clients on the same validated path when they add a bill.
create or replace function public.upsert_household_bill(p_input jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_household_bill_impl(jsonb_set(p_input,'{members}',
    coalesce((select jsonb_agg(jsonb_build_object('memberId',value,'shareWeight',1))
      from jsonb_array_elements_text(coalesce(p_input->'memberIds','[]'::jsonb))), '[]'::jsonb)))
$$;

create function private.set_household_bill_member_paid_impl(
  p_period_id uuid,p_member_id uuid,p_paid boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_period public.household_bill_periods%rowtype;
  v_actor uuid;
begin
  select * into v_period from public.household_bill_periods where id=p_period_id for update;
  if not found then raise exception 'Bill month not found'; end if;
  v_actor := private.current_member_id(v_period.household_id);
  if v_actor is null or not private.is_household_owner(v_period.household_id) then
    raise exception 'Only the admin can track roommate payments';
  end if;
  if not exists (select 1 from public.household_bill_period_shares
    where period_id=p_period_id and member_id=p_member_id) then
    raise exception 'Roommate is not assigned to this bill month';
  end if;
  if p_paid then
    if v_period.amount_cents is null then raise exception 'Enter the monthly bill price first'; end if;
    insert into public.household_bill_payments(household_id,period_id,member_id,marked_by)
    values(v_period.household_id,p_period_id,p_member_id,v_actor)
    on conflict(period_id,member_id) do update set paid_at=now(),marked_by=excluded.marked_by;
    update public.notification_outbox set status='cancelled'
    where entity_id=p_period_id and member_id=p_member_id and status='pending';
  else
    delete from public.household_bill_payments where period_id=p_period_id and member_id=p_member_id;
  end if;
end;
$$;
revoke all on function private.set_household_bill_member_paid_impl(uuid,uuid,boolean) from public,anon;
grant execute on function private.set_household_bill_member_paid_impl(uuid,uuid,boolean) to authenticated;
create function public.set_household_bill_member_paid(p_period_id uuid,p_member_id uuid,p_paid boolean)
returns void language sql security invoker set search_path = '' as $$
  select private.set_household_bill_member_paid_impl(p_period_id,p_member_id,p_paid)
$$;
revoke all on function public.set_household_bill_member_paid(uuid,uuid,boolean) from public,anon;
grant execute on function public.set_household_bill_member_paid(uuid,uuid,boolean) to authenticated;

-- Cron-created months also need their share snapshots before they count as owing.
create or replace function private.generate_household_bill_periods(p_horizon_months integer default 2)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_created integer := 0;
  v_bill record;
begin
  insert into public.household_bill_periods (household_id, bill_id, period_month, amount_cents, due_at)
  select bill.household_id, bill.id, bill_month.period_month,
    case when bill.requires_monthly_price then null else bill.amount_cents end,
    make_timestamptz(extract(year from bill_month.period_month)::integer,
      extract(month from bill_month.period_month)::integer, bill.due_day, 9, 0, 0, household.timezone)
  from public.household_bills bill
  join public.households household on household.id = bill.household_id
  cross join generate_series(0, greatest(0, least(p_horizon_months, 12))) horizon(month_offset)
  cross join lateral (
    select (date_trunc('month', now() at time zone household.timezone)
      + make_interval(months => horizon.month_offset))::date as period_month
  ) bill_month
  where bill.active
  on conflict (bill_id, period_month) do nothing;
  get diagnostics v_created = row_count;
  if v_created > 0 then
    for v_bill in select bill.id, date_trunc('month', now() at time zone household.timezone)::date as current_month
      from public.household_bills bill join public.households household on household.id=bill.household_id
      where bill.active
    loop
      perform private.sync_household_bill_shares_impl(v_bill.id,v_bill.current_month);
    end loop;
  end if;
  return v_created;
end;
$$;
