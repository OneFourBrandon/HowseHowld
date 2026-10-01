begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('30000000-0000-0000-0000-00000000000' || n)::uuid,
  'authenticated','authenticated','bill' || n || '@example.com',
  '{"provider":"email","providers":["email"]}','{}',now(),now()
from generate_series(1,3) n;
insert into public.households(id,name,created_by) values
  ('31000000-0000-0000-0000-000000000000','Bill balance tests','30000000-0000-0000-0000-000000000001');
insert into public.household_members(id,household_id,profile_id,role) values
  ('32000000-0000-0000-0000-000000000001','31000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000001','owner'),
  ('32000000-0000-0000-0000-000000000002','31000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000002','member'),
  ('32000000-0000-0000-0000-000000000003','31000000-0000-0000-0000-000000000000','30000000-0000-0000-0000-000000000003','member');

set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select set_config('test.bill_id',public.save_household_bill(jsonb_build_object(
  'householdId','31000000-0000-0000-0000-000000000000',
  'name','Rent','category','rent','amountCents',30000,'dueDay',1,
  'payeeMemberId','32000000-0000-0000-0000-000000000002',
  'reminderDaysBefore',jsonb_build_array(1,0),
  'members',jsonb_build_array(
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000001','shareWeight',1),
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000002','shareWeight',1),
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000003','shareWeight',1)
  )))::text,true);
select is((select payee_member_id from public.household_bills where id=current_setting('test.bill_id')::uuid),
  '32000000-0000-0000-0000-000000000002'::uuid,'bill records its payer');
select is((select count(*)::integer from public.household_bill_periods where bill_id=current_setting('test.bill_id')::uuid),
  3,'monthly periods generated');
select is((select net_cents from public.member_balances where member_id='32000000-0000-0000-0000-000000000001'),
  -10000::bigint,'owner owes payer one share');
select is((select net_cents from public.member_balances where member_id='32000000-0000-0000-0000-000000000002'),
  20000::bigint,'payer receives the other two shares');
select is((select sum(net_cents) from public.member_balances where household_id='31000000-0000-0000-0000-000000000000'),
  0::numeric,'combined bill balances remain zero sum');
select set_config('test.period_id',(select id::text from public.household_bill_periods
  where bill_id=current_setting('test.bill_id')::uuid
    and period_month=date_trunc('month',now() at time zone 'America/Toronto')::date),true);
select throws_ok($$select public.set_household_bill_member_paid(current_setting('test.period_id')::uuid,
  '32000000-0000-0000-0000-000000000001',true)$$,'P0001','Record a direct payment through Settle up instead','admin checkbox API is disabled');
select set_config('test.direct_payment',public.propose_settlement('32000000-0000-0000-0000-000000000002',10000,'Bill share')::text,true);
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
select public.confirm_settlement(current_setting('test.direct_payment')::uuid,true);
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select is((select net_cents from public.member_balances where member_id='32000000-0000-0000-0000-000000000001'),
  0::bigint,'confirmed direct payment clears one balance');
select is((select net_cents from public.member_balances where member_id='32000000-0000-0000-0000-000000000002'),
  10000::bigint,'payer credit decreases by the same amount');
select set_config('test.future_month',to_char(
  date_trunc('month',now() at time zone 'America/Toronto') + interval '1 month','YYYY-MM-DD'),true);
select lives_ok($$select public.save_household_bill(jsonb_build_object(
  'id',current_setting('test.bill_id'),'householdId','31000000-0000-0000-0000-000000000000',
  'name','Rent','category','rent','amountCents',30000,'dueDay',1,
  'periodMonth',current_setting('test.future_month'),
  'payeeMemberId','32000000-0000-0000-0000-000000000001',
  'reminderDaysBefore',jsonb_build_array(1,0),
  'members',jsonb_build_array(
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000001','shareWeight',1),
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000002','shareWeight',1),
    jsonb_build_object('memberId','32000000-0000-0000-0000-000000000003','shareWeight',1)
  )))$$,'admin changes who is owed starting next month');
select is((select payee_member_id from public.household_bill_periods where id=current_setting('test.period_id')::uuid),
  '32000000-0000-0000-0000-000000000002'::uuid,'current month keeps the original payer');
select is((select payee_member_id from public.household_bill_periods
  where bill_id=current_setting('test.bill_id')::uuid and period_month=current_setting('test.future_month')::date),
  '32000000-0000-0000-0000-000000000001'::uuid,'future month uses the new payer');

select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000002',true);
select set_config('test.expense_id',public.create_expense(jsonb_build_object(
  'householdId','31000000-0000-0000-0000-000000000000','title','Groceries','amountCents',1000,
  'payers',jsonb_build_array(jsonb_build_object('memberId','32000000-0000-0000-0000-000000000002','amountCents',1000)),
  'beneficiaries',jsonb_build_array(jsonb_build_object('memberId','32000000-0000-0000-0000-000000000001','amountCents',1000))
))::text,true);
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.reverse_expense(current_setting('test.expense_id')::uuid,'Duplicate charge')$$,
  'P0001','Only the creator or admin can delete this charge','another roommate cannot delete charge');
select set_config('request.jwt.claim.sub','30000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.reverse_expense(current_setting('test.expense_id')::uuid,'Duplicate charge')$$,
  'admin deletes a charge created by a roommate');
select ok((select reversed_at is not null from public.expenses where id=current_setting('test.expense_id')::uuid),
  'deleted charge retains an audit trail');
select is((select net_cents from public.member_balances where member_id='32000000-0000-0000-0000-000000000001'),
  0::bigint,'reversal restores the unified balance');
select throws_ok($$select public.reverse_expense(current_setting('test.expense_id')::uuid,'Duplicate charge')$$,
  'P0001','Charge already deleted','charge cannot be deleted twice');
reset role;
select ok(position('apikey' in pg_get_functiondef('private.dispatch_scheduled_push()'::regprocedure)) > 0,
  'scheduled push includes gateway API key');
select ok((select active from cron.job where jobname='howsehowld-dispatch-web-push'),
  'push dispatcher is scheduled');

select * from finish();
rollback;
