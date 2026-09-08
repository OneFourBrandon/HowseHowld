import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('emergency recovery keeps profile, avatar, membership and single-use protections', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role authenticated; create role anon;
      create schema private; create schema auth; create schema extensions; create schema storage;
      create type public.household_role as enum ('owner','member');
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql as $$ select '{"is_anonymous":true}'::jsonb $$;
      -- Crypto stubs only in this isolated fixture; production uses pgcrypto.
      create function extensions.digest(text,text) returns bytea language sql as $$ select convert_to($1,'UTF8') $$;
      create function extensions.gen_random_bytes(integer) returns bytea language sql as $$ select convert_to(md5(random()::text),'UTF8') $$;
      create function private.normalized_join_code(text) returns text language sql as $$ select upper($1) $$;
      create table public.profiles(id uuid primary key,display_name text,avatar_color text,avatar_path text,onboarding_completed_at timestamptz,account_kind text,updated_at timestamptz);
      create table public.household_members(id uuid primary key,household_id uuid,profile_id uuid,role public.household_role,active boolean default true);
      create table public.member_recovery_codes(id uuid default gen_random_uuid(),household_id uuid,member_id uuid,code_hash text,code_last4 text,created_by uuid,used_at timestamptz,revoked_at timestamptz,expires_at timestamptz default now()+interval '30 days');
      create table public.audit_events(household_id uuid,actor_member_id uuid,action text,entity_type text,entity_id uuid,before_data jsonb,after_data jsonb,summary text);
      create table storage.objects(bucket_id text,name text);
      create function private.current_member_id(uuid) returns uuid language sql as $$ select id from public.household_members where household_id=$1 and profile_id=auth.uid() and active $$;
      create function private.is_household_owner(uuid) returns boolean language sql as $$ select exists(select 1 from public.household_members where household_id=$1 and profile_id=auth.uid() and role='owner' and active) $$;
      insert into public.profiles values
        ('00000000-0000-0000-0000-000000000001','Original roommate','#123456','00000000-0000-0000-0000-000000000001/11111111-1111-4111-8111-111111111111.jpg','2026-08-01T00:00:00Z','house_code',now()),
        ('00000000-0000-0000-0000-000000000002','New device',null,null,null,'house_code',now());
      insert into public.household_members values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','member',true);
      grant usage on schema private,auth to authenticated;
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260908233008_reliable_anonymous_recovery.sql', import.meta.url),'utf8'))
    await db.exec("set test.actor='00000000-0000-0000-0000-000000000001'; set role authenticated;")
    const code = (await db.query("select private.issue_member_recovery_code_impl('10000000-0000-0000-0000-000000000001') as code")).rows[0].code
    await db.exec("set test.actor='00000000-0000-0000-0000-000000000002';")
    const result = await db.query('select private.redeem_member_recovery_code_impl($1,$2) as house',[code,'Wrong new name'])
    assert.equal(result.rows[0].house,'20000000-0000-0000-0000-000000000001')
    assert.equal((await db.query('select private.redeem_member_recovery_code_impl($1,null) as house',[code])).rows[0].house,null)
    await db.exec('reset role;')
    const restored = (await db.query("select * from public.profiles where id='00000000-0000-0000-0000-000000000002'")).rows[0]
    assert.equal(restored.display_name,'Original roommate')
    assert.match(restored.avatar_path,/000000000001\//)
    assert.equal(new Date(restored.onboarding_completed_at).toISOString(),'2026-08-01T00:00:00.000Z')
    assert.equal((await db.query('select profile_id from public.household_members')).rows[0].profile_id,restored.id)
    assert.equal((await db.query("select has_function_privilege('anon','private.redeem_member_recovery_code_impl(text,text)','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})
