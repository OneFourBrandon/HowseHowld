begin;
create extension if not exists pgtap with schema extensions;
select plan(6);
select vault.create_secret(repeat('a',64),'dispatch_secret')
where not exists (select 1 from vault.secrets where name='dispatch_secret');
select ok(public.verify_push_dispatch_secret((select decrypted_secret from vault.decrypted_secrets where name='dispatch_secret')),
  'Vault credential authorizes scheduled dispatch');
select is(public.verify_push_dispatch_secret(repeat('wrong',12)),false,'incorrect credential is rejected');
select is(public.verify_push_dispatch_secret(null),false,'missing credential is rejected');
select ok(not has_function_privilege('anon','public.verify_push_dispatch_secret(text)','execute'),'anonymous callers cannot validate dispatch credentials');
select ok(not has_function_privilege('authenticated','public.verify_push_dispatch_secret(text)','execute'),'household clients cannot validate dispatch credentials');
select ok(has_function_privilege('service_role','public.verify_push_dispatch_secret(text)','execute'),'only server service role can validate dispatch credentials');
select * from finish();
rollback;
