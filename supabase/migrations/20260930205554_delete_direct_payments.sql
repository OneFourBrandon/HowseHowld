alter type public.ledger_transaction_type add value if not exists 'settlement_reversal';
alter table public.settlements add column reversed_at timestamptz, add column reversal_reason text;

create function private.delete_settlement_impl(p_settlement_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_payment public.settlements%rowtype;
  v_member uuid;
  v_reversal uuid;
begin
  select * into v_payment from public.settlements where id = p_settlement_id for update;
  if not found then raise exception 'Payment not found'; end if;
  v_member := private.current_member_id(v_payment.household_id);
  if v_member is null or (v_member <> v_payment.from_member_id
    and not private.is_household_owner(v_payment.household_id)) then
    raise exception 'Only the sender or admin can delete this payment';
  end if;
  if v_payment.reversed_at is not null then raise exception 'Payment already deleted'; end if;
  if p_reason is null or char_length(trim(p_reason)) < 3 then raise exception 'A reason is required'; end if;
  if v_payment.transaction_id is not null then
    insert into public.ledger_transactions(household_id,type,source_id,reversal_of,description,created_by,posted_at)
    values (v_payment.household_id,'settlement_reversal',v_payment.id,v_payment.transaction_id,
      'Deleted payment: ' || trim(p_reason),v_member,now()) returning id into v_reversal;
    insert into public.ledger_entries(household_id,transaction_id,member_id,household_fund,amount_cents,
      contribution_cents,resource_use_cents,settlement_adjustment_cents,fund_liability_cents)
    select household_id,v_reversal,member_id,household_fund,-amount_cents,
      -contribution_cents,-resource_use_cents,-settlement_adjustment_cents,-fund_liability_cents
    from public.ledger_entries where transaction_id = v_payment.transaction_id;
    perform private.assert_balanced_transaction(v_reversal);
  end if;
  -- Rejected status prevents an old confirmation request from posting a deleted payment.
  update public.settlements set reversed_at=now(),reversal_reason=trim(p_reason),status='rejected'
  where id=p_settlement_id;
end $$;
revoke all on function private.delete_settlement_impl(uuid,text) from public,anon;
grant execute on function private.delete_settlement_impl(uuid,text) to authenticated;
create function public.delete_settlement(p_settlement_id uuid,p_reason text)
returns void language sql security invoker set search_path = '' as $$
  select private.delete_settlement_impl(p_settlement_id,p_reason)
$$;
revoke all on function public.delete_settlement(uuid,text) from public,anon;
grant execute on function public.delete_settlement(uuid,text) to authenticated;
