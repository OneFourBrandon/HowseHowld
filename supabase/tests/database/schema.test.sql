begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

select has_table('public', 'households', 'households exists');
select has_table('public', 'task_occurrences', 'task occurrences exists');
select has_table('public', 'ledger_entries', 'immutable ledger entries exist');
select has_table('public', 'notification_outbox', 'notification outbox exists');
select has_table('public', 'fund_payments', 'fund payment confirmation exists');
select has_table('public', 'household_bills', 'monthly household bills exist');
select has_table('public', 'household_bill_members', 'bill assignments exist');
select has_table('public', 'household_bill_periods', 'monthly bill periods exist');
select has_table('public', 'household_bill_payments', 'per-member bill payments exist');
select has_table('public', 'member_recovery_codes', 'member recovery codes exist');
select has_table('public', 'shared_courses', 'shared class definitions exist');
select has_table('public', 'shared_course_enrollments', 'shared class enrollments exist');
select has_table('public', 'shared_course_meetings', 'per-member class meetings exist');
select has_table('public', 'shared_course_assessments', 'per-member assessments exist');
select has_view('public', 'member_balances', 'derived balances view exists');
select has_column('public', 'households', 'enabled_features', 'households choose enabled features');
select has_column('public', 'households', 'join_code_hash', 'share codes are stored as hashes');
select has_column('public', 'households', 'address_line1', 'households store their address');
select has_column('public', 'profiles', 'account_kind', 'profiles distinguish house-code accounts');
select has_column('public', 'profiles', 'avatar_path', 'profiles can reference private avatars');
select has_column('public', 'profiles', 'onboarding_completed_at', 'profile onboarding is recorded explicitly');
select ok(
  exists (select 1 from storage.buckets where id = 'avatars' and not public),
  'profile avatars use a private storage bucket'
);
select has_function('public', 'create_household_v2', array['jsonb'], 'configured household creation RPC exists');
select has_function('public', 'join_household_by_code', array['text','text'], 'share-code join RPC exists');
select has_function('public', 'complete_task_occurrence', array['uuid'], 'completion RPC exists');
select has_function('public', 'create_expense', array['jsonb'], 'expense RPC exists');
select has_function('public', 'reorder_driveway', array['uuid','uuid[]'], 'driveway reorder RPC exists');
select has_function('public', 'propose_fund_payment', array['integer'], 'fund payment RPC exists');
select has_function('public', 'upsert_household_bill', array['jsonb'], 'bill upsert RPC exists');
select has_function('public', 'set_household_bill_paid', array['uuid','boolean'], 'self payment RPC exists');
select has_function('public', 'issue_member_recovery_code', array['uuid'], 'owner recovery-code RPC exists');
select has_function('public', 'remove_household_member', array['uuid'], 'owner member-removal RPC exists');
select has_function('public', 'save_shared_course', array['jsonb'], 'shared class save RPC exists');
select has_function('public', 'ensure_rolling_queue_occurrences', array['uuid','integer'], 'rolling queue generation RPC exists');
select col_type_is('public', 'expenses', 'amount_cents', 'integer', 'expenses use integer cents');
select col_is_unique('public', 'task_occurrences', array['task_id','scheduled_date'], 'occurrences are idempotent');
select col_is_unique('public', 'notification_outbox', array['kind','entity_id','member_id','scheduled_at'], 'notifications are idempotent');
select policies_are('public', 'ledger_entries', array['ledger_entries_household_select'], 'ledger allows household reads only');

select * from finish();
rollback;
