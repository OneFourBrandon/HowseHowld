import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
test('bill editing enforces admin access and keeps other months and payments', async () => {
 const db = new PGlite()
 try {
  await db.exec(`create role authenticated; create role anon; create schema private;
  create table households(id uuid primary key, timezone text);
  create table household_members(id uuid primary key, household_id uuid, active boolean, role text);
  create function private.current_member_id(uuid) returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
  grant usage on schema private to authenticated;`)
  const original = await readFile('supabase/migrations/20260731025528_monthly_household_bills.sql','utf8')
  await db.exec(original.slice(original.indexOf('create table public.household_bills'),original.indexOf('create or replace function private.generate_household_bill_periods')))
  const migration = (await readdir('supabase/migrations')).find(name => name.endsWith('_admin_bill_editing.sql'))
  await db.exec(await readFile(`supabase/migrations/${migration}`,'utf8'))
  const h='00000000-0000-0000-0000-000000000001', owner='00000000-0000-0000-0000-000000000002', member='00000000-0000-0000-0000-000000000003', bill='00000000-0000-0000-0000-000000000004'
  await db.exec(`insert into households values ('${h}','America/Toronto'); insert into household_members values ('${owner}','${h}',true,'owner'),('${member}','${h}',true,'member');
  insert into household_bills(id,household_id,name,category,amount_cents,due_day,created_by) values ('${bill}','${h}','Hydro','other',10000,15,'${owner}');
  insert into household_bill_periods(household_id,bill_id,period_month,amount_cents,due_at) values ('${h}','${bill}','2026-09-01',10000,now()),('${h}','${bill}','2026-10-01',10000,now());
  insert into household_bill_payments(household_id,period_id,member_id,marked_by) select '${h}',id,'${member}','${member}' from household_bill_periods where period_month='2026-09-01';
  set role authenticated; set test.actor='${member}';`)
  const query='select public.edit_household_bill($1,$2,$3,$4,$5)'
  await assert.rejects(db.query(query,[bill,'electricity',12000,'2026-09-01',13500]), /Only the admin/)
  await db.exec(`set test.actor='${owner}'`)
  await db.query(query,[bill,'electricity',12000,'2026-09-01',13500])
  await assert.rejects(db.query(query,[bill,'invalid',12000,'2026-09-01',13500]))
  await assert.rejects(db.query(query,[bill,'gas',12000,'2026-09-01',-1]))
  await db.exec('reset role')
  assert.deepEqual((await db.query('select category, amount_cents from household_bills')).rows,[{category:'electricity',amount_cents:12000}])
  assert.deepEqual((await db.query('select amount_cents from household_bill_periods order by period_month')).rows.map(r=>r.amount_cents),[13500,10000])
  assert.equal((await db.query('select count(*)::integer as n from household_bill_payments')).rows[0].n,1)
  await db.query(query,[bill,'electricity',12000,'2026-11-01',null])
  assert.equal((await db.query("select amount_cents from household_bill_periods where period_month='2026-11-01'")).rows[0].amount_cents,12000)
  assert.equal((await db.query("select has_function_privilege('anon','public.edit_household_bill(uuid,text,integer,date,integer)','execute') as allowed")).rows[0].allowed,false)
 } finally { await db.close() }
})

test('future price changes preserve past snapshots and monthly bills stay pending', async () => {
 const db = new PGlite()
 try {
  await db.exec(`create role authenticated; create role anon; create schema private;
    create table households(id uuid primary key, timezone text);
    create table household_members(id uuid primary key, household_id uuid, active boolean, role text);
    create function private.current_member_id(uuid) returns uuid language sql as $$ select nullif(current_setting('test.actor',true),'')::uuid $$;
    create function private.is_household_owner(uuid) returns boolean language sql as $$
      select exists(select 1 from public.household_members where id=private.current_member_id($1) and household_id=$1 and active and role='owner') $$;
    grant usage on schema private to authenticated;`)
  const original = await readFile('supabase/migrations/20260731025528_monthly_household_bills.sql','utf8')
  await db.exec(original.slice(original.indexOf('create table public.household_bills'),original.indexOf('create or replace function private.generate_household_bill_periods')))
  await db.exec(await readFile('supabase/migrations/20260915000942_admin_bill_editing.sql','utf8'))
  await db.exec(await readFile('supabase/migrations/20260925035559_monthly_bill_price_confirmation.sql','utf8'))
  const h='00000000-0000-0000-0000-000000000001', owner='00000000-0000-0000-0000-000000000002', member='00000000-0000-0000-0000-000000000003', bill='00000000-0000-0000-0000-000000000004'
  const dates=(await db.query(`select
    to_char(date_trunc('month',now() at time zone 'America/Toronto')-interval '1 month','YYYY-MM-DD') as past,
    to_char(date_trunc('month',now() at time zone 'America/Toronto')+interval '1 month','YYYY-MM-DD') as future,
    to_char(date_trunc('month',now() at time zone 'America/Toronto')+interval '2 months','YYYY-MM-DD') as later`)).rows[0]
  await db.exec(`insert into households values ('${h}','America/Toronto');
    insert into household_members values ('${owner}','${h}',true,'owner'),('${member}','${h}',true,'member');
    insert into household_bills(id,household_id,name,category,amount_cents,due_day,created_by)
      values ('${bill}','${h}','Hydro','electricity',10000,15,'${owner}');
    insert into household_bill_periods(household_id,bill_id,period_month,amount_cents,due_at)
      values ('${h}','${bill}','${dates.past}',10000,now()),
        ('${h}','${bill}','${dates.future}',10000,now()),
        ('${h}','${bill}','${dates.later}',10000,now());
    insert into household_bill_payments(household_id,period_id,member_id,marked_by)
      select '${h}',id,'${member}','${member}' from household_bill_periods where period_month='${dates.past}';
    set role authenticated; set test.actor='${owner}';`)
  const edit='select public.edit_household_bill($1,$2,$3,$4,$5,$6)'
  await db.query(edit,[bill,'electricity',12000,dates.future,null,true])
  await db.exec('reset role')
  assert.deepEqual((await db.query('select amount_cents from household_bill_periods order by period_month')).rows.map(row=>row.amount_cents),[10000,null,null])
  assert.equal((await db.query('select requires_monthly_price from household_bills')).rows[0].requires_monthly_price,true)
  const pendingId=(await db.query('select id from household_bill_periods where period_month=$1',[dates.later])).rows[0].id
  await assert.rejects(db.query('insert into household_bill_payments(household_id,period_id,member_id,marked_by) values ($1,$2,$3,$3)',[h,pendingId,owner]),/Enter the monthly bill price/)
  await db.exec(`set role authenticated; set test.actor='${owner}';`)
  await db.query(edit,[bill,'electricity',12000,dates.future,15000,true])
  await db.exec('reset role')
  assert.deepEqual((await db.query('select amount_cents from household_bill_periods order by period_month')).rows.map(row=>row.amount_cents),[10000,15000,null])
  assert.equal((await db.query('select price_confirmed from household_bill_periods where period_month=$1',[dates.future])).rows[0].price_confirmed,true)
  assert.equal((await db.query('select count(*)::int as n from household_bill_payments')).rows[0].n,1)
  await db.exec(`set role authenticated; set test.actor='${owner}';`)
  const created=(await db.query('select public.upsert_household_bill($1::jsonb) as id',[JSON.stringify({
    householdId:h,name:'Water',category:'water',amountCents:9000,dueDay:10,
    memberIds:[owner,member],reminderDaysBefore:[3,1,0],requiresMonthlyPrice:true,
  })])).rows[0].id
  await db.exec('reset role')
  assert.equal((await db.query('select requires_monthly_price from household_bills where id=$1',[created])).rows[0].requires_monthly_price,true)
  assert.ok((await db.query('select amount_cents from household_bill_periods where bill_id=$1',[created])).rows.every(row=>row.amount_cents===null))
 } finally { await db.close() }
})
