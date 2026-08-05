alter table public.expenses
  add column category text not null default 'other'
  constraint expenses_category_check check (
    category in (
      'groceries',
      'household',
      'dining',
      'transportation',
      'utilities',
      'entertainment',
      'health',
      'other'
    )
  );

create or replace function private.create_expense_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_expense uuid := gen_random_uuid();
  v_transaction uuid;
  v_amount integer := (p_input->>'amountCents')::integer;
  v_category text := coalesce(nullif(p_input->>'category', ''), 'other');
  v_paid bigint;
  v_used bigint;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if v_category not in (
    'groceries',
    'household',
    'dining',
    'transportation',
    'utilities',
    'entertainment',
    'health',
    'other'
  ) then
    raise exception 'Invalid expense category';
  end if;
  select coalesce(sum((item->>'amountCents')::integer), 0) into v_paid
  from jsonb_array_elements(p_input->'payers') item;
  select coalesce(sum((item->>'amountCents')::integer), 0) into v_used
  from jsonb_array_elements(p_input->'beneficiaries') item;
  if v_amount <= 0 or v_paid <> v_amount or v_used <> v_amount then
    raise exception 'Payers and beneficiaries must each equal the expense total';
  end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, description, created_by, posted_at
  ) values (
    v_household, 'expense', v_expense, p_input->>'title', v_member, now()
  ) returning id into v_transaction;
  insert into public.expenses(
    id, household_id, transaction_id, title, amount_cents, purchased_at,
    created_by, receipt_path, category
  ) values (
    v_expense, v_household, v_transaction, trim(p_input->>'title'), v_amount,
    coalesce((p_input->>'purchasedAt')::timestamptz, now()), v_member,
    nullif(p_input->>'receiptPath', ''), v_category
  );
  insert into public.expense_payers(expense_id, household_id, member_id, amount_cents)
  select v_expense, v_household, (item->>'memberId')::uuid, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'payers') item;
  insert into public.expense_shares(expense_id, household_id, member_id, amount_cents)
  select v_expense, v_household, (item->>'memberId')::uuid, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'beneficiaries') item;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, contribution_cents
  )
  select v_household, v_transaction, (item->>'memberId')::uuid,
         (item->>'amountCents')::integer, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'payers') item;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, resource_use_cents
  )
  select v_household, v_transaction, (item->>'memberId')::uuid,
         -((item->>'amountCents')::integer), (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'beneficiaries') item;
  perform private.assert_balanced_transaction(v_transaction);
  return v_expense;
end
$$;
