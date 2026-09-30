begin;
create extension if not exists pgtap with schema extensions;
select plan(11);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select ('40000000-0000-0000-0000-00000000000'||n)::uuid,'authenticated','authenticated',
 'payment'||n||'@example.com','{"provider":"email","providers":["email"]}','{}',now(),now() from generate_series(1,3) n;
insert into public.households(id,name,created_by) values
 ('41000000-0000-0000-0000-000000000000','Payment tests','40000000-0000-0000-0000-000000000001');
insert into public.household_members(id,household_id,profile_id,role)
select ('42000000-0000-0000-0000-00000000000'||n)::uuid,'41000000-0000-0000-0000-000000000000',
 ('40000000-0000-0000-0000-00000000000'||n)::uuid,case when n=1 then 'owner'::public.household_role else 'member'::public.household_role end
from generate_series(1,3) n;
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
select set_config('test.payment',public.propose_settlement('42000000-0000-0000-0000-000000000003',1200,'Test payment')::text,true);
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
select lives_ok($$select public.confirm_settlement(current_setting('test.payment')::uuid,true)$$,'recipient confirms payment');
select is((select net_cents from public.member_balances where member_id='42000000-0000-0000-0000-000000000002'),1200::bigint,'confirmed payment affects sender balance');
select throws_ok($$select public.delete_settlement(current_setting('test.payment')::uuid,'Mistake')$$,'P0001','Only the sender or admin can delete this payment','recipient cannot delete another sender payment');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000001',true);
select throws_ok($$select public.delete_settlement(current_setting('test.payment')::uuid,null)$$,'P0001','A reason is required','deletion requires a reason');
select lives_ok($$select public.delete_settlement(current_setting('test.payment')::uuid,'Recorded by mistake')$$,'admin deletes confirmed payment');
select is((select net_cents from public.member_balances where member_id='42000000-0000-0000-0000-000000000002'),0::bigint,'sender balance restored');
select is((select net_cents from public.member_balances where member_id='42000000-0000-0000-0000-000000000003'),0::bigint,'recipient balance restored');
select throws_ok($$select public.delete_settlement(current_setting('test.payment')::uuid,'Mistake')$$,'P0001','Payment already deleted','double reversal prevented');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000002',true);
select set_config('test.pending',public.propose_settlement('42000000-0000-0000-0000-000000000003',500,'Pending payment')::text,true);
select lives_ok($$select public.delete_settlement(current_setting('test.pending')::uuid,'Mistake')$$,'sender can delete pending payment');
select set_config('request.jwt.claim.sub','40000000-0000-0000-0000-000000000003',true);
select throws_ok($$select public.confirm_settlement(current_setting('test.pending')::uuid,true)$$,'P0001','Settlement already resolved','deleted pending payment cannot be confirmed');
select ok(not has_function_privilege('anon','public.delete_settlement(uuid,text)','execute'),'anonymous role cannot delete payments');
select * from finish();
rollback;

