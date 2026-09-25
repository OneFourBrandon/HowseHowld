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
    if not exists (select 1 from public.household_members where id = v_member and household_id = v_household and active and role = 'owner') then
      raise exception 'Only the admin can edit bills';
    end if;
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


create or replace function private.edit_household_bill_impl(
  p_bill_id uuid, p_category text, p_amount_cents integer,
  p_period_month date, p_monthly_amount_cents integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_bill public.household_bills%rowtype;
  v_timezone text;
begin
  select * into v_bill from public.household_bills where id = p_bill_id and active for update;
  if not found then raise exception 'Bill not found'; end if;
  if not exists (select 1 from public.household_members
    where id = private.current_member_id(v_bill.household_id)
      and household_id = v_bill.household_id and active and role = 'owner') then
    raise exception 'Only the admin can edit bills';
  end if;
  if p_period_month is null or p_period_month <> date_trunc('month', p_period_month)::date then
    raise exception 'Choose a valid month';
  end if;
  update public.household_bills set category = p_category, amount_cents = p_amount_cents, updated_at = now() where id = p_bill_id;
  select timezone into v_timezone from public.households where id = v_bill.household_id;
  insert into public.household_bill_periods(household_id, bill_id, period_month, amount_cents, due_at)
  values (v_bill.household_id, p_bill_id, p_period_month, coalesce(p_monthly_amount_cents, p_amount_cents),
    make_timestamptz(extract(year from p_period_month)::integer, extract(month from p_period_month)::integer, v_bill.due_day, 9, 0, 0, v_timezone))
  on conflict (bill_id, period_month) do update set amount_cents = excluded.amount_cents;
end
$$;
create or replace function public.edit_household_bill(
  p_bill_id uuid, p_category text, p_amount_cents integer,
  p_period_month date, p_monthly_amount_cents integer
) returns void language sql security invoker set search_path = '' as $$
  select private.edit_household_bill_impl(p_bill_id, p_category, p_amount_cents, p_period_month, p_monthly_amount_cents)
$$;
revoke all on function private.edit_household_bill_impl(uuid,text,integer,date,integer) from public, anon;
revoke all on function public.edit_household_bill(uuid,text,integer,date,integer) from public, anon;
grant execute on function private.edit_household_bill_impl(uuid,text,integer,date,integer) to authenticated;
grant execute on function public.edit_household_bill(uuid,text,integer,date,integer) to authenticated;
