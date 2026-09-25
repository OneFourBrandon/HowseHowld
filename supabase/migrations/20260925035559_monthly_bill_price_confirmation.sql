alter table public.household_bills add column requires_monthly_price boolean not null default false;
alter table public.household_bill_periods add column price_confirmed boolean not null default false;

-- Existing periods with a different amount were manually set; retain those overrides.
update public.household_bill_periods period set price_confirmed = true
from public.household_bills bill
where bill.id = period.bill_id and period.amount_cents is distinct from bill.amount_cents
  and period.amount_cents is not null;

create or replace function private.generate_household_bill_periods(p_horizon_months integer default 2)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_created integer := 0;
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
  return v_created;
end;
$$;

-- Keep the existing member validation and period generation, then apply the
-- monthly-price setting to newly generated current/future periods.
create or replace function private.configure_household_bill_impl(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_bill uuid;
  v_household uuid := (p_input->>'householdId')::uuid;
  v_current_month date;
  v_requires boolean;
begin
  v_bill := private.upsert_household_bill_impl(p_input);
  if p_input ? 'requiresMonthlyPrice' then
    v_requires := (p_input->>'requiresMonthlyPrice')::boolean;
    update public.household_bills set requires_monthly_price = v_requires where id = v_bill;
    select date_trunc('month', now() at time zone timezone)::date into v_current_month
    from public.households where id = v_household;
    update public.household_bill_periods period
    set amount_cents = case when v_requires then null else bill.amount_cents end
    from public.household_bills bill
    where period.bill_id = v_bill and bill.id = v_bill and period.period_month >= v_current_month
      and not period.price_confirmed
      and not exists (select 1 from public.household_bill_payments payment where payment.period_id = period.id);
  end if;
  return v_bill;
end;
$$;
revoke all on function private.configure_household_bill_impl(jsonb) from public, anon;
grant execute on function private.configure_household_bill_impl(jsonb) to authenticated;
create or replace function public.upsert_household_bill(p_input jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.configure_household_bill_impl(p_input)
$$;

drop function public.edit_household_bill(uuid,text,integer,date,integer);
drop function private.edit_household_bill_impl(uuid,text,integer,date,integer);

create function private.edit_household_bill_impl(
  p_bill_id uuid, p_category text, p_amount_cents integer,
  p_period_month date, p_monthly_amount_cents integer, p_requires_monthly_price boolean
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bill public.household_bills%rowtype;
  v_timezone text;
  v_current_month date;
  v_effective_month date;
begin
  select * into v_bill from public.household_bills where id = p_bill_id and active for update;
  if not found then raise exception 'Bill not found'; end if;
  if not private.is_household_owner(v_bill.household_id) then
    raise exception 'Only the admin can edit bills';
  end if;
  if p_period_month is null or p_period_month <> date_trunc('month', p_period_month)::date then
    raise exception 'Choose a valid month';
  end if;
  if p_requires_monthly_price is null then raise exception 'Choose a monthly price setting'; end if;
  select timezone, date_trunc('month', now() at time zone timezone)::date
    into v_timezone, v_current_month from public.households where id = v_bill.household_id;
  v_effective_month := greatest(p_period_month, v_current_month);

  update public.household_bills set category = p_category, amount_cents = p_amount_cents,
    requires_monthly_price = p_requires_monthly_price, updated_at = now() where id = p_bill_id;

  -- Baseline/setting edits apply only from the selected future month onward.
  -- Paid and explicitly priced periods remain stable.
  update public.household_bill_periods period
  set amount_cents = case when p_requires_monthly_price then null else p_amount_cents end
  where period.bill_id = p_bill_id and period.period_month >= v_effective_month
    and not period.price_confirmed
    and not exists (select 1 from public.household_bill_payments payment where payment.period_id = period.id);

  -- Leaving a past month's price blank must not rewrite its snapshot.
  if p_period_month < v_current_month and p_monthly_amount_cents is null then return; end if;

  insert into public.household_bill_periods(
    household_id, bill_id, period_month, amount_cents, due_at, price_confirmed
  ) values (
    v_bill.household_id, p_bill_id, p_period_month,
    coalesce(p_monthly_amount_cents, case when p_requires_monthly_price then null else p_amount_cents end),
    make_timestamptz(extract(year from p_period_month)::integer,
      extract(month from p_period_month)::integer, v_bill.due_day, 9, 0, 0, v_timezone),
    p_monthly_amount_cents is not null
  ) on conflict (bill_id, period_month) do update
    set amount_cents = excluded.amount_cents, price_confirmed = excluded.price_confirmed
    where excluded.price_confirmed or not exists (
      select 1 from public.household_bill_payments payment where payment.period_id = household_bill_periods.id
    );
end;
$$;
revoke all on function private.edit_household_bill_impl(uuid,text,integer,date,integer,boolean) from public, anon;
grant execute on function private.edit_household_bill_impl(uuid,text,integer,date,integer,boolean) to authenticated;

create function public.edit_household_bill(
  p_bill_id uuid, p_category text, p_amount_cents integer,
  p_period_month date, p_monthly_amount_cents integer, p_requires_monthly_price boolean
) returns void language sql security invoker set search_path = '' as $$
  select private.edit_household_bill_impl(p_bill_id, p_category, p_amount_cents,
    p_period_month, p_monthly_amount_cents, p_requires_monthly_price)
$$;
revoke all on function public.edit_household_bill(uuid,text,integer,date,integer,boolean) from public, anon;
grant execute on function public.edit_household_bill(uuid,text,integer,date,integer,boolean) to authenticated;

create function private.prevent_pending_bill_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.household_bill_periods
    where id = new.period_id and amount_cents is not null) then
    raise exception 'Enter the monthly bill price before marking it paid';
  end if;
  return new;
end;
$$;
create trigger pending_bill_payment_guard before insert or update on public.household_bill_payments
for each row execute function private.prevent_pending_bill_payment();

create or replace function private.enqueue_household_bill_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_count integer;
begin
  insert into public.notification_outbox (
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select period.household_id, target.member_id, 'household_bill_due',
    'household_bill_period', period.id,
    period.due_at - make_interval(days => reminder_day), bill.name || ' is due',
    case
      when reminder_day = 0 then bill.name || ' is due today. Check it off when you pay.'
      when reminder_day = 1 then bill.name || ' is due tomorrow.'
      else bill.name || ' is due in ' || reminder_day || ' days.'
    end,
    '/money?section=bills',
    case when reminder_day <= 1 then 'high' else 'normal' end
  from public.household_bill_periods period
  join public.household_bills bill on bill.id = period.bill_id and bill.active
  join public.household_bill_members target on target.bill_id = bill.id
  join public.household_members member
    on member.id = target.member_id and member.household_id = period.household_id and member.active
  cross join lateral unnest(bill.reminder_days_before) reminder_day
  where period.amount_cents is not null
    and period.due_at - make_interval(days => reminder_day) <= now()
    and period.due_at - make_interval(days => reminder_day) > now() - interval '2 minutes'
    and not exists (
      select 1 from public.household_bill_payments payment
      where payment.period_id = period.id and payment.member_id = target.member_id
    )
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
