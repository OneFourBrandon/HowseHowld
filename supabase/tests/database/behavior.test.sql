begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

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

select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  true
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
