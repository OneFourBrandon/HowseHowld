import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('pending missed tasks accept votes and admins can forgive posted penalties', async () => {
  const db = new PGlite()
  const h = '00000000-0000-0000-0000-000000000001'
  const admin = '00000000-0000-0000-0000-000000000002'
  const member = '00000000-0000-0000-0000-000000000003'
  const other = '00000000-0000-0000-0000-000000000004'
  const occurrence = '00000000-0000-0000-0000-000000000005'
  const infraction = '00000000-0000-0000-0000-000000000006'
  const transaction = '00000000-0000-0000-0000-000000000007'
  try {
    await db.exec(`create role authenticated; create role anon; create schema private;
      create type public.infraction_vote_choice as enum ('uphold','excuse');
      create type public.infraction_status as enum ('pending','disputed','upheld','excused','paid');
      create type public.ledger_transaction_type as enum ('expense','penalty');
      create table public.household_members(id uuid primary key,household_id uuid,active boolean,role text);
      create table public.task_occurrences(id uuid primary key);
      create table public.infractions(id uuid primary key, household_id uuid, occurrence_id uuid, member_id uuid, amount_cents integer, status public.infraction_status, dispute_deadline timestamptz, resolved_at timestamptz, ledger_transaction_id uuid);
      create table public.infraction_votes(household_id uuid,infraction_id uuid,voter_member_id uuid,choice public.infraction_vote_choice,created_at timestamptz default now(),unique(infraction_id,voter_member_id));
      create table public.ledger_transactions(id uuid primary key default gen_random_uuid(),household_id uuid,type public.ledger_transaction_type,source_id uuid,reversal_of uuid,description text,created_by uuid,posted_at timestamptz);
      create table public.ledger_entries(household_id uuid,transaction_id uuid,member_id uuid,household_fund boolean,amount_cents bigint,contribution_cents bigint default 0,resource_use_cents bigint default 0,settlement_adjustment_cents bigint default 0,fund_liability_cents bigint default 0);
      create function private.current_member_id(uuid) returns uuid language sql as $$select nullif(current_setting('test.actor',true),'')::uuid$$;
      create function private.assert_balanced_transaction(uuid) returns void language plpgsql as $$begin if (select sum(amount_cents) from public.ledger_entries where transaction_id=$1) <> 0 then raise exception 'unbalanced'; end if; end$$;
      grant usage on schema private to authenticated;
      insert into household_members values ('${admin}','${h}',true,'owner'),('${member}','${h}',true,'member'),('${other}','${h}',true,'member');
      insert into task_occurrences values ('${occurrence}');
      insert into infractions values ('${infraction}','${h}','${occurrence}','${member}',1000,'pending',now()+interval '1 day',null,null);`)
    await db.exec(await readFile('supabase/migrations/20260923224234_penalty_reversal_type.sql','utf8'))
    await db.exec(await readFile('supabase/migrations/20260923224309_admin_infraction_forgiveness.sql','utf8'))
    await db.exec(`set role authenticated; set test.actor='${other}'`)
    const vote = 'select private.cast_infraction_vote_impl($1,$2::public.infraction_vote_choice) as status'
    assert.equal((await db.query(vote,[infraction,'excuse'])).rows[0].status,'disputed')
    assert.equal((await db.query(vote,[infraction,'uphold'])).rows[0].status,'disputed', 'changing a vote does not count twice')
    await db.exec(`set test.actor='${member}'`)
    assert.equal((await db.query(vote,[infraction,'excuse'])).rows[0].status,'disputed')
    await db.exec(`set test.actor='${admin}'`)
    assert.equal((await db.query(vote,[infraction,'excuse'])).rows[0].status,'excused')
    await assert.rejects(db.query(vote,[infraction,'uphold']),/closed/)
    await db.exec(`reset role;
      update infractions set status='upheld',dispute_deadline=now()-interval '1 day',ledger_transaction_id='${transaction}' where id='${infraction}';
      insert into ledger_transactions(id,household_id,type,source_id,description) values ('${transaction}','${h}','penalty','${infraction}','Missed chore penalty');
      insert into ledger_entries(household_id,transaction_id,member_id,household_fund,amount_cents,fund_liability_cents) values
      ('${h}','${transaction}','${member}',false,-1000,1000),('${h}','${transaction}',null,true,1000,0);
      set role authenticated; set test.actor='${other}';`)
    const forgive = 'select public.forgive_infraction($1)'
    await assert.rejects(db.query(forgive,[infraction]),/Only the admin/)
    await db.exec(`set test.actor='${admin}'`)
    await db.query(forgive,[infraction])
    await db.query(forgive,[infraction])
    await db.exec('reset role')
    assert.equal((await db.query(`select status from infractions where id='${infraction}'`)).rows[0].status,'excused')
    assert.deepEqual((await db.query('select sum(amount_cents)::integer as amount, sum(fund_liability_cents)::integer as liability from ledger_entries')).rows,[{amount:0,liability:0}])
    assert.equal((await db.query("select count(*)::integer as n from ledger_transactions where type='penalty_reversal'")).rows[0].n,1)
    assert.equal((await db.query("select has_function_privilege('anon','public.forgive_infraction(uuid)','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})
