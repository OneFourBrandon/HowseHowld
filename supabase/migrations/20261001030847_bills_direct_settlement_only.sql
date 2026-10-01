-- Retain old checkbox records privately; they are not direct payments.
create table private.retired_bill_payment_markers as table public.household_bill_payments;
alter table private.retired_bill_payment_markers enable row level security;
revoke all on private.retired_bill_payment_markers from public,anon,authenticated;
delete from public.household_bill_payments;

create or replace view public.member_balances with (security_invoker = true) as
with ledger as (
  select member_id, coalesce(sum(contribution_cents),0)::bigint contribution_cents,
    coalesce(sum(resource_use_cents),0)::bigint resource_use_cents,
    coalesce(sum(settlement_adjustment_cents),0)::bigint settlement_adjustment_cents,
    coalesce(sum(amount_cents),0)::bigint net_cents,
    coalesce(sum(fund_liability_cents),0)::bigint fund_owed_cents
  from public.ledger_entries group by member_id
), unpaid as (
  select period.household_id, period.payee_member_id, share.member_id,
    share.amount_cents::bigint amount_cents
  from public.household_bill_period_shares share
  join public.household_bill_periods period on period.id = share.period_id
  join public.households house on house.id = period.household_id
  where period.period_month <= date_trunc('month', now() at time zone house.timezone)::date
    and period.amount_cents is not null
    and share.member_id <> period.payee_member_id
), bill_balances as (
  select member_id, sum(credit)::bigint credit_cents, sum(debit)::bigint debit_cents
  from (
    select payee_member_id member_id, amount_cents credit, 0::bigint debit from unpaid
    union all
    select member_id, 0::bigint, amount_cents from unpaid
  ) items group by member_id
)
select hm.household_id, hm.id member_id,
  coalesce(ledger.contribution_cents,0) + coalesce(bill_balances.credit_cents,0) contribution_cents,
  coalesce(ledger.resource_use_cents,0) + coalesce(bill_balances.debit_cents,0) resource_use_cents,
  coalesce(ledger.settlement_adjustment_cents,0) settlement_adjustment_cents,
  coalesce(ledger.net_cents,0) + coalesce(bill_balances.credit_cents,0) - coalesce(bill_balances.debit_cents,0) net_cents,
  coalesce(ledger.fund_owed_cents,0) fund_owed_cents
from public.household_members hm
left join ledger on ledger.member_id = hm.id
left join bill_balances on bill_balances.member_id = hm.id
where hm.active;

create or replace function private.set_household_bill_paid_impl(p_period_id uuid,p_paid boolean) returns void language plpgsql security invoker set search_path = '' as $$ begin raise exception 'Record a direct payment through Settle up instead'; end $$;
create or replace function private.set_household_bill_member_paid_impl(p_period_id uuid,p_member_id uuid,p_paid boolean) returns void language plpgsql security invoker set search_path = '' as $$ begin raise exception 'Record a direct payment through Settle up instead'; end $$;
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
      when reminder_day = 0 then bill.name || ' is due today. Record a direct payment through Settle up.'
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
    and target.member_id <> period.payee_member_id
    and exists (select 1 from public.member_balances balance where balance.member_id = target.member_id and balance.net_cents < 0)
  on conflict do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
