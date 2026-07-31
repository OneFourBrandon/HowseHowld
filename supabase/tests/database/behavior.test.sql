begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'owner@example.com', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'member@example.com', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'authenticated', 'authenticated', 'other@example.com', '', now(),
    '{"provider":"email","providers":["email"]}', '{}', now(), now()
  );

insert into public.households (id, name, created_by) values
  (
    '10000000-0000-0000-0000-000000000000',
    'First house',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000000',
    'Other house',
    '00000000-0000-0000-0000-000000000003'
  );

insert into public.household_members (id, household_id, profile_id, role) values
  (
    '11000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000001',
    'owner'
  ),
  (
    '11000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000002',
    'member'
  ),
  (
    '21000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000000',
    '00000000-0000-0000-0000-000000000003',
    'owner'
  );

insert into public.driveway_state (household_id) values
  ('10000000-0000-0000-0000-000000000000'),
  ('20000000-0000-0000-0000-000000000000');

insert into public.task_definitions (
  id, household_id, title, assignment_mode, created_by
) values
  (
    '12000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000000',
    'First task',
    'fixed',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '22000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000000',
    'Private task',
    'fixed',
    '21000000-0000-0000-0000-000000000003'
  );

insert into public.vehicles (
  id, household_id, owner_member_id, label
) values
  (
    '13000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000000',
    '11000000-0000-0000-0000-000000000001',
    'Street car'
  ),
  (
    '13000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000000',
    '11000000-0000-0000-0000-000000000002',
    'Back car'
  ),
  (
    '23000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000000',
    '21000000-0000-0000-0000-000000000003',
    'Other car'
  );

insert into public.household_bills (
  id, household_id, name, category, amount_cents, due_day, created_by
) values
  (
    '14000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000000',
    'Rent', 'rent', 300000, 1,
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '24000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000000',
    'Private hydro', 'electricity', 9000, 15,
    '21000000-0000-0000-0000-000000000003'
  );
insert into public.household_bill_members (household_id, bill_id, member_id) values
  (
    '10000000-0000-0000-0000-000000000000',
    '14000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000000',
    '14000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000002'
  ),
  (
    '20000000-0000-0000-0000-000000000000',
    '24000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000003'
  );
insert into public.household_bill_periods (
  id, household_id, bill_id, period_month, amount_cents, due_at
) values
  (
    '15000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000000',
    '14000000-0000-0000-0000-000000000001',
    date_trunc('month', current_date)::date,
    300000,
    now() + interval '2 days'
  );

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);

select is(
  (select count(*)::integer from public.households),
  1,
  'RLS exposes only the signed-in member household'
);
select is(
  (select count(*)::integer from public.task_definitions),
  1,
  'RLS isolates task definitions between households'
);
select is(
  (select count(*)::integer from public.household_bills),
  1,
  'RLS isolates monthly bills between households'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);
select lives_ok(
  $$select public.set_household_bill_paid(
    '15000000-0000-0000-0000-000000000001',
    true
  )$$,
  'an assigned roommate can check off their own payment'
);
select is(
  (
    select member_id
    from public.household_bill_payments
    where period_id = '15000000-0000-0000-0000-000000000001'
  ),
  '11000000-0000-0000-0000-000000000002'::uuid,
  'the payment RPC always records the signed-in member'
);
select throws_ok(
  $$select public.rotate_household_share_code(
    '10000000-0000-0000-0000-000000000000'
  )$$,
  'P0001',
  'Only the household owner can rotate the share code',
  'non-owners cannot rotate household share codes'
);

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);
select lives_ok(
  $$select public.rotate_household_share_code(
    '10000000-0000-0000-0000-000000000000'
  )$$,
  'owners can rotate household share codes'
);
update public.households
set enabled_features = '["chores","money"]'::jsonb
where id = '10000000-0000-0000-0000-000000000000';
select is(
  (
    select enabled_features
    from public.households
    where id = '10000000-0000-0000-0000-000000000000'
  ),
  '["chores","money"]'::jsonb,
  'owners can update household feature settings'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
);
update public.households
set enabled_features = '["notifications"]'::jsonb
where id = '10000000-0000-0000-0000-000000000000';
select is(
  (
    select enabled_features
    from public.households
    where id = '10000000-0000-0000-0000-000000000000'
  ),
  '["chores","money"]'::jsonb,
  'non-owners cannot update household feature settings'
);
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);
select is(
  has_table_privilege('authenticated', 'public.expenses', 'UPDATE'),
  false,
  'authenticated users cannot mutate immutable expenses directly'
);
select is(
  has_function_privilege('anon', 'public.create_household_v2(jsonb)', 'EXECUTE'),
  false,
  'anonymous callers cannot execute authenticated mutation RPCs'
);
update public.task_definitions
set title = 'Leaked'
where id = '22000000-0000-0000-0000-000000000001';
reset role;
select is(
  (
    select title
    from public.task_definitions
    where id = '22000000-0000-0000-0000-000000000001'
  ),
  'Private task',
  'RLS blocks cross-household task updates'
);
set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  true
);
select is(
  public.reorder_driveway(
    '10000000-0000-0000-0000-000000000000',
    0,
    array[
      '13000000-0000-0000-0000-000000000002'::uuid,
      '13000000-0000-0000-0000-000000000001'::uuid
    ]
  ),
  1::bigint,
  'a valid driveway reorder atomically increments the version'
);
select throws_ok(
  $$select public.reorder_driveway(
    '10000000-0000-0000-0000-000000000000',
    0,
    array[
      '13000000-0000-0000-0000-000000000001'::uuid,
      '13000000-0000-0000-0000-000000000002'::uuid
    ]
  )$$,
  'P0001',
  'Driveway changed; refresh and try again',
  'stale driveway versions cannot overwrite current state'
);
select throws_ok(
  $$select public.reorder_driveway(
    '10000000-0000-0000-0000-000000000000',
    1,
    array[
      '13000000-0000-0000-0000-000000000001'::uuid,
      '23000000-0000-0000-0000-000000000001'::uuid
    ]
  )$$,
  'P0001',
  'The lineup must include every active vehicle exactly once',
  'a lineup cannot import a vehicle from another household'
);

reset role;
select * from finish();
rollback;
