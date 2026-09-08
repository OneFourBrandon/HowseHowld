import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('admin penalty tiers drive new infractions without changing existing amounts', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role authenticated; create role anon; create role service_role;
      create schema private;
      create type public.infraction_status as enum ('pending','disputed','upheld','excused','paid');
      create type public.infraction_vote_choice as enum ('uphold','excuse');
      create table public.households(id uuid primary key);
      create table public.household_members(id uuid primary key, household_id uuid, role text, active boolean default true);
      create table public.task_definitions(id uuid, household_id uuid, active boolean, recurrence jsonb);
      create table public.task_occurrences(id uuid primary key, household_id uuid, assignee_member_id uuid, status text, due_at timestamptz);
      create table public.infractions(id uuid default gen_random_uuid(), household_id uuid, occurrence_id uuid unique,
        member_id uuid, amount_cents integer constraint infractions_amount_cents_check check(amount_cents between 0 and 3000),
        status public.infraction_status default 'pending', created_at timestamptz default now(), dispute_deadline timestamptz, ledger_transaction_id uuid, resolved_at timestamptz);
      create table public.infraction_votes(household_id uuid, infraction_id uuid, voter_member_id uuid,
        choice public.infraction_vote_choice, created_at timestamptz default now(), unique(infraction_id,voter_member_id));
      create table public.notification_outbox(entity_id uuid, status text);
      create function private.current_member_id(uuid) returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
      create function private.generate_task_occurrences(integer) returns integer language sql as $$ select 0 $$;
      create function private.generate_departure_occurrences(integer) returns integer language sql as $$ select 0 $$;
      create function private.enqueue_calendar_reminders() returns integer language sql as $$ select 0 $$;
      create function private.enqueue_departure_reminders() returns integer language sql as $$ select 0 $$;
      create function private.ensure_rolling_queue_occurrences_impl(uuid,integer) returns integer language sql as $$ select 0 $$;
      create function private.post_penalty(uuid) returns void language sql as $$ select $$;
      insert into households values ('00000000-0000-0000-0000-000000000001');
      insert into household_members values
        ('00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','owner',true),
        ('00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','member',true);
      grant usage on schema private to authenticated;
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260908163422_configurable_penalty_tiers.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../supabase/migrations/20260908171151_infraction_review_week.sql', import.meta.url), 'utf8'))
    assert.deepEqual((await db.query('select penalty_tiers from households')).rows[0].penalty_tiers, [1000,1500,2000,2500,3000])
    const save = "select public.update_penalty_tiers('00000000-0000-0000-0000-000000000001', $1::integer[])"
    await db.exec("set test.actor = '00000000-0000-0000-0000-000000000003'; set role authenticated;")
    await assert.rejects(db.query(save, [[500,2500,4000]]), /Only the admin/)
    await db.exec("set test.actor = '00000000-0000-0000-0000-000000000002';")
    for (const invalid of [[], [0], [100,null], [100,50]]) {
      await assert.rejects(db.query(save, [invalid]), /Choose 1 to 20/)
    }
    await db.query(save, [[500,2500,4000]])
    await db.exec(`reset role;
      insert into task_occurrences values ('00000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','assigned',now()-interval '1 hour');
      select private.process_due_work();
    `)
    assert.equal((await db.query('select amount_cents from infractions')).rows[0].amount_cents,500)
    assert.equal((await db.query("select dispute_deadline = created_at + interval '7 days' as week from infractions")).rows[0].week,true)
    await db.exec(`
      insert into infractions(household_id,member_id,amount_cents,status,created_at,dispute_deadline)
      select '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003',1000,'upheld',now()-interval '2 days',now()+interval '1 day' from generate_series(1,4);
      insert into task_occurrences values ('00000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000003','assigned',now()-interval '1 hour');
      select private.process_due_work();
    `)
    assert.equal((await db.query("select amount_cents from infractions where occurrence_id='00000000-0000-0000-0000-000000000005'")).rows[0].amount_cents,4000)
    await db.exec('set role authenticated;')
    await db.query(save, [[750]])
    await db.exec('reset role;')
    assert.equal((await db.query("select amount_cents from infractions where occurrence_id='00000000-0000-0000-0000-000000000004'")).rows[0].amount_cents,500)
    assert.equal((await db.query("select has_function_privilege('anon','public.update_penalty_tiers(uuid,integer[])','execute') as allowed")).rows[0].allowed,false)
    await db.exec("update infractions set status='disputed' where occurrence_id='00000000-0000-0000-0000-000000000004'; set test.actor = '00000000-0000-0000-0000-000000000003'; set role authenticated;")
    const vote = "select private.cast_infraction_vote_impl((select id from infractions where occurrence_id='00000000-0000-0000-0000-000000000004'), 'excuse') as status"
    await db.exec('reset role; grant select on infractions to authenticated; set role authenticated;')
    assert.equal((await db.query(vote)).rows[0].status,'disputed')
    assert.equal((await db.query(vote)).rows[0].status,'disputed', 'repeated self vote does not count twice')
    await db.exec("set test.actor = '';")
    await assert.rejects(db.query(vote), /Only household members/)
    await db.exec("set test.actor = '00000000-0000-0000-0000-000000000002';")
    assert.equal((await db.query(vote)).rows[0].status,'excused')
    await assert.rejects(db.query(vote), /closed/)
    await db.exec("reset role; update infractions set status='disputed', dispute_deadline=now() where occurrence_id='00000000-0000-0000-0000-000000000004'; set role authenticated;")
    await assert.rejects(db.query(vote), /closed/)
  } finally { await db.close() }
})
