import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

test('owner schedule edits replace open assignments and keep completed history', async () => {
  const db = new PGlite()
  const task = '00000000-0000-0000-0000-000000000001'
  const house = '00000000-0000-0000-0000-000000000002'
  try {
    await db.exec(`
      create role authenticated; create role anon; create schema private;
      create type task_assignment_mode as enum ('rotation','fixed','manual','one_off');
      create table household_members(id uuid, household_id uuid, active boolean);
      create table task_definitions(id uuid primary key, household_id uuid, deleted_at timestamptz,
        title text, description text, area text, assignment_mode task_assignment_mode,
        fixed_member_id uuid, starts_on date, ends_on date, due_time time, recurrence jsonb,
        reminder_override jsonb, penalty_enabled boolean, active boolean, updated_at timestamptz);
      create table task_rotation_members(task_id uuid, household_id uuid, member_id uuid, position integer);
      create table task_occurrences(id uuid primary key, task_id uuid, status text);
      create table infractions(occurrence_id uuid);
      create table notification_outbox(entity_id uuid, entity_type text, status text);
      create table generation_calls(kind text);
      create function private.is_household_owner(uuid) returns boolean language sql as $$
        select coalesce(current_setting('test.owner',true)='yes', false) $$;
      create function private.generate_task_occurrences(integer) returns integer language plpgsql as $$
        begin insert into public.generation_calls values ('normal'); return 1; end $$;
      create function private.ensure_rolling_queue_occurrences_impl(uuid,integer) returns integer language plpgsql as $$
        begin insert into public.generation_calls values ('queue'); return 1; end $$;
      create policy task_definitions_member_update on task_definitions for update to authenticated using (true);
      grant usage on schema private to authenticated;
      insert into task_definitions values ('${task}','${house}',null,'Old task',null,'Kitchen',
        'rotation',null,'2026-09-01',null,'23:59','{"frequency":"weekly","interval":1,"weekdays":[1]}',
        null,true,true,now());
      insert into task_occurrences values
        ('00000000-0000-0000-0000-000000000003','${task}','assigned'),
        ('00000000-0000-0000-0000-000000000004','${task}','completed'),
        ('00000000-0000-0000-0000-000000000005','${task}','missed');
      insert into infractions values ('00000000-0000-0000-0000-000000000005');
      insert into notification_outbox values ('00000000-0000-0000-0000-000000000003','task_occurrence','pending');
    `)
    await db.exec(await readFile(new URL('../supabase/migrations/20260925034441_edit_chore_schedule.sql', import.meta.url), 'utf8'))
    await db.exec('set role authenticated;')
    await assert.rejects(db.query('select private.update_task_impl($1,$2::jsonb)', [task, '{}']), /Only the household admin/)
    await db.exec("set test.owner='yes';")
    await db.query('select private.update_task_impl($1,$2::jsonb)', [task, JSON.stringify({
      description: 'Clean the sink', startsOn: '2026-10-01', dueTime: '20:30',
      recurrence: { frequency: 'weekly', interval: 1, weekdays: [4] },
      reminderOverride: [{ type: 'local_time', value: '18:00' }],
    })])
    await db.exec('reset role;')
    const taskRow = (await db.query('select description,starts_on,due_time,recurrence,reminder_override from task_definitions')).rows[0]
    assert.equal(taskRow.description, 'Clean the sink')
    assert.equal(taskRow.starts_on.toISOString().slice(0, 10), '2026-10-01')
    assert.equal(taskRow.due_time, '20:30:00')
    assert.equal(taskRow.recurrence.weekdays[0], 4)
    assert.equal(taskRow.reminder_override[0].value, '18:00')
    assert.deepEqual((await db.query('select status from task_occurrences order by status')).rows.map(row => row.status), ['completed', 'missed'])
    assert.equal((await db.query('select status from notification_outbox')).rows[0].status, 'cancelled')
    assert.deepEqual((await db.query('select kind from generation_calls order by kind')).rows.map(row => row.kind), ['normal', 'queue'])
  } finally { await db.close() }
})
