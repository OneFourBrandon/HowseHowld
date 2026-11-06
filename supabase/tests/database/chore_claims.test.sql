-- Grace period and chore claim coverage; run only against a disposable test backend.
begin;
create extension if not exists pgtap with schema extensions;
select plan(127);

-- Four roommates in one house (Ashton is the admin) and two in another. Priya
-- (user 7) joins the first house partway through.
insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select ('c0000000-0000-4000-8000-00000000000' || n)::uuid, 'authenticated', 'authenticated',
  'claims' || n || '@example.com', '{"provider":"email","providers":["email"]}', '{}', now(), now()
from generate_series(1, 7) n;
update public.profiles set display_name = case id
  when 'c0000000-0000-4000-8000-000000000001' then 'Ashton'
  when 'c0000000-0000-4000-8000-000000000002' then 'Greg'
  when 'c0000000-0000-4000-8000-000000000003' then 'Maya'
  when 'c0000000-0000-4000-8000-000000000004' then 'Noah'
  when 'c0000000-0000-4000-8000-000000000007' then 'Priya'
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
from generate_series(0, 26) n;

-- Occurrences are assigned a day before they are due unless a test says otherwise.
create function pg_temp.occurrence(n integer, assignee text, due timestamptz,
  household text default 'c1000000-0000-4000-8000-000000000000', created timestamptz default null)
returns void language sql as $$
  insert into public.task_occurrences (id, household_id, task_id, scheduled_date, assignee_member_id, due_at, created_at)
  values (('c1400000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid, household::uuid,
    ('c1300000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid,
    (due at time zone 'America/Toronto')::date, assignee::uuid, due,
    coalesce(created, due - interval '1 day'))
$$;
create function pg_temp.occ(n integer) returns uuid language sql as $$
  select ('c1400000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid
$$;
create function pg_temp.as_user(n integer) returns void language sql as $$
  select set_config('request.jwt.claim.sub', 'c0000000-0000-4000-8000-00000000000' || n, true)
$$;
-- Photos are uploaded now unless a test backdates them; etag mimics the storage API's content hash.
create function pg_temp.photo(n integer, file text, uploader integer,
  household text default 'c1000000-0000-4000-8000-000000000000',
  created timestamptz default null, etag text default null)
returns text language sql as $$
  insert into storage.objects (bucket_id, name, owner_id, created_at, metadata)
  values ('chore-claims', household || '/' || pg_temp.occ(n) || '/' || file, 'c0000000-0000-4000-8000-00000000000' || uploader,
    coalesce(created, now()), case when etag is not null then jsonb_build_object('eTag', etag) end)
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
-- Scheduled for yesterday and still inside its grace period, whatever time the suite runs.
insert into public.task_occurrences (id, household_id, task_id, scheduled_date, assignee_member_id, due_at, created_at)
values (pg_temp.occ(22), 'c1000000-0000-4000-8000-000000000000', 'c1300000-0000-4000-8000-000000000022',
  (now() at time zone 'America/Toronto')::date - 1, 'c1100000-0000-4000-8000-000000000001',
  now() - interval '1 hour', now() - interval '2 days');

set local role authenticated;
select pg_temp.as_user(1);
select lives_ok($$select public.complete_task_occurrence(pg_temp.occ(1))$$, 'the assignee can finish a chore during the grace period');
select lives_ok($$select public.complete_task_occurrence(pg_temp.occ(22))$$, 'the assignee can finish yesterday''s chore after midnight during the grace period');
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
select is((select reward_cents from public.chore_claims where id = pg_temp.claim_for(2)), 1000, 'the reward is the whole $10 penalty');
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

-- $15 penalty: Ashton -15, Greg +15, fund 0.
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
select is((select reward_cents from public.chore_claims where id = pg_temp.claim_for(3)), 1500, 'the reward is the whole $15 penalty');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(3), current_setting('test.after3'))$$, 'the claimer submits the after photo');
select pg_temp.as_user(3);
select lives_ok($$select public.vote_chore_claim(pg_temp.claim_for(3), 'approve')$$, 'first approval recorded');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(3), 'approve')::text, 'approved', 'two approvals approve the claim');
select is((select e.amount_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000001'), -1500::bigint, 'the assignee pays the full $15');
select is((select e.amount_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000002'), 1500::bigint, 'the roommate who covered it earns the whole $15');
select is((select count(*)::integer from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.household_fund), 0, 'the fund gets no entry on a $15 penalty');
select is((select e.fund_liability_cents from public.ledger_entries e join public.infractions i on i.ledger_transaction_id = e.transaction_id where i.occurrence_id = pg_temp.occ(3) and e.member_id = 'c1100000-0000-4000-8000-000000000001'), 0::bigint, 'nothing is owed to the fund on a covered $15 penalty');
reset role;
select is((select (net_cents, fund_owed_cents)::text from public.member_balances where member_id = 'c1100000-0000-4000-8000-000000000001'), '(-2500,0)', 'Ashton''s balance carries both covered penalties and owes the fund nothing');
select is((select (net_cents, fund_owed_cents)::text from public.member_balances where member_id = 'c1100000-0000-4000-8000-000000000002'), '(2500,0)', 'Greg''s balance carries both full rewards');

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

-- A fund payment marks only posted, uncovered penalties as paid. Greg has a
-- posted $10 penalty (12) and a newer miss (13) that Maya and Noah upheld but
-- that has not posted yet. Ashton covers 13 while Greg pays off 12.
select pg_temp.occurrence(12, 'c1100000-0000-4000-8000-000000000002', now() - interval '5 hours');
select pg_temp.occurrence(13, 'c1100000-0000-4000-8000-000000000002', now() - interval '5 hours');
select private.process_due_work();
update public.infractions set dispute_deadline = now() - interval '1 minute' where occurrence_id = pg_temp.occ(12);
select private.process_due_work();
select set_config('test.before13', pg_temp.photo(13, 'before.jpg', 1), true);
select set_config('test.after13', pg_temp.photo(13, 'after.jpg', 1), true);
set local role authenticated;
select pg_temp.as_user(3);
select public.cast_infraction_vote((select id from public.infractions where occurrence_id = pg_temp.occ(13)), 'uphold');
select pg_temp.as_user(4);
select is(public.cast_infraction_vote((select id from public.infractions where occurrence_id = pg_temp.occ(13)), 'uphold')::text, 'upheld', 'roommates uphold Greg''s second miss before it posts');
select pg_temp.as_user(1);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(13), current_setting('test.before13'))$$, 'Ashton covers an upheld miss that has not posted');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(13), current_setting('test.after13'))$$, 'Ashton submits the after photo');
select pg_temp.as_user(2);
select set_config('test.fund13', public.propose_fund_payment(1000)::text, true);
select pg_temp.as_user(1);
select lives_ok($$select public.confirm_fund_payment(current_setting('test.fund13')::uuid, true)$$, 'Ashton confirms Greg''s fund payment');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(12)), 'paid', 'the posted penalty is paid off');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(13)), 'upheld', 'a penalty under claim that has not posted is not marked paid');
select pg_temp.as_user(3);
select lives_ok($$select public.vote_chore_claim(pg_temp.claim_for(13), 'approve')$$, 'Maya approves the claim');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(13), 'approve')::text, 'approved', 'the claim still approves after the fund payment');
select isnt((select ledger_transaction_id from public.infractions where occurrence_id = pg_temp.occ(13)), null, 'the covered penalty posts');

-- Ashton's covered penalties (2 and 3) leave him owing the fund nothing. Once
-- his uncovered miss 7 posts, paying the fund marks only 7 paid: 3 was covered,
-- and his upheld miss 0 has not posted.
reset role;
select is((select coalesce(sum(fund_liability_cents), 0)::bigint from public.ledger_entries where member_id = 'c1100000-0000-4000-8000-000000000001'), 0::bigint, 'covered penalties leave nothing owed to the fund');
update public.infractions set dispute_deadline = now() - interval '1 minute' where occurrence_id = pg_temp.occ(7);
select private.process_due_work();
select set_config('test.fund_ashton_amount', (select amount_cents::text from public.infractions where occurrence_id = pg_temp.occ(7)), true);
set local role authenticated;
select pg_temp.as_user(1);
select set_config('test.fund_ashton', public.propose_fund_payment(current_setting('test.fund_ashton_amount')::integer)::text, true);
select pg_temp.as_user(2);
select lives_ok($$select public.confirm_fund_payment(current_setting('test.fund_ashton')::uuid, true)$$, 'Greg confirms Ashton''s fund payment');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(7)), 'paid', 'paying the fund marks the posted, uncovered penalty as paid');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(3)), 'upheld', 'paying the fund leaves a covered penalty as it was');
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(0)), 'upheld', 'paying the fund never marks a penalty that has not posted as paid');

-- One claim or penalty that cannot settle never blocks the cron.
reset role;
select pg_temp.occurrence(14, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select pg_temp.occurrence(15, 'c1100000-0000-4000-8000-000000000004', now() - interval '5 hours');
select pg_temp.occurrence(16, 'c1100000-0000-4000-8000-000000000002', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before14', pg_temp.photo(14, 'before.jpg', 4), true);
select set_config('test.after14', pg_temp.photo(14, 'after.jpg', 4), true);
select set_config('test.before15', pg_temp.photo(15, 'before.jpg', 2), true);
select set_config('test.after15', pg_temp.photo(15, 'after.jpg', 2), true);
set local role authenticated;
select pg_temp.as_user(4);
select public.claim_missed_chore(pg_temp.occ(14), current_setting('test.before14'));
select public.submit_chore_claim(pg_temp.claim_for(14), current_setting('test.after14'));
select pg_temp.as_user(2);
select public.claim_missed_chore(pg_temp.occ(15), current_setting('test.before15'));
select public.submit_chore_claim(pg_temp.claim_for(15), current_setting('test.after15'));
reset role;
-- States the RPCs never produce: 14's penalty is already settled, 15's reward
-- does not match its penalty, and 16's penalty cannot post. Chore 17 is due in the same run.
update public.infractions set status = 'paid' where occurrence_id = pg_temp.occ(14);
update public.chore_claims set reward_cents = (select amount_cents - 100 from public.infractions where occurrence_id = pg_temp.occ(15)), vote_deadline = now() - interval '1 minute' where id = pg_temp.claim_for(15);
update public.infractions set amount_cents = 0, dispute_deadline = now() - interval '1 minute' where occurrence_id = pg_temp.occ(16);
select pg_temp.occurrence(17, 'c1100000-0000-4000-8000-000000000002', now() - interval '5 hours');
set local client_min_messages to error;
select lives_ok($$select private.process_due_work()$$, 'the cron keeps running when a claim or penalty cannot settle');
reset client_min_messages;
select ok(exists (select 1 from public.chore_claims where occurrence_id = pg_temp.occ(14) and status = 'lapsed' and resolved_at is not null), 'a claim whose penalty was already settled closes as lapsed');
select is((select status::text from public.chore_claims where occurrence_id = pg_temp.occ(15)), 'submitted', 'a claim that failed to settle waits for the next run');
select throws_ok($$select private.post_covered_penalty(pg_temp.claim_for(15))$$, 'P0001', 'The reward must match the penalty', 'a reward smaller than the penalty never posts');
select is((select ledger_transaction_id from public.infractions where occurrence_id = pg_temp.occ(16)), null, 'a penalty that failed to post stays unposted');
select is((select status::text from public.task_occurrences where id = pg_temp.occ(17)), 'missed', 'the rest of the run still happens');
update public.chore_claims set reward_cents = (select amount_cents from public.infractions where occurrence_id = pg_temp.occ(15)) where id = pg_temp.claim_for(15);
update public.infractions set status = 'excused', resolved_at = now() where occurrence_id = pg_temp.occ(16);

-- A chore assigned after it was due cannot be covered.
select pg_temp.occurrence(18, 'c1100000-0000-4000-8000-000000000001', now() - interval '5 hours', created => now());
select private.process_due_work();
select set_config('test.before18', pg_temp.photo(18, 'before.jpg', 2), true);
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(18), current_setting('test.before18'))$$, 'P0001', 'This chore was added after it was due, so it cannot be covered', 'a chore added after its due time cannot be covered');

-- Deleting a chore keeps an assignment that is in its grace period.
reset role;
select pg_temp.occurrence(19, 'c1100000-0000-4000-8000-000000000002', now() - interval '1 hour');
insert into public.task_occurrences (id, household_id, task_id, scheduled_date, assignee_member_id, due_at, created_at)
values ('c1500000-0000-4000-8000-000000000019', 'c1000000-0000-4000-8000-000000000000', 'c1300000-0000-4000-8000-000000000019',
  (now() at time zone 'America/Toronto')::date + 1, 'c1100000-0000-4000-8000-000000000002',
  now() + interval '1 day', now() - interval '1 day');
set local role authenticated;
select pg_temp.as_user(2);
select lives_ok($$select public.delete_task('c1300000-0000-4000-8000-000000000019')$$, 'the assignee can delete a chore during its grace period');
select is((select status::text from public.task_occurrences where id = pg_temp.occ(19)), 'assigned', 'deleting a chore keeps an assignment that is in its grace period');
select is((select count(*)::integer from public.task_occurrences where id = 'c1500000-0000-4000-8000-000000000019'), 0, 'deleting a chore still removes its future assignments');

-- Photos must be taken for this claim.
reset role;
select pg_temp.occurrence(20, 'c1100000-0000-4000-8000-000000000004', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.early20', pg_temp.photo(20, 'early.jpg', 2, created => now() - interval '2 hours'), true);
select set_config('test.before20', pg_temp.photo(20, 'before.jpg', 2), true);
select set_config('test.stale20', pg_temp.photo(20, 'stale.jpg', 2, created => now() - interval '1 minute'), true);
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(20), current_setting('test.early20'))$$, 'P0001', 'Take a new photo for this claim', 'a before photo taken before the grace period ended is rejected');
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(20), current_setting('test.before20'))$$, 'a before photo taken after the grace period ended is accepted');
select throws_ok($$select public.submit_chore_claim(pg_temp.claim_for(20), current_setting('test.stale20'))$$, 'P0001', 'Take a new photo for this claim', 'an after photo taken before the claim is rejected');

-- A photo with the same bytes as another photo in the house is rejected.
reset role;
select pg_temp.occurrence(21, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.copy21', pg_temp.photo(21, 'copy.jpg', 2, etag => '"shared-bytes"'), true);
select pg_temp.photo(20, 'original.jpg', 4, etag => '"shared-bytes"');
select set_config('test.before21', pg_temp.photo(21, 'before.jpg', 2, etag => '"before-21"'), true);
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(21), current_setting('test.copy21'))$$, 'P0001', 'Take a new photo for this claim', 'a copy of another household photo is rejected');
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(21), current_setting('test.before21'))$$, 'a unique before photo is accepted');
reset role;
select set_config('test.same21', pg_temp.photo(21, 'same.jpg', 2, etag => '"before-21"'), true);
select pg_temp.photo(9, 'elsewhere.jpg', 6, 'c2000000-0000-4000-8000-000000000000', etag => '"after-21"');
select set_config('test.after21', pg_temp.photo(21, 'after.jpg', 2, etag => '"after-21"'), true);
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.submit_chore_claim(pg_temp.claim_for(21), current_setting('test.same21'))$$, 'P0001', 'Take a new photo for this claim', 'an after photo with the same bytes as the before photo is rejected');
select lives_ok($$select public.submit_chore_claim(pg_temp.claim_for(21), current_setting('test.after21'))$$, 'a matching photo in another household does not block the claim');

-- Retrying after a failed request may upload the same photo again; that is not a copy.
reset role;
select pg_temp.occurrence(26, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select private.process_due_work();
select pg_temp.photo(26, 'attempt-1.jpg', 4, etag => '"retry-26"');
select set_config('test.retry26', pg_temp.photo(26, 'attempt-2.jpg', 4, etag => '"retry-26"'), true);
set local role authenticated;
select pg_temp.as_user(4);
select lives_ok($$select public.claim_missed_chore(pg_temp.occ(26), current_setting('test.retry26'))$$, 'retrying with the same photo after a failed request is allowed');

-- Outsiders cannot act on a claim; reviewers can change their vote until it closes.
reset role;
select pg_temp.occurrence(23, 'c1100000-0000-4000-8000-000000000004', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before23', pg_temp.photo(23, 'before.jpg', 3), true);
select set_config('test.after23', pg_temp.photo(23, 'after.jpg', 3), true);
set local role authenticated;
select pg_temp.as_user(3);
select public.claim_missed_chore(pg_temp.occ(23), current_setting('test.before23'));
select public.submit_chore_claim(pg_temp.claim_for(23), current_setting('test.after23'));
reset role;
select set_config('test.claim23', pg_temp.claim_for(23)::text, true);
select set_config('test.infraction8', (select id::text from public.infractions where occurrence_id = pg_temp.occ(8)), true);
set local role authenticated;
select pg_temp.as_user(5);
select throws_ok($$select public.claim_missed_chore(pg_temp.occ(23), current_setting('test.before23'))$$, 'P0001', 'Only household members can cover a chore', 'a member of another house cannot claim');
select throws_ok($$select public.vote_chore_claim(current_setting('test.claim23')::uuid, 'approve')$$, 'P0001', 'Only household members can vote', 'a member of another house cannot vote on a claim');
select throws_ok($$select public.note_chore_claim(current_setting('test.claim23')::uuid, 'Not my house')$$, 'P0001', 'Only the roommate who missed the chore can add a note', 'a member of another house cannot add a note');
select throws_ok($$select public.dispute_infraction(current_setting('test.infraction8')::uuid, 'Not my house either')$$, 'P0001', 'Only the affected member can dispute', 'a member of another house cannot dispute');
reset role;
select is((select status::text from public.infractions where occurrence_id = pg_temp.occ(8)), 'pending', 'the outside dispute changed nothing');
set local role authenticated;
select pg_temp.as_user(1);
select is(public.vote_chore_claim(current_setting('test.claim23')::uuid, 'reject')::text, 'submitted', 'a reviewer votes');
select is(public.vote_chore_claim(current_setting('test.claim23')::uuid, 'approve')::text, 'submitted', 'a reviewer can change their vote before the vote closes');
select is((select string_agg(choice::text, ',') from public.chore_claim_votes where claim_id = current_setting('test.claim23')::uuid), 'approve', 'the changed vote replaces the first one');
reset role;
update public.chore_claims set vote_deadline = now() - interval '1 minute' where id = current_setting('test.claim23')::uuid;
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.vote_chore_claim(current_setting('test.claim23')::uuid, 'approve')$$, 'P0001', 'This vote is closed', 'votes after the vote deadline are rejected');
reset role;
select private.process_due_work();
select is((select status::text from public.chore_claims where id = current_setting('test.claim23')::uuid), 'approved', 'the cron closes the vote at its deadline');

-- Reviewers are fixed when the after photo arrives. Greg covers Maya's 24 and 25;
-- Ashton and Noah review 24.
select pg_temp.occurrence(24, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select pg_temp.occurrence(25, 'c1100000-0000-4000-8000-000000000003', now() - interval '5 hours');
select private.process_due_work();
select set_config('test.before24', pg_temp.photo(24, 'before.jpg', 2), true);
select set_config('test.after24', pg_temp.photo(24, 'after.jpg', 2), true);
select set_config('test.before25', pg_temp.photo(25, 'before.jpg', 2), true);
select set_config('test.after25', pg_temp.photo(25, 'after.jpg', 2), true);
set local role authenticated;
select pg_temp.as_user(2);
select public.claim_missed_chore(pg_temp.occ(24), current_setting('test.before24'));
select public.submit_chore_claim(pg_temp.claim_for(24), current_setting('test.after24'));
select public.claim_missed_chore(pg_temp.occ(25), current_setting('test.before25'));
reset role;
select ok((select voter_member_ids @> array['c1100000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000004']::uuid[]
  and cardinality(voter_member_ids) = 2 from public.chore_claims where id = pg_temp.claim_for(24)), 'the reviewers are the uninvolved roommates when the after photo arrives');
insert into public.household_members (id, household_id, profile_id, role) values
  ('c1100000-0000-4000-8000-000000000007', 'c1000000-0000-4000-8000-000000000000', 'c0000000-0000-4000-8000-000000000007', 'member');
set local role authenticated;
select pg_temp.as_user(7);
select throws_ok($$select public.vote_chore_claim(pg_temp.claim_for(24), 'approve')$$, 'P0001', 'You are not a reviewer for this claim', 'a roommate who joins after the after photo cannot vote');
select pg_temp.as_user(4);
select is(public.vote_chore_claim(pg_temp.claim_for(24), 'reject')::text, 'submitted', 'Noah votes to reject');
reset role;
update public.household_members set active = false where id = 'c1100000-0000-4000-8000-000000000004';
set local role authenticated;
select pg_temp.as_user(1);
select is(public.vote_chore_claim(pg_temp.claim_for(24), 'reject')::text, 'rejected', 'a reviewer''s vote still counts after they leave the house');
reset role;
-- With Ashton, Noah, and Priya gone, nobody is left to review 25.
update public.household_members set active = false
where id in ('c1100000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000007');
set local role authenticated;
select pg_temp.as_user(2);
select throws_ok($$select public.submit_chore_claim(pg_temp.claim_for(25), current_setting('test.after25'))$$, 'P0001', 'Nobody is left to review this claim', 'a claim cannot be submitted without a reviewer');
reset role;
update public.household_members set active = true
where id in ('c1100000-0000-4000-8000-000000000001', 'c1100000-0000-4000-8000-000000000004');
select is((select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries), 0::bigint, 'every ledger transaction still balances');

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
