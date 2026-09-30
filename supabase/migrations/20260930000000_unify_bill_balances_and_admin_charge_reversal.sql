-- Keep the person owed on each bill month so a future payer change cannot
-- silently rewrite older months.
alter table public.household_bills add column payee_member_id uuid references public.household_members(id);
alter table public.household_bill_periods add column payee_member_id uuid references public.household_members(id);

update public.household_bills set payee_member_id = created_by;
update public.household_bill_periods period
set payee_member_id = bill.payee_member_id
from public.household_bills bill where bill.id = period.bill_id;
alter table public.household_bills alter column payee_member_id set not null;
alter table public.household_bill_periods alter column payee_member_id set not null;

create function private.set_bill_payee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payee_member_id is null then new.payee_member_id := new.created_by; end if;
  return new;
end $$;
create trigger set_bill_payee before insert on public.household_bills
for each row execute function private.set_bill_payee();
revoke all on function private.set_bill_payee() from public, anon, authenticated;

create function private.set_bill_period_payee()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.payee_member_id is null then
    select payee_member_id into new.payee_member_id
    from public.household_bills where id = new.bill_id;
  end if;
  return new;
end $$;
create trigger set_bill_period_payee before insert on public.household_bill_periods
for each row execute function private.set_bill_period_payee();
revoke all on function private.set_bill_period_payee() from public, anon, authenticated;

create function private.save_household_bill_with_payee_impl(p_input jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_bill_id uuid;
  v_household uuid := (p_input->>'householdId')::uuid;
  v_payee uuid := nullif(p_input->>'payeeMemberId','')::uuid;
  v_month date;
  v_current_month date;
begin
  if v_payee is not null and not exists (
    select 1 from public.household_members
    where id = v_payee and household_id = v_household and active
  ) then raise exception 'Choose an active household member to receive this bill'; end if;
  v_bill_id := private.save_household_bill_impl(p_input);
  if v_payee is null then return v_bill_id; end if;
  select date_trunc('month', now() at time zone timezone)::date
    into v_current_month from public.households where id = v_household;
  v_month := coalesce(nullif(p_input->>'periodMonth','')::date, v_current_month);
  update public.household_bills set payee_member_id = v_payee where id = v_bill_id;
  update public.household_bill_periods
  set payee_member_id = v_payee
  where bill_id = v_bill_id and period_month >= greatest(v_month,v_current_month);
  -- An explicitly selected older month may be corrected without touching the
  -- other historical months.
  if v_month < v_current_month then
    update public.household_bill_periods set payee_member_id = v_payee
    where bill_id = v_bill_id and period_month = v_month;
  end if;
  return v_bill_id;
end $$;
revoke all on function private.save_household_bill_with_payee_impl(jsonb) from public, anon;
grant execute on function private.save_household_bill_with_payee_impl(jsonb) to authenticated;
create or replace function public.save_household_bill(p_input jsonb)
returns uuid language sql security invoker set search_path = '' as $$
  select private.save_household_bill_with_payee_impl(p_input)
$$;

-- Bills and purchases now contribute to the same zero-sum balance. A marked
-- payment clears only that roommate's obligation to the bill payer.
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
    and not exists (select 1 from public.household_bill_payments payment
      where payment.period_id = period.id and payment.member_id = share.member_id)
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

create or replace function private.reverse_expense_impl(p_expense_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_expense public.expenses%rowtype;
  v_member uuid;
  v_reversal uuid;
begin
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Expense not found'; end if;
  v_member := private.current_member_id(v_expense.household_id);
  if v_member is null or (v_member <> v_expense.created_by
    and not private.is_household_owner(v_expense.household_id)) then
    raise exception 'Only the creator or admin can delete this charge';
  end if;
  if v_expense.reversed_at is not null then raise exception 'Charge already deleted'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'A reason is required'; end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, reversal_of, description, created_by, posted_at
  ) values (
    v_expense.household_id, 'expense_reversal', p_expense_id,
    v_expense.transaction_id, 'Reversal: ' || trim(p_reason), v_member, now()
  ) returning id into v_reversal;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, household_fund, amount_cents,
    contribution_cents, resource_use_cents, settlement_adjustment_cents, fund_liability_cents
  )
  select household_id, v_reversal, member_id, household_fund, -amount_cents,
         -contribution_cents, -resource_use_cents, -settlement_adjustment_cents, -fund_liability_cents
  from public.ledger_entries where transaction_id = v_expense.transaction_id;
  perform private.assert_balanced_transaction(v_reversal);
  update public.expenses set reversed_at = now(), reversal_reason = trim(p_reason)
  where id = p_expense_id;
  return v_reversal;
end $$;
