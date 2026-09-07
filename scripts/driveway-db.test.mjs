import { after, before, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

// Execute the actual migration's SQL against PostgreSQL, with a minimal fixture
// for the pre-existing household schema. Realtime publication is transport only.
const db = new PGlite()
const house = '10000000-0000-0000-0000-000000000001'
const owner = '20000000-0000-0000-0000-000000000001'
const member = '20000000-0000-0000-0000-000000000002'
const car = n => `30000000-0000-0000-0000-${String(n).padStart(12,'0')}`
const tile = (n,x,y,width=1,height=1) => ({ id: `40000000-0000-0000-0000-${String(n).padStart(12,'0')}`, x,y,width,height,kind:'driveway' })
const q = (sql, args=[]) => db.query(sql,args)
const save = slots => q('select public.save_driveway_slots($1,$2)',[house,JSON.stringify(slots)])
const park = (n,slotId) => q('select public.park_vehicle($1,$2,$3)',[house,car(n),slotId])
const actAs = id => q("select set_config('test.member',$1,false)",[id])
before(async () => {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema private; grant usage on schema private to authenticated,service_role;
    create table public.households(id uuid primary key,driveway_width int default 1,garage_rows int default 0,timezone text default 'UTC');
    create table public.household_members(id uuid primary key,household_id uuid references public.households,role text,active boolean default true);
    create function private.current_member_id(h uuid) returns uuid language sql stable security definer set search_path='' as $$
      select id from public.household_members where household_id=h and active and id=nullif(current_setting('test.member',true),'')::uuid
    $$;
    create function private.is_household_owner(h uuid) returns boolean language sql stable security definer set search_path='' as $$
      select exists(select 1 from public.household_members where id=private.current_member_id(h) and role='owner')
    $$;
    create table public.vehicles(id uuid primary key,household_id uuid references public.households,owner_member_id uuid references public.household_members,label text,active boolean default true);
    create table public.driveway_state(household_id uuid primary key references public.households,updated_by uuid,updated_at timestamptz);
    create table public.driveway_positions(household_id uuid,vehicle_id uuid,position int);
    create table public.departure_rules(id uuid primary key,household_id uuid,vehicle_id uuid,owner_member_id uuid,first_required_at timestamptz,recurrence jsonb,active boolean default true,warning_minutes int[] default '{60}');
    create table public.departure_occurrences(id uuid primary key default gen_random_uuid(),household_id uuid,rule_id uuid,vehicle_id uuid,owner_member_id uuid,required_at timestamptz,blocker_vehicle_ids uuid[],unique(rule_id,required_at));
    create table public.notification_outbox(id uuid primary key default gen_random_uuid(),household_id uuid,member_id uuid,kind text,entity_type text,entity_id uuid,scheduled_at timestamptz,title text,body text,deep_link text,urgency text,status text default 'pending',last_error text,unique(kind,entity_id,member_id,scheduled_at));
    insert into public.households(id) values('${house}');
    insert into public.household_members(id,household_id,role) values('${owner}','${house}','owner'),('${member}','${house}','member');
    insert into public.driveway_state(household_id) values('${house}');
    insert into public.vehicles(id,household_id,owner_member_id,label) values
      ('${car(1)}','${house}','${owner}','First'),('${car(2)}','${house}','${member}','Second'),('${car(3)}','${house}','${member}','Third'),('${car(4)}','${house}','${owner}','Target');
  `)
  const migration = await readFile(new URL('../supabase/migrations/20260907155100_editable_driveway_slots.sql',import.meta.url),'utf8')
  await db.exec(migration.replace('alter publication supabase_realtime add table public.driveway_slots;',''))
  await actAs(owner)
})
after(async () => { await db.close() })

test('migrates existing cars and restricts slot editing to the household admin', async () => {
  assert.equal((await q('select count(*)::int n from public.driveway_slots')).rows[0].n,4)
  await db.exec('set role authenticated')
  await actAs(member)
  await assert.rejects(save([]),/Only the admin/)
  await assert.rejects(q('delete from public.driveway_slots'),/permission denied/)
  await actAs('20000000-0000-0000-0000-000000000099')
  assert.equal((await q('select count(*)::int n from public.driveway_slots')).rows[0].n,0)
  await assert.rejects(park(1,null),/Not a household member/)
  await db.exec('reset role'); await actAs(owner)
})

test('resizes tiles, rejects overlaps and retains live occupancy across layout saves', async () => {
  for(let n=1;n<=4;n++) await park(n,null)
  const slots=[tile(1,0,0),tile(2,1,0),tile(3,2,0),{...tile(4,0,2,2,2),kind:'garage'}]
  await save(slots)
  await park(1,slots[0].id); await park(2,slots[1].id); await park(3,slots[2].id); await park(4,slots[3].id)
  await assert.rejects(save([...slots.slice(0,3),tile(4,0,0,2,2)]),/must not overlap/)
  await assert.rejects(save(slots.slice(0,3)),/Unpark cars/)
  await park(1,slots[1].id)
  await save(slots) // stale occupancy in the editor cannot undo the swap
  assert.equal((await q('select vehicle_id from public.driveway_slots where id=$1',[slots[1].id])).rows[0].vehicle_id,car(1))
  await park(1,slots[0].id)
  assert.equal((await q('select kind from public.driveway_slots where id=$1',[slots[3].id])).rows[0].kind,'garage')
})

test('wide slots notify all overlapping lanes and cancel obsolete pending warnings', async () => {
  const blockers=await q('select private.driveway_blockers($1,$2) ids',[house,car(4)])
  assert.deepEqual(blockers.rows[0].ids,[car(1),car(2)])
  await q("insert into public.departure_rules(id,household_id,vehicle_id,owner_member_id,first_required_at,recurrence) values(gen_random_uuid(),$1,$2,$3,now()+interval '2 hours','{}')",[house,car(4),owner])
  await q('select private.generate_departure_occurrences(1)')
  await q('select private.enqueue_departure_reminders()')
  assert.equal((await q("select count(*)::int n from public.notification_outbox where status='pending'")).rows[0].n,2)
  await park(2,null)
  assert.equal((await q("select count(*)::int n from public.notification_outbox where status='pending'")).rows[0].n,1)
  assert.equal((await q("select count(*)::int n from public.notification_outbox where status='cancelled'")).rows[0].n,1)
  await park(2,tile(2,1,0).id)
  await q('select private.enqueue_departure_reminders()')
  assert.equal((await q("select count(*)::int n from public.notification_outbox where status='pending'")).rows[0].n,2)
  await q('update public.vehicles set active=false where id=$1',[car(1)])
  assert.equal((await q('select vehicle_id from public.driveway_slots where id=$1',[tile(1,0,0).id])).rows[0].vehicle_id,null)
})
