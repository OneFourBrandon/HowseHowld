begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table('public', 'households', 'households exists');
select has_table('public', 'task_occurrences', 'task occurrences exists');
select has_table('public', 'ledger_entries', 'immutable ledger entries exist');
select has_table('public', 'notification_outbox', 'notification outbox exists');
select has_table('public', 'fund_payments', 'fund payment confirmation exists');
select has_view('public', 'member_balances', 'derived balances view exists');
select has_column('public', 'households', 'enabled_features', 'households choose enabled features');
select has_column('public', 'households', 'join_code_hash', 'share codes are stored as hashes');
select has_column('public', 'households', 'address_line1', 'households store their address');
select has_column('public', 'profiles', 'account_kind', 'profiles distinguish house-code accounts');
select has_function('public', 'create_household_v2', array['jsonb'], 'configured household creation RPC exists');
select has_function('public', 'join_household_by_code', array['text','text'], 'share-code join RPC exists');
select has_function('public', 'complete_task_occurrence', array['uuid'], 'completion RPC exists');
select has_function('public', 'create_expense', array['jsonb'], 'expense RPC exists');
select has_function('public', 'reorder_driveway', array['uuid','bigint','uuid[]'], 'optimistic driveway RPC exists');
select has_function('public', 'propose_fund_payment', array['integer'], 'fund payment RPC exists');
select col_type_is('public', 'expenses', 'amount_cents', 'integer', 'expenses use integer cents');
select col_is_unique('public', 'task_occurrences', array['task_id','scheduled_date'], 'occurrences are idempotent');
select col_is_unique('public', 'notification_outbox', array['kind','entity_id','member_id','scheduled_at'], 'notifications are idempotent');
select policies_are('public', 'ledger_entries', array['ledger_entries_household_select'], 'ledger allows household reads only');

select * from finish();
rollback;
