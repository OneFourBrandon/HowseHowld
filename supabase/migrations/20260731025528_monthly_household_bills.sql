-- Monthly rent and utility tracking. Definitions are household-owned, periods
-- snapshot the amount/due date, and members may only check off their own payment.
create table public.household_bills (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  category text not null check (
    category in ('rent', 'electricity', 'water', 'gas', 'internet', 'insurance', 'other')
  ),
  amount_cents integer check (amount_cents is null or amount_cents > 0),
  due_day smallint not null check (due_day between 1 and 28),
  reminder_days_before integer[] not null default array[7, 3, 1, 0],
  active boolean not null default true,
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    cardinality(reminder_days_before) <= 8
    and reminder_days_before <@ array[0,1,2,3,4,5,6,7,10,14,21,28]
  )
);
create index household_bills_household_active_idx
  on public.household_bills(household_id, active);

create table public.household_bill_members (
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid not null references public.household_bills(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  primary key (bill_id, member_id)
);
create index household_bill_members_member_idx
  on public.household_bill_members(household_id, member_id, bill_id);

create table public.household_bill_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  bill_id uuid not null references public.household_bills(id) on delete cascade,
  period_month date not null check (period_month = date_trunc('month', period_month)::date),
  amount_cents integer check (amount_cents is null or amount_cents > 0),
  due_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (bill_id, period_month)
);
create index household_bill_periods_household_month_idx
  on public.household_bill_periods(household_id, period_month, due_at);

create table public.household_bill_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  period_id uuid not null references public.household_bill_periods(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  marked_by uuid not null references public.household_members(id),
  paid_at timestamptz not null default now(),
  unique (period_id, member_id)
);
create index household_bill_payments_member_idx
  on public.household_bill_payments(household_id, member_id, paid_at desc);

create or replace function private.generate_household_bill_periods(p_horizon_months integer default 2)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created integer := 0;
begin
  insert into public.household_bill_periods (
    household_id, bill_id, period_month, amount_cents, due_at
  )
  select
    bill.household_id,
    bill.id,
    bill_month.period_month,
    bill.amount_cents,
    make_timestamptz(
      extract(year from bill_month.period_month)::integer,
      extract(month from bill_month.period_month)::integer,
      bill.due_day,
      9, 0, 0,
      household.timezone
    )
  from public.household_bills bill
  join public.households household on household.id = bill.household_id
  cross join generate_series(0, greatest(0, least(p_horizon_months, 12))) horizon(month_offset)
  cross join lateral (
    select (
      date_trunc('month', now() at time zone household.timezone)
      + make_interval(months => horizon.month_offset)
    )::date as period_month
  ) bill_month
  where bill.active
  on conflict (bill_id, period_month) do nothing;
  get diagnostics v_created = row_count;
  return v_created;
end
$$;

create or replace function private.enqueue_household_bill_reminders()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.notification_outbox (
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select
    period.household_id,
    target.member_id,
    'household_bill_due',
    'household_bill_period',
    period.id,
    period.due_at - make_interval(days => reminder_day),
    bill.name || ' is due',
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
  where period.due_at - make_interval(days => reminder_day) <= now()
    and period.due_at - make_interval(days => reminder_day) > now() - interval '2 minutes'
    and not exists (
      select 1
      from public.household_bill_payments payment
      where payment.period_id = period.id and payment.member_id = target.member_id
    )
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end
$$;

create or replace function private.process_household_bills()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_periods integer;
  v_reminders integer;
begin
  v_periods := private.generate_household_bill_periods(2);
  v_reminders := private.enqueue_household_bill_reminders();
  return jsonb_build_object('periods', v_periods, 'reminders', v_reminders);
end
$$;

create or replace function private.upsert_household_bill_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_bill uuid := nullif(p_input->>'id', '')::uuid;
  v_target uuid;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if trim(coalesce(p_input->>'name', '')) = '' then raise exception 'Bill name is required'; end if;

  if v_bill is null then
    insert into public.household_bills (
      household_id, name, category, amount_cents, due_day,
      reminder_days_before, created_by
    ) values (
      v_household,
      trim(p_input->>'name'),
      coalesce(nullif(p_input->>'category', ''), 'other'),
      nullif(p_input->>'amountCents', '')::integer,
      coalesce((p_input->>'dueDay')::smallint, 1),
      coalesce(
        array(select value::integer from jsonb_array_elements_text(p_input->'reminderDaysBefore')),
        array[7,3,1,0]
      ),
      v_member
    ) returning id into v_bill;
  else
    update public.household_bills set
      name = trim(p_input->>'name'),
      category = coalesce(nullif(p_input->>'category', ''), category),
      amount_cents = nullif(p_input->>'amountCents', '')::integer,
      due_day = coalesce((p_input->>'dueDay')::smallint, due_day),
      reminder_days_before = coalesce(
        array(select value::integer from jsonb_array_elements_text(p_input->'reminderDaysBefore')),
        reminder_days_before
      ),
      active = coalesce((p_input->>'active')::boolean, active),
      updated_at = now()
    where id = v_bill
      and household_id = v_household;
    if not found then raise exception 'Bill not found'; end if;
  end if;

  delete from public.household_bill_members where bill_id = v_bill;
  for v_target in
    select value::uuid from jsonb_array_elements_text(coalesce(p_input->'memberIds', '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.household_members
      where id = v_target and household_id = v_household and active
    ) then
      raise exception 'Bill members must belong to this household';
    end if;
    insert into public.household_bill_members(household_id, bill_id, member_id)
    values (v_household, v_bill, v_target);
  end loop;

  if not exists (select 1 from public.household_bill_members where bill_id = v_bill) then
    raise exception 'Choose at least one roommate';
  end if;
  perform private.generate_household_bill_periods(2);
  return v_bill;
end
$$;

create or replace function public.upsert_household_bill(p_input jsonb)
returns uuid
language sql
security invoker
set search_path = ''
as $$ select private.upsert_household_bill_impl(p_input) $$;

create or replace function private.set_household_bill_paid_impl(
  p_period_id uuid,
  p_paid boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period public.household_bill_periods%rowtype;
  v_member uuid;
begin
  select * into v_period
  from public.household_bill_periods
  where id = p_period_id
  for update;
  if not found then raise exception 'Bill period not found'; end if;

  v_member := private.current_member_id(v_period.household_id);
  if v_member is null or not exists (
    select 1 from public.household_bill_members
    where bill_id = v_period.bill_id and member_id = v_member
  ) then
    raise exception 'This bill is not assigned to you';
  end if;

  if p_paid then
    insert into public.household_bill_payments (
      household_id, period_id, member_id, marked_by
    ) values (
      v_period.household_id, v_period.id, v_member, v_member
    ) on conflict (period_id, member_id)
      do update set paid_at = now(), marked_by = excluded.marked_by;
    update public.notification_outbox
    set status = 'cancelled'
    where entity_id = v_period.id and member_id = v_member and status = 'pending';
  else
    delete from public.household_bill_payments
    where period_id = v_period.id and member_id = v_member;
  end if;
end
$$;

create or replace function public.set_household_bill_paid(p_period_id uuid, p_paid boolean)
returns void
language sql
security invoker
set search_path = ''
as $$ select private.set_household_bill_paid_impl(p_period_id, p_paid) $$;

create trigger audit_household_bills
after insert or update or delete on public.household_bills
for each row execute function private.audit_row_change();
create trigger audit_household_bill_payments
after insert or update or delete on public.household_bill_payments
for each row execute function private.audit_row_change();

alter table public.household_bills enable row level security;
alter table public.household_bill_members enable row level security;
alter table public.household_bill_periods enable row level security;
alter table public.household_bill_payments enable row level security;

create policy household_bills_household_select
on public.household_bills for select to authenticated
using ((select private.is_household_member(household_id)));
create policy household_bill_members_household_select
on public.household_bill_members for select to authenticated
using ((select private.is_household_member(household_id)));
create policy household_bill_periods_household_select
on public.household_bill_periods for select to authenticated
using ((select private.is_household_member(household_id)));
create policy household_bill_payments_household_select
on public.household_bill_payments for select to authenticated
using ((select private.is_household_member(household_id)));

grant select on public.household_bills, public.household_bill_members,
  public.household_bill_periods, public.household_bill_payments to authenticated;
revoke insert, update, delete on public.household_bills, public.household_bill_members,
  public.household_bill_periods, public.household_bill_payments from authenticated, anon;

revoke all on function private.generate_household_bill_periods(integer) from public, anon, authenticated;
revoke all on function private.enqueue_household_bill_reminders() from public, anon, authenticated;
revoke all on function private.process_household_bills() from public, anon, authenticated;
revoke all on function private.upsert_household_bill_impl(jsonb) from public, anon;
revoke all on function private.set_household_bill_paid_impl(uuid, boolean) from public, anon;
grant execute on function private.generate_household_bill_periods(integer) to service_role;
grant execute on function private.enqueue_household_bill_reminders() to service_role;
grant execute on function private.process_household_bills() to service_role;
grant execute on function private.upsert_household_bill_impl(jsonb) to authenticated;
grant execute on function private.set_household_bill_paid_impl(uuid, boolean) to authenticated;

revoke all on function public.upsert_household_bill(jsonb) from public, anon;
revoke all on function public.set_household_bill_paid(uuid, boolean) from public, anon;
grant execute on function public.upsert_household_bill(jsonb) to authenticated;
grant execute on function public.set_household_bill_paid(uuid, boolean) to authenticated;

do $$
begin
  begin
    alter publication supabase_realtime add table public.household_bills;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.household_bill_periods;
  exception when duplicate_object then null;
  end;
  begin
    alter publication supabase_realtime add table public.household_bill_payments;
  exception when duplicate_object then null;
  end;
end
$$;

select cron.schedule(
  'howsehowld-process-household-bills',
  '* * * * *',
  $$select private.process_household_bills()$$
);
