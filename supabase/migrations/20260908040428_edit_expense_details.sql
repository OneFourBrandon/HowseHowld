-- Correct an expense total and/or beneficiary split while preserving immutable ledger history.
create or replace function private.update_expense_details_impl(
  p_expense_id uuid,
  p_amount integer,
  p_expected integer,
  p_beneficiaries jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.expenses%rowtype;
  actor uuid;
  reversal uuid;
  replacement uuid;
  shares jsonb;
  payers jsonb;
  item_count integer;
  member_count integer;
  share_total bigint;
  minimum_share integer;
begin
  select * into e from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Purchase not found'; end if;

  actor := private.current_member_id(e.household_id);
  if actor is null or actor <> e.created_by then
    raise exception 'Only the creator can edit this purchase';
  end if;
  if e.reversed_at is not null then raise exception 'This purchase was reversed'; end if;
  if p_expected is null or e.amount_cents <> p_expected then
    raise exception 'This purchase changed. Reload it before editing.';
  end if;
  if p_amount is null or p_amount < 1 then raise exception 'Enter a positive total'; end if;

  select jsonb_agg(jsonb_build_object('member_id', member_id, 'amount', next_amount) order by member_id)
  into payers
  from (
    select member_id,
      round(sum(amount_cents) over (order by member_id)::numeric * p_amount / e.amount_cents)
      - round((sum(amount_cents) over (order by member_id) - amount_cents)::numeric * p_amount / e.amount_cents) as next_amount
    from public.expense_payers
    where expense_id = e.id
  ) scaled;

  if p_beneficiaries is null then
    select jsonb_agg(jsonb_build_object('member_id', member_id, 'amount', next_amount) order by member_id)
    into shares
    from (
      select member_id,
        round(sum(amount_cents) over (order by member_id)::numeric * p_amount / e.amount_cents)
        - round((sum(amount_cents) over (order by member_id) - amount_cents)::numeric * p_amount / e.amount_cents) as next_amount
      from public.expense_shares
      where expense_id = e.id
    ) scaled;
  else
    if jsonb_typeof(p_beneficiaries) <> 'array' then raise exception 'Shares must be a list'; end if;
    select count(*), count(distinct member_id), coalesce(sum(amount), 0), coalesce(min(amount), 0)
      into item_count, member_count, share_total, minimum_share
    from jsonb_to_recordset(p_beneficiaries) as requested(member_id uuid, amount integer);
    if item_count < 1 or member_count <> item_count or minimum_share < 1 or share_total <> p_amount then
      raise exception 'Shares must be positive, unique, and equal the purchase total';
    end if;
    if exists (
      select 1
      from jsonb_to_recordset(p_beneficiaries) as requested(member_id uuid, amount integer)
      left join public.household_members member on member.id = requested.member_id
      where member.id is null or member.household_id <> e.household_id or not member.active
    ) then
      raise exception 'Every share must belong to an active household member';
    end if;
    select jsonb_agg(jsonb_build_object('member_id', member_id, 'amount', amount) order by member_id)
      into shares
    from jsonb_to_recordset(p_beneficiaries) as requested(member_id uuid, amount integer);
  end if;

  if exists (select 1 from jsonb_array_elements(payers || shares) item where (item->>'amount')::integer < 1) then
    raise exception 'The total is too small for this split';
  end if;

  insert into public.ledger_transactions(household_id, type, source_id, reversal_of, description, created_by, posted_at)
  values (e.household_id, 'expense_reversal', gen_random_uuid(), e.transaction_id, 'Purchase correction: ' || e.title, actor, now())
  returning id into reversal;
  insert into public.ledger_entries(household_id, transaction_id, member_id, household_fund, amount_cents, contribution_cents, resource_use_cents, settlement_adjustment_cents, fund_liability_cents)
  select household_id, reversal, member_id, household_fund, -amount_cents, -contribution_cents, -resource_use_cents, -settlement_adjustment_cents, -fund_liability_cents
  from public.ledger_entries where transaction_id = e.transaction_id;
  perform private.assert_balanced_transaction(reversal);

  insert into public.ledger_transactions(household_id, type, source_id, description, created_by, posted_at)
  values (e.household_id, 'expense', gen_random_uuid(), 'Corrected purchase: ' || e.title, actor, now())
  returning id into replacement;

  update public.expense_payers payer set amount_cents = (item->>'amount')::integer
  from jsonb_array_elements(payers) item
  where payer.expense_id = e.id and payer.member_id = (item->>'member_id')::uuid;

  delete from public.expense_shares where expense_id = e.id;
  insert into public.expense_shares(expense_id, household_id, member_id, amount_cents)
  select e.id, e.household_id, (item->>'member_id')::uuid, (item->>'amount')::integer
  from jsonb_array_elements(shares) item;

  insert into public.ledger_entries(household_id, transaction_id, member_id, amount_cents, contribution_cents)
  select e.household_id, replacement, member_id, amount_cents, amount_cents
  from public.expense_payers where expense_id = e.id;
  insert into public.ledger_entries(household_id, transaction_id, member_id, amount_cents, resource_use_cents)
  select e.household_id, replacement, member_id, -amount_cents, amount_cents
  from public.expense_shares where expense_id = e.id;
  perform private.assert_balanced_transaction(replacement);

  update public.expenses set amount_cents = p_amount, transaction_id = replacement where id = e.id;
end
$$;

revoke all on function private.update_expense_details_impl(uuid, integer, integer, jsonb) from public;
grant execute on function private.update_expense_details_impl(uuid, integer, integer, jsonb) to authenticated;

create or replace function public.update_expense_details(
  p_expense_id uuid,
  p_amount integer,
  p_expected integer,
  p_beneficiaries jsonb default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.update_expense_details_impl(p_expense_id, p_amount, p_expected, p_beneficiaries)
$$;

revoke all on function public.update_expense_details(uuid, integer, integer, jsonb) from public, anon;
grant execute on function public.update_expense_details(uuid, integer, integer, jsonb) to authenticated;
