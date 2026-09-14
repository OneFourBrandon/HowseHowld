import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('housemates can correct payers and shares with balanced immutable ledger history', async () => {
  const db = new PGlite()
  const id = n => `00000000-0000-0000-0000-${String(n).padStart(12,'0')}`
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema private;
      create table household_members(id uuid primary key, household_id uuid, active boolean default true);
      create function private.current_member_id(h uuid) returns uuid language sql as $$
        select id from public.household_members where household_id=h and active and id=nullif(current_setting('test.actor',true),'')::uuid $$;
      create table expenses(id uuid primary key, household_id uuid, created_by uuid, amount_cents integer, reversed_at timestamptz, transaction_id uuid, title text);
      create table expense_payers(expense_id uuid, household_id uuid, member_id uuid, amount_cents integer, unique(expense_id,member_id));
      create table expense_shares(like expense_payers including all);
      create table ledger_transactions(id uuid primary key default gen_random_uuid(), household_id uuid, type text, source_id uuid, reversal_of uuid, description text, created_by uuid, posted_at timestamptz);
      create table ledger_entries(household_id uuid, transaction_id uuid, member_id uuid, household_fund boolean default false, amount_cents integer, contribution_cents integer default 0, resource_use_cents integer default 0, settlement_adjustment_cents integer default 0, fund_liability_cents integer default 0);
      create function private.assert_balanced_transaction(t uuid) returns void language plpgsql as $$ begin
        if (select sum(amount_cents) from public.ledger_entries where transaction_id=t) <> 0 then raise exception 'Unbalanced'; end if;
      end $$;
      create function private.update_expense_details_impl(uuid,integer,integer,jsonb) returns void language sql as $$ select $$;
      create function public.update_expense_details(uuid,integer,integer,jsonb) returns void language sql as $$ select $$;
      grant usage on schema private to authenticated;
      insert into household_members values ('${id(2)}','${id(1)}',true),('${id(3)}','${id(1)}',true),('${id(4)}','${id(9)}',true),('${id(5)}','${id(1)}',false);
      insert into expenses values ('${id(6)}','${id(1)}','${id(2)}',1000,null,'${id(7)}','Test');
      insert into expense_payers values ('${id(6)}','${id(1)}','${id(2)}',1000);
      insert into expense_shares values ('${id(6)}','${id(1)}','${id(2)}',500),('${id(6)}','${id(1)}','${id(3)}',500);
      insert into ledger_entries(household_id,transaction_id,member_id,amount_cents,contribution_cents,resource_use_cents) values
        ('${id(1)}','${id(7)}','${id(2)}',1000,1000,0),('${id(1)}','${id(7)}','${id(2)}',-500,0,500),('${id(1)}','${id(7)}','${id(3)}',-500,0,500);
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260914062303_shared_purchase_editing.sql',import.meta.url),'utf8'))
    const edit = (shares=null,payers=null,amount=1000) => db.query('select public.update_expense_details($1,$2,1000,$3::jsonb,$4::jsonb)',[id(6),amount,shares===null?null:JSON.stringify(shares),payers===null?null:JSON.stringify(payers)])
    await db.exec(`set role authenticated; set test.actor='${id(4)}';`)
    await assert.rejects(edit(),/Not a household member/)
    await db.exec(`set test.actor='${id(3)}';`)
    await assert.rejects(edit(null,null,2000),/Only the creator/)
    for (const bad of [[], [{member_id:id(3),amount:999}], [{member_id:id(4),amount:1000}], [{member_id:id(5),amount:1000}], [{member_id:id(3),amount:null}], [{member_id:id(3),amount:500},{member_id:id(3),amount:500}]]) {
      await assert.rejects(edit(null,bad))
    }
    await edit(null,[{member_id:id(3),amount:1000}])
    await edit([{member_id:id(2),amount:1000}])
    await db.exec('reset role;')
    assert.deepEqual((await db.query('select member_id,amount_cents from expense_payers')).rows,[{member_id:id(3),amount_cents:1000}])
    assert.deepEqual((await db.query('select member_id,amount_cents from expense_shares')).rows,[{member_id:id(2),amount_cents:1000}])
    assert.deepEqual((await db.query('select member_id,sum(amount_cents)::int as net from ledger_entries group by member_id order by member_id')).rows,[{member_id:id(2),net:-1000},{member_id:id(3),net:1000}])
    assert.equal((await db.query('select count(*)::int as n from ledger_entries where transaction_id=$1',[id(7)])).rows[0].n,3)
    assert.equal((await db.query('select count(*)::int as n from ledger_transactions where created_by=$1',[id(3)])).rows[0].n,4)
    assert.equal((await db.query("select has_function_privilege('anon','public.update_expense_details(uuid,integer,integer,jsonb,jsonb)','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})
