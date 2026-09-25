-- An admin may excuse an infraction even after peer review has closed. Reversing
-- an already posted penalty keeps the ledger balanced and the audit trail intact.
create or replace function private.forgive_infraction_impl(p_infraction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_infraction public.infractions%rowtype;
  v_admin uuid;
  v_reversal uuid;
begin
  select * into v_infraction from public.infractions where id = p_infraction_id for update;
  if not found then raise exception 'Infraction not found'; end if;
  v_admin := private.current_member_id(v_infraction.household_id);
  if not exists (select 1 from public.household_members where id = v_admin
    and household_id = v_infraction.household_id and active and role = 'owner') then
    raise exception 'Only the admin can forgive an infraction';
  end if;
  if v_infraction.status = 'excused' then return; end if;
  if v_infraction.ledger_transaction_id is not null then
    insert into public.ledger_transactions(
      household_id, type, source_id, reversal_of, description, created_by, posted_at
    ) values (
      v_infraction.household_id, 'penalty_reversal', v_infraction.id,
      v_infraction.ledger_transaction_id, 'Admin forgave missed chore penalty', v_admin, now()
    ) returning id into v_reversal;
    insert into public.ledger_entries(
      household_id, transaction_id, member_id, household_fund, amount_cents,
      contribution_cents, resource_use_cents, settlement_adjustment_cents, fund_liability_cents
    )
    select household_id, v_reversal, member_id, household_fund, -amount_cents,
      -contribution_cents, -resource_use_cents, -settlement_adjustment_cents, -fund_liability_cents
    from public.ledger_entries where transaction_id = v_infraction.ledger_transaction_id;
    perform private.assert_balanced_transaction(v_reversal);
  end if;
  update public.infractions set status = 'excused', resolved_at = now() where id = p_infraction_id;
end
$$;
create or replace function public.forgive_infraction(p_infraction_id uuid)
returns void language sql security invoker set search_path = '' as $$
  select private.forgive_infraction_impl(p_infraction_id)
$$;
revoke all on function private.forgive_infraction_impl(uuid) from public, anon;
revoke all on function public.forgive_infraction(uuid) from public, anon;
grant execute on function private.forgive_infraction_impl(uuid) to authenticated;
grant execute on function public.forgive_infraction(uuid) to authenticated;

-- Roommates can vote on a newly missed task without waiting for its assignee
-- to open a dispute. This is also the path used on narrow mobile screens.
create or replace function private.cast_infraction_vote_impl(
  p_infraction_id uuid, p_vote public.infraction_vote_choice
)
returns public.infraction_status
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.infractions%rowtype;
  v_voter uuid;
  v_uphold integer;
  v_excuse integer;
  v_status public.infraction_status;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if not found or v_row.status not in ('pending', 'disputed') or now() >= v_row.dispute_deadline then
    raise exception 'This vote is closed';
  end if;
  v_voter := private.current_member_id(v_row.household_id);
  if v_voter is null then raise exception 'Only household members can vote'; end if;
  if p_vote is null then raise exception 'Choose excuse or uphold'; end if;
  insert into public.infraction_votes(household_id, infraction_id, voter_member_id, choice)
  values (v_row.household_id, p_infraction_id, v_voter, p_vote)
  on conflict (infraction_id, voter_member_id)
  do update set choice = excluded.choice, created_at = now();
  select count(*) filter (where choice = 'uphold'), count(*) filter (where choice = 'excuse')
  into v_uphold, v_excuse from public.infraction_votes where infraction_id = p_infraction_id;
  v_status := (case when v_uphold >= 2 then 'upheld'
    when v_excuse >= 2 then 'excused' else 'disputed' end)::public.infraction_status;
  update public.infractions set status = v_status,
    resolved_at = case when v_status <> 'disputed' then now() else resolved_at end
  where id = p_infraction_id;
  return v_status;
end
$$;
