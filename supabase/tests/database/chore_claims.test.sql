-- Grace period and chore claim coverage; run only against a disposable test backend.
begin;
create extension if not exists pgtap with schema extensions;
select plan(76);

-- Four roommates in one house (Ashton is the admin) and two in another.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('c0000000-0000-4000-8000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
  'claims' || n || '@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()
from generate_series(1, 6) n;
update public.profiles set display_name = case id
  when 'c0000000-0000-4000-8000-000000000001' then 'Ashton'
  when 'c0000000-0000-4000-8000-000000000002' then 'Greg'
  when 'c0000000-0000-4000-8000-000000000003' then 'Maya'
  when 'c0000000-0000-4000-8000-000000000004' then 'Noah'
  else display_name end;
insert into public.households (id, name, created_by, timezone) values
  ('c1000000-0000-4000-8000-000000000000', 'Claim house', 'c0000000-0000-4000-8000-000000000001', 'America/Toronto'),
  ('c2000000-0000-4000-8000-000000000000', 'Pair house', 'c0000000-0000-4000-8000-000000000005', 'America/Toronto');
insert into public.household_members (id, household_id, profile_id, role) values
  ('c1100000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000001', 'owner'),
  ('c1100000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000002', 'member'),
  ('c1100000-0000-4000-8000-000000000003', 'c1000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000003', 'member'),
  ('c1100000-0000-4000-8000-000000000004', 'c1000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000004', 'member'),
  ('c2200000-0000-4000-8000-000000000005', 'c2000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000005', 'owner'),
  ('c2200000-0000-4000-8000-000000000006', 'c2000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000006', 'member');

-- One paused chore per occurrence keeps the generator from adding rows.
insert into public.task_definitions (id, household_id, title, assignment_mode, recurrence, active, created_by)
select ('c1300000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
  case when n = 9 then 'c2000000-0000-4000-8000-000000000000'::uuid else 'c1000000-0000-4000-8000-000000000000'::uuid end,
  'Chore ' || n, 'manual', '{"frequency":"once","interval":1}', false,
  case when n = 9 then 'c2200000-0000-4000-8000-000000000005'::uuid else 'c1100000-0000-4000-8000-000000000001'::uuid end
from generate_series(0, 11) n;

create function pg_temp.occurrence(n integer, assignee text, due timestamptz, household text default 'c1000000-0000-4000-8000-000000000000')
returns void language sql as $$
  insert into public.task_occurrences (id, household_id, task_id, scheduled_date, assignee_member_id, due_at)
  values (('c1400000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, household::uuid,
    ('c1300000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
    (due at time zone 'America/Toronto')::date, assignee::uuid, due)
$$;
create function pg_temp.occ(n integer) returns uuid language sql as $$
  select ('c1400000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000000' || n, true)
$$;
create function pg_temp.photo(n integer, file text, uploader integer, household text default 'c1000000-0000-4000-8000-000000000000')
returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner_id)
  values ('chore-claims', household || '/' || pg_temp.occ(n) || '/' || file, 'c0000000-0000-4000-8000-00000000000' || uploader)
  returning name
$$;
create function pg_temp.claim_for(n integer) returns uuid language sql as $$
  select id from public.chore_claims where occurrence_id = pg_temp.occ(n) and status <> 'lapsed'
$$;
create function pg_temp.balance(member text) returns bigint language sql as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries where member_id = member::uuid
$$;
grant execute on all functions in schema pg_temp to authenticated;

select hasnt_column('public', 'task_definitions', 'penalty_enabled', 'every chore carries a penalty');
select is((select chore_grace_minutes from public.households where id = 'c1000000-0000-4000-8000-000000000000'), 240, 'households default to a four hour grace period');

-- Grace period -----------------------------------------------------------------
select pg_temp.occurrence(1, 'c1100000-0000-4000-8000-000000000001', now() - interval '3 hours');
select pg_temp.occurrence(2, 'c1100000-0000-4000-8000-000000000001', now() - interval '5 hours');
select pg_temp.occurrence(8, 'c1100000-0000-4000-8000-000000000001', now() - interval '4 hours 1 minute');
select pg_temp.occurrence(10, 'c1100000-0000-4000-8000-000000000001', now() - interval '1 hour');

set local role authenticated;
select pg_temp.as_user(1);
select throws_ok($$select public.complete_task_occurrence(pg_temp.occ(8))$$, 'P0001', 'This task has expired', 'completion closes when the grace period ends');
select lives_ok($$select public.update_task('c1300000-0000-4000-8000-000000000010', '{"dueTime":"20:00"}')$$, 'admin can edit a chore during its grace period');
select is((select count(*)::integer from public.task_occurrences where id = pg_temp.occ(10)), 1, 'editing a chore keeps an assignment that is in its grace period');
reset role;

select private.process_due_work();
select is((select status::text from public.task_occurrences where id = pg_temp.occ(1)), 'assigned', 'a chore inside its grace period is not missed');
select is((select status::text from public.task_occurrences where id = pg_temp.occ(2)), 'missed', 'a chore past its grace period is missed');
select is((select status::text from public.task_occurrences where id = pg_temp.occ(8)), 'missed', 'one minute past the grace period counts as missed');
select is((select amount_cents from public.infractions where occurrence_id = pg_temp.occ(2)), 1000, 'the first miss uses the first tier');

set local role authenticated;
select pg_temp.as_user(1);
select lives_ok($$select public.complete_task_occurrence(pg_temp.occ(1))$$, 'the assignee can finish a chore during the grace period');
select lives_ok($$select public.create_task('{"householdId":"c1000000-0000-4000-8000-000000000000","title":"Mop the floor","assignmentMode":"manual","penaltyEnabled":false}')$$, 'creating a chore ignores the retired penalty toggle');

-- Claim rules ------------------------------------------------------------------
reset role;
select set_config('test.before2', pg_temp.photo(2, 'before.jpg', 2), true);
select set_config('test.other_upload', pg_temp.photo(2, 'maya.jpg', 3), true);
set local role authenticated;

select pg_temp.as_user(1);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(2), current_setting('test.before2'))$$, 'P0001', 'You cannot cover your own chore', 'the assignee cannot claim their own chore');
select pg_temp.as_user(2);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(1), current_setting('test.before2'))$$, 'P0001', 'Only missed chores can be covered', 'a completed chore cannot be claimed');
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(2), 'c1000000-0000-4000-8000-000000000000/' || pg_temp.occ(2) || '/missing.jpg')$$, 'P0001', 'Upload a photo of the chore first', 'a claim needs an uploaded before photo');
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(2), current_setting('test.other_upload'))$$, 'P0001', 'Upload a photo of the chore first', 'the before photo must be uploaded by the claimer');
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(2), current_setting('test.before2'))$$, 'a roommate can claim a missed chore with a before photo');
select is((select reward_cents from public.chore_claims where id = pg_temp.claim_for(2)), 1000, 'the reward is $10');
select is((select status::text from public.chore_claims where id = pg_temp.claim_for(2)), 'claimed', 'the claim waits for the after photo');
select ok(exists (select 1 from public.notification_outbox where entity_id = pg_temp.claim_for(2) and kind = 'chore_claim_started' and member_id = 'c1100000-0000-4000-8000-000000000001'), 'the assignee is told about the claim');
select pg_temp.as_user(3);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(2), current_setting('test.other_upload'))$$, 'P0001', 'Someone is already covering this chore', 'only one roommate can claim a chore');

-- A claim freezes the normal review.
select pg_temp.as_user(1);
select throws_ok($$select public.dispute_infraction((select id from public.infractions where occurrence_id = pg_temp.occ(2)), 'I did it already')$$, 'P0001', 'A roommate covered this chore. Add a note to the claim instead.', 'a claimed infraction cannot be disputed');
select throws_ok($$select public.forgive_infraction((select id from public.infractions where occurrence_id = pg_temp.occ(2)))$$, 'P0001', 'A roommate covered this chore, so it cannot be forgiven', 'a claimed infraction cannot be forgiven');
select pg_temp.as_user(3);
select throws_ok($$select public.cast_infraction_vote((select id from public.infractions where occurrence_id = pg_temp.occ(2)), 'excuse')$$, 'P0001', 'A roommate covered this chore, so the claim vote decides it', 'a claimed infraction cannot get review votes');

select pg_temp.as_user(1);
select lives_ok($$select public.note_chore_claim(pg_temp.claim_for(2), '  The counters were already clean.  ')$$, 'the assignee can add a note');
select is((select assignee_note from public.chore_claims where id = pg_temp.claim_for(2)), 'The counters were already clean.', 'the note is trimmed');
select pg_temp.as_user(2);
select throws_ok($$select public.note_chore_claim(pg_temp.claim_for(2), 'Looks done to me')$$, 'P0001', 'Only the roommate who missed the chore can add a note', 'only the assignee can add a note');

-- Submitting the after photo opens the vote.
select throws_ok($$select public.submit_chore_claim(pg_temp.claim_for(2), current_setting('test.before2'))$$, 'P0001', 'Take a new photo after the chore is done', 'the after photo must be new');
reset role;
select set_config('test.after2', pg_temp.photo(2, 'after.jpg', 2), true);
set local role authenticated;
select pg_temp.as_user(3);
select throws_ok($$select public.submit_chore_claim(pg_temp.claim_for(2), current_setting('test.after2'))$$, 'P0001', 'Only the roommate covering this chore can finish it', 'only the claimer can submit the after photo');
select pg_temp.as_user(2);
select is(public.submit_chore_claim(pg_temp.claim_for(2), current_setting('test.after2'))::text, 'submitted', 'submitting the after photo opens the vote');
select is((select count(*)::integer from public.notification_outbox where entity_id = pg_temp.claim_for(2) and kind = 'chore_claim_review'), 2, 'both uninvolved roommates are asked to vote');

reset role;
update public.infractions set dispute_deadline = now() - interval '1 minute' where occurrence_id = pg_temp.occ(2);
select private.process_due_work();
select is((select ledger_transaction_id from public.infractions where occurrence_id = pg_temp.occ(2)), null, 'a claimed infraction is not charged when its review deadline passes');
set local role authenticated;

select pg_temp.as_user(2);
select throws_ok($$select public.vote_chore_claim(pg_temp.claim_for(2), 'approve')$$, 'P0001', 'Only roommates outside this claim can vote', 'the claimer cannot vote');
select pg_temp.as_user(1);
select throws_ok($$select public.vote_chore_claim(pg_temp.claim_for(2), 'reject')$$, 'P0001', 'Only roommates outside this claim can vote', 'the assignee cannot vote');
select pg_temp.as_user(3);
select is(public.vote_chore_claim(pg_temp.claim_for(2), 'approve')::text, 'submitted', 'the vote stays open until every uninvolved roommate votes');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(2), 'reject')::text, 'approved', 'a tie approves the claim');

-- $10 penalty: Ashton -10, Greg +10, fund 0.
select is(pg_temp.balance('c1100000-0000-4000-8000-000000000001'), -1000::bigint, 'the assignee is charged the $10 penalty');
select is(pg_temp.balance('c1100000-0000-4000-8000-000000000002'), 1000::bigint, 'the roommate who covered it earns $10');
select is((select coalesce(sum(fund_liability_cents), 0)::bigint from public.ledger_entries where member_id = 'c1100000-0000-4000-8000-000000000001'), 0::bigint, 'nothing is owed to the fund on a $10 penalty');
select is((select count(*)::integer from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(2) and e.household_fund), 0, 'the fund gets no entry on a $10 penalty');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(2)), 'upheld', 'an approved claim upholds the infraction');
select is((select count(*)::integer from public.notification_outbox where entity_id = pg_temp.claim_for(2) and kind = 'chore_claim_result'), 2, 'the claimer and assignee hear the result');
select ok((select body from public.notification_outbox where entity_id = pg_temp.claim_for(2) and kind = 'chore_claim_result' limit 1) like 'Greg earned $10.00 for covering Chore 2.', 'the result names the reward');
select pg_temp.as_user(1);
select throws_ok($$select public.forgive_infraction((select id from public.infractions where occurrence_id = pg_temp.occ(2)))$$, 'P0001', 'A roommate covered this chore, so it cannot be forgiven', 'an approved claim cannot be forgiven');
select pg_temp.as_user(3);
select throws_ok($$select public.vote_chore_claim(pg_temp.claim_for(2), 'reject')$$, 'P0001', 'This vote is closed', 'a decided claim takes no more votes');

-- $15 penalty: Ashton -15, Greg +10, fund +5.
reset role;
select pg_temp.occurrence(0, 'c1100000-0000-4000-8000-000000000001', now() - interval '2 days');
update public.task_occurrences set status = 'missed' where id = pg_temp.occ(0);
insert into public.infractions (household_id, occurrence_id, member_id, amount_cents, status, created_at, dispute_deadline)
values ('c1000000-0000-4000-8000-000000000000', pg_temp.occ(0), 'c1100000-0000-4000-8000-000000000001', 1000, 'upheld', now() - interval '1 day', now() + interval '6 days');
select pg_temp.occurrence(3, 'c1100000-0000-4000-8000-000000000001', now() - interval '5 hours');
select private.process_due_work();
select is((select amount_cents from public.infractions where occurrence_id = pg_temp.occ(3)), 1500, 'a second miss uses the second tier');
select set_config('test.before3', pg_temp.photo(3, 'before.jpg', 2), true);
select set_config('test.after3', pg_temp.photo(3, 'after.jpg', 2), true);
set local role authenticated;
select pg_temp.as_user(2);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(3), current_setting('test.before3'))$$, 'a roommate can claim a $15 miss');
select is((select reward_cents from public.chore_claims where id = pg_temp.claim_for(3)), 1000, 'the reward stays $10 on a larger penalty');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(3), current_setting('test.after3'))$$, 'the claimer submits the after photo');
select pg_temp.as_user(3);
select lives_ok($$select public.vote_chore_claim(pg_temp.claim_for(3), 'approve')$$, 'first approval recorded');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(3), 'approve')::text, 'approved', 'two approvals approve the claim');
select is((select e.amount_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000001'), -1500::bigint, 'the assignee pays the full $15');
select is((select e.amount_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000002'), 1000::bigint, 'the roommate who covered it earns $10');
select is((select e.amount_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.household_fund), 500::bigint, 'the fund receives the remaining $5');
select is((select e.fund_liability_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000001'), 500::bigint, 'only the fund share is owed to the fund');

-- Rejection: Maya claims Greg's chore, Ashton and Noah reject it.
reset role;
select pg_temp.occurrence(4, 'c1100000-0000-4000-8000-000000000002', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before4', pg_temp.photo(4, 'before.jpg', 3), true);
select set_config('test.after4', pg_temp.photo(4, 'after.jpg', 3), true);
set local role authenticated;
select pg_temp.as_user(3);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(4), current_setting('test.before4'))$$, 'Maya claims Greg''s chore');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(4), current_setting('test.after4'))$$, 'Maya submits the after photo');
select pg_temp.as_user(1);
select lives_ok($$select public.vote_chore_claim(pg_temp.claim_for(4), 'reject')$$, 'first rejection recorded');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(4), 'reject')::text, 'rejected', 'two rejections reject the claim');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(4)), 'excused', 'a rejected claim excuses the assignee');
select is((select ledger_transaction_id from public.infractions where occurrence_id = pg_temp.occ(4)), null, 'a rejected claim moves no money');

-- No votes by the deadline approves the claim.
reset role;
select pg_temp.occurrence(5, 'c1100000-0000-4000-8000-000000000004', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before5', pg_temp.photo(5, 'before.jpg', 1), true);
select set_config('test.after5', pg_temp.photo(5, 'after.jpg', 1), true);
set local role authenticated;
select pg_temp.as_user(1);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(5), current_setting('test.before5'))$$, 'Ashton claims Noah''s chore');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(5), current_setting('test.after5'))$$, 'Ashton submits the after photo');
reset role;
update public.chore_claims set vote_deadline = now() - interval '1 minute' where id = pg_temp.claim_for(5);
select private.process_due_work();
select is((select status::text from public.chore_claims where id = pg_temp.claim_for(5)), 'approved', 'a claim with no votes is approved at the deadline');

-- A claim without an after photo lapses and the normal review resumes.
select pg_temp.occurrence(6, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before6', pg_temp.photo(6, 'before.jpg', 4), true);
set local role authenticated;
select pg_temp.as_user(4);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(6), current_setting('test.before6'))$$, 'Noah claims Maya''s chore');
reset role;
update public.chore_claims set claim_deadline = now() - interval '1 minute' where occurrence_id = pg_temp.occ(6);
select private.process_due_work();
select is((select status::text from public.chore_claims where occurrence_id = pg_temp.occ(6)), 'lapsed', 'a claim without an after photo lapses');
set local role authenticated;
select pg_temp.as_user(3);
select lives_ok($$select public.dispute_infraction((select id from public.infractions where occurrence_id = pg_temp.occ(6)), 'Noah never did it')$$, 'the normal review resumes after a lapse');

-- Closed window and small households.
reset role;
select pg_temp.occurrence(7, 'c1100000-0000-4000-8000-000000000001', now() - interval '3 days');
select pg_temp.occurrence(9, 'c2200000-0000-4000-8000-000000000005', now() - interval '5 hours', 'c2000000-0000-4000-8000-000000000000');
select private.process_due_work();
select set_config('test.before7', pg_temp.photo(7, 'before.jpg', 2), true);
select set_config('test.before9', pg_temp.photo(9, 'before.jpg', 6, 'c2000000-0000-4000-8000-000000000000'), true);
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(7), current_setting('test.before7'))$$, 'P0001', 'The window to cover this chore has closed', 'claims close at the end of the next day');
select pg_temp.as_user(6);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(9), current_setting('test.before9'))$$, 'P0001', 'Covering chores needs at least three roommates', 'two-person houses cannot claim chores');

-- Money stays balanced and claims stay RPC-only.
reset role;
select is((select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries), 0::bigint, 'every ledger transaction balances');
select is(pg_temp.balance('c1100000-0000-4000-8000-000000000004'), -1000::bigint, 'Noah pays for the claim approved without votes');
select ok(not has_table_privilege('authenticated', 'public.chore_claims', 'insert'), 'members cannot insert claims directly');
select ok(not has_table_privilege('authenticated', 'public.chore_claim_votes', 'update'), 'members cannot edit claim votes directly');

-- Grace period setting.
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.update_chore_grace_period('c1000000-0000-4000-8000-000000000000', 60)$$, 'P0001', 'Only the admin can change the grace period.', 'only the admin can change the grace period');
select pg_temp.as_user(1);
select throws_ok($$select public.update_chore_grace_period('c1000000-0000-4000-8000-000000000000', 721)$$, 'P0001', 'Choose a grace period between 0 and 12 hours.', 'the grace period is capped at 12 hours');
select lives_ok($$select public.update_chore_grace_period('c1000000-0000-4000-8000-000000000000', 0)$$, 'the admin can turn the grace period off');
reset role;
select pg_temp.occurrence(11, 'c1100000-0000-4000-8000-000000000001', now() - interval '1 minute');
select private.process_due_work();
select is((select status::text from public.task_occurrences where id = pg_temp.occ(11)), 'missed', 'without a grace period a chore is missed right after its due time');

select * from finish();
rollback;
