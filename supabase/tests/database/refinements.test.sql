-- Transactional regression coverage; run only against a disposable test backend.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
  'refinement' || n || '@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()
from generate_series(1,3) n;
insert into public.households (id,name,created_by) values
  ('10000000-0000-0000-0000-000000000000','Refinement tests','00000000-0000-0000-0000-000000000001');
insert into public.household_members (id,household_id,profile_id,role) values
  ('11000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000001','owner'),
  ('11000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000000','00000000-0000-0000-0000-000000000002','member');
insert into public.driveway_state(household_id) values ('10000000-0000-0000-0000-000000000000');
update public.profiles set display_name='Original roommate', avatar_color='#4c927f',
  avatar_path='00000000-0000-0000-0000-000000000002/11111111-1111-4111-8111-111111111111.jpg',
  onboarding_completed_at='2026-08-01T12:00:00Z' where id='00000000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select lives_ok($$select public.set_driveway_layout('10000000-0000-0000-0000-000000000000',2,1)$$,'owner can save width and garage');
select is((select driveway_width from public.households),2,'driveway width persisted');
select throws_ok($$select public.set_driveway_layout('10000000-0000-0000-0000-000000000000',0,1)$$,'P0001','Invalid driveway size','invalid dimensions rejected');

select set_config('test.expense_id', public.create_expense('{
  "householdId":"10000000-0000-0000-0000-000000000000","title":"Tax correction","amountCents":1000,
  "payers":[{"memberId":"11000000-0000-0000-0000-000000000001","amountCents":1000}],
  "beneficiaries":[{"memberId":"11000000-0000-0000-0000-000000000001","amountCents":500},{"memberId":"11000000-0000-0000-0000-000000000002","amountCents":500}]
}')::text,true);
select set_config('test.original_transaction',(select transaction_id::text from public.expenses where id=current_setting('test.expense_id')::uuid),true);
select lives_ok($$select public.update_expense_amount(current_setting('test.expense_id')::uuid,1131,1000)$$,'price correction succeeds');
select is((select sum(amount_cents) from public.expense_shares where expense_id=current_setting('test.expense_id')::uuid),1131::bigint,'rounded shares sum exactly to corrected total');
select is((select sum(amount_cents) from public.ledger_entries),0::numeric,'correction leaves ledger balanced');
select is((select sum(contribution_cents) from public.ledger_entries where transaction_id=current_setting('test.original_transaction')::uuid),1000::numeric,'original ledger entries are unchanged');
select throws_ok($$select public.update_expense_amount(current_setting('test.expense_id')::uuid,1200,1000)$$,'P0001','This purchase changed. Reload it before editing.','stale edit rejected');
select lives_ok($$select public.update_expense_amount(current_setting('test.expense_id')::uuid,1200,1131)$$,'repeated correction succeeds');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
select throws_ok($$select public.set_driveway_layout('10000000-0000-0000-0000-000000000000',3,0)$$,'P0001','Only the household owner can change the layout','roommate cannot change layout');
select throws_ok($$select public.update_expense_amount(current_setting('test.expense_id')::uuid,1300,1200)$$,'P0001','Only the creator can edit this purchase','another roommate cannot edit the price');
select set_config('request.jwt.claims','{"is_anonymous":false}',true);
select set_config('test.recovery_code',public.issue_member_recovery_code('11000000-0000-0000-0000-000000000002'),true);
select ok(current_setting('test.recovery_code') like 'REC-%','email-linked roommate can still request a self-recovery code');

select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"is_anonymous":true}',true);
select is(public.redeem_member_recovery_code(current_setting('test.recovery_code'),'Ignore this new name'),'10000000-0000-0000-0000-000000000000'::uuid,'recovery succeeds for a new device');
select is((select display_name from public.profiles where id='00000000-0000-0000-0000-000000000003'),'Original roommate','recovery retains original name');
select is((select avatar_path from public.profiles where id='00000000-0000-0000-0000-000000000003'),'00000000-0000-0000-0000-000000000002/11111111-1111-4111-8111-111111111111.jpg','recovery retains avatar');
select is((select onboarding_completed_at from public.profiles where id='00000000-0000-0000-0000-000000000003'),'2026-08-01T12:00:00Z'::timestamptz,'recovery skips repeated profile onboarding');
select is(public.redeem_member_recovery_code(current_setting('test.recovery_code'),null),null::uuid,'recovery code is single use');
select throws_ok($$update public.profiles set avatar_path='00000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.jpg' where id='00000000-0000-0000-0000-000000000003'$$,'P0001','Choose a picture uploaded to your account','direct profile edit cannot inherit somebody else''s avatar');

reset role;
select * from finish();
rollback;
