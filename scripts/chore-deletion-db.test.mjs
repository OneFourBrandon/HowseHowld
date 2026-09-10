import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('deletion is household scoped and preserves completed history and penalties', async () => {
  const db = new PGlite()
  const task = '00000000-0000-0000-0000-000000000001'
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema private;
      create table task_definitions(id uuid primary key, household_id uuid, active boolean);
      create table task_occurrences(id uuid primary key, task_id uuid, status text);
      create table infractions(occurrence_id uuid);
      create table notification_outbox(entity_id uuid, entity_type text, status text);
      create function private.current_member_id(uuid) returns uuid language sql as $$
        select case when current_setting('test.allowed',true)='yes' then $1 else null end $$;
      grant usage on schema private to authenticated;
      insert into task_definitions values ('${task}','${task}',true);
      insert into task_occurrences values
        ('00000000-0000-0000-0000-000000000002','${task}','assigned'),
        ('00000000-0000-0000-0000-000000000003','${task}','completed'),
        ('00000000-0000-0000-0000-000000000004','${task}','missed');
      insert into infractions values ('00000000-0000-0000-0000-000000000004');
      insert into notification_outbox values ('00000000-0000-0000-0000-000000000002','task_occurrence','pending');
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260910004540_chore_deletion.sql', import.meta.url), 'utf8'))
    await db.exec('set role authenticated;')
    await assert.rejects(db.query('select public.delete_task($1)', [task]), /Chore not found/)
    await db.exec("set test.allowed='yes';")
    await db.query('select public.delete_task($1)', [task])
    await db.query('select public.delete_task($1)', [task])
    await db.exec('reset role;')
    assert.equal((await db.query('select active from task_definitions')).rows[0].active, false)
    assert.deepEqual((await db.query('select status from task_occurrences order by status')).rows.map(r=>r.status), ['completed','missed'])
    assert.equal((await db.query('select count(*)::int as n from infractions')).rows[0].n,1)
    assert.equal((await db.query('select status from notification_outbox')).rows[0].status,'cancelled')
    await assert.rejects(db.exec('update task_definitions set active=true'), /deleted_tasks_inactive/)
    assert.equal((await db.query("select has_function_privilege('anon','public.delete_task(uuid)','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})
