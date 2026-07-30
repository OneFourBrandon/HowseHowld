-- HowseHowld initial schema
-- All browser-visible data is household scoped. Sensitive mutations are
-- transactional RPCs and all money values are integer CAD cents.

create extension if not exists pgcrypto;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create type public.household_role as enum ('owner', 'member');
create type public.task_assignment_mode as enum ('rotation', 'fixed', 'manual', 'one_off');
create type public.task_occurrence_status as enum ('assigned', 'completed', 'missed');
create type public.infraction_status as enum ('pending', 'disputed', 'upheld', 'excused', 'paid');
create type public.infraction_vote_choice as enum ('uphold', 'excuse');
create type public.ledger_transaction_type as enum ('expense', 'settlement', 'expense_reversal', 'penalty', 'fund_payment');
create type public.ledger_transaction_status as enum ('pending', 'posted', 'voided');
create type public.settlement_status as enum ('pending', 'confirmed', 'rejected');
create type public.event_audience as enum ('everyone', 'selected', 'self');
create type public.schedule_item_kind as enum ('class', 'exam', 'other');
create type public.departure_source as enum ('manual', 'course');
create type public.notification_status as enum ('pending', 'processing', 'sent', 'failed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  email text not null,
  avatar_color text not null default '#4c927e',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  timezone text not null default 'America/Toronto',
  currency text not null default 'CAD' check (currency = 'CAD'),
  default_due_time time not null default '23:59',
  default_task_reminders jsonb not null default
    '[{"type":"local_time","value":"09:00"},{"type":"local_time","value":"18:00"},{"type":"local_time","value":"22:00"},{"type":"local_time","value":"23:30"}]'::jsonb,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.household_role not null default 'member',
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  unique (household_id, profile_id)
);
create index household_members_profile_idx on public.household_members(profile_id, household_id) where active;
create index household_members_household_idx on public.household_members(household_id) where active;

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null,
  token_hash text not null unique,
  role public.household_role not null default 'member',
  invited_by uuid not null references public.household_members(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index household_invites_household_idx on public.household_invites(household_id);

create table public.task_definitions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text,
  area text not null default 'House',
  assignment_mode public.task_assignment_mode not null,
  fixed_member_id uuid references public.household_members(id),
  recurrence jsonb not null default '{"frequency":"weekly","interval":1,"weekdays":[]}'::jsonb,
  starts_on date not null default current_date,
  ends_on date,
  due_time time not null default '23:59',
  reminder_override jsonb,
  penalty_enabled boolean not null default true,
  active boolean not null default true,
  created_by uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index task_definitions_household_active_idx on public.task_definitions(household_id, active);

create table public.task_rotation_members (
  task_id uuid not null references public.task_definitions(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  position integer not null check (position >= 0),
  active boolean not null default true,
  primary key (task_id, member_id),
  unique (task_id, position)
);
create index task_rotation_members_household_idx on public.task_rotation_members(household_id);

create table public.task_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  task_id uuid not null references public.task_definitions(id) on delete restrict,
  scheduled_date date not null,
  assignee_member_id uuid not null references public.household_members(id),
  due_at timestamptz not null,
  status public.task_occurrence_status not null default 'assigned',
  completed_at timestamptz,
  completed_by uuid references public.household_members(id),
  created_at timestamptz not null default now(),
  unique (task_id, scheduled_date),
  check ((status = 'completed') = (completed_at is not null))
);
create index task_occurrences_due_idx on public.task_occurrences(status, due_at);
create index task_occurrences_household_idx on public.task_occurrences(household_id, due_at);
create index task_occurrences_assignee_idx on public.task_occurrences(assignee_member_id, due_at);

create table public.infractions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  occurrence_id uuid not null unique references public.task_occurrences(id) on delete restrict,
  member_id uuid not null references public.household_members(id),
  amount_cents integer not null check (amount_cents between 0 and 3000),
  status public.infraction_status not null default 'pending',
  dispute_deadline timestamptz not null,
  dispute_reason text,
  disputed_at timestamptz,
  resolved_at timestamptz,
  ledger_transaction_id uuid,
  created_at timestamptz not null default now()
);
create index infractions_member_recent_idx on public.infractions(member_id, created_at desc);
create index infractions_status_deadline_idx on public.infractions(status, dispute_deadline);

create table public.infraction_votes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  infraction_id uuid not null references public.infractions(id) on delete cascade,
  voter_member_id uuid not null references public.household_members(id),
  choice public.infraction_vote_choice not null,
  created_at timestamptz not null default now(),
  unique (infraction_id, voter_member_id)
);
create index infraction_votes_household_idx on public.infraction_votes(household_id);

create table public.ledger_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  type public.ledger_transaction_type not null,
  status public.ledger_transaction_status not null default 'posted',
  source_id uuid,
  reversal_of uuid references public.ledger_transactions(id),
  description text not null,
  created_by uuid references public.household_members(id),
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (type, source_id)
);
create index ledger_transactions_household_idx on public.ledger_transactions(household_id, created_at desc);

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null references public.ledger_transactions(id) on delete restrict,
  member_id uuid references public.household_members(id),
  household_fund boolean not null default false,
  amount_cents bigint not null check (amount_cents <> 0),
  contribution_cents bigint not null default 0,
  resource_use_cents bigint not null default 0,
  settlement_adjustment_cents bigint not null default 0,
  fund_liability_cents bigint not null default 0,
  created_at timestamptz not null default now(),
  check ((member_id is not null)::integer + household_fund::integer = 1)
);
create index ledger_entries_member_idx on public.ledger_entries(member_id);
create index ledger_entries_transaction_idx on public.ledger_entries(transaction_id);

alter table public.infractions
  add constraint infractions_ledger_transaction_fk
  foreign key (ledger_transaction_id) references public.ledger_transactions(id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  transaction_id uuid not null unique references public.ledger_transactions(id),
  title text not null check (char_length(title) between 1 and 160),
  amount_cents integer not null check (amount_cents > 0),
  purchased_at timestamptz not null,
  created_by uuid not null references public.household_members(id),
  receipt_path text,
  reversed_at timestamptz,
  reversal_reason text,
  created_at timestamptz not null default now()
);
create index expenses_household_idx on public.expenses(household_id, purchased_at desc);

create table public.expense_payers (
  expense_id uuid not null references public.expenses(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id),
  amount_cents integer not null check (amount_cents > 0),
  primary key (expense_id, member_id)
);
create index expense_payers_household_idx on public.expense_payers(household_id);

create table public.expense_shares (
  expense_id uuid not null references public.expenses(id) on delete restrict,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id),
  amount_cents integer not null check (amount_cents > 0),
  primary key (expense_id, member_id)
);
create index expense_shares_household_idx on public.expense_shares(household_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  from_member_id uuid not null references public.household_members(id),
  to_member_id uuid not null references public.household_members(id),
  amount_cents integer not null check (amount_cents > 0),
  note text,
  status public.settlement_status not null default 'pending',
  transaction_id uuid unique references public.ledger_transactions(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_member_id <> to_member_id)
);
create index settlements_household_idx on public.settlements(household_id, created_at desc);

create table public.fund_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id),
  amount_cents integer not null check (amount_cents > 0),
  status public.settlement_status not null default 'pending',
  confirmed_by uuid references public.household_members(id),
  transaction_id uuid unique references public.ledger_transactions(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);
create index fund_payments_household_idx on public.fund_payments(household_id, created_at desc);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 180),
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  timezone text not null default 'America/Toronto',
  location text,
  recurrence jsonb,
  audience public.event_audience not null default 'everyone',
  creator_member_id uuid not null references public.household_members(id),
  reminder_offsets integer[] not null default array[1440, 60],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_at > start_at)
);
create index calendar_events_household_start_idx on public.calendar_events(household_id, start_at);

create table public.event_audiences (
  event_id uuid not null references public.calendar_events(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  primary key (event_id, member_id)
);
create index event_audiences_household_idx on public.event_audiences(household_id);

create table public.course_imports (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id),
  source_type text not null check (source_type in ('file', 'url')),
  source_name text,
  source_hash text not null,
  imported_count integer not null default 0,
  created_at timestamptz not null default now()
);
create index course_imports_household_idx on public.course_imports(household_id);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id),
  code text not null,
  name text not null,
  color text not null default '#6278b5',
  created_at timestamptz not null default now(),
  unique (household_id, owner_member_id, code)
);
create index courses_household_idx on public.courses(household_id);

create table public.schedule_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id),
  course_id uuid references public.courses(id) on delete set null,
  import_id uuid references public.course_imports(id) on delete set null,
  external_uid text not null,
  recurrence_id text not null default '',
  kind public.schedule_item_kind not null default 'other',
  title text not null,
  description text,
  location text,
  source_url text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  timezone text,
  rrule text,
  exdates timestamptz[] not null default '{}',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, owner_member_id, external_uid, recurrence_id)
);
create index schedule_items_household_start_idx on public.schedule_items(household_id, start_at);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id),
  label text not null,
  color text not null default '#6278b5',
  plate text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index vehicles_household_idx on public.vehicles(household_id) where active;

create table public.driveway_state (
  household_id uuid primary key references public.households(id) on delete cascade,
  version bigint not null default 0,
  updated_by uuid references public.household_members(id),
  updated_at timestamptz not null default now()
);

create table public.driveway_positions (
  household_id uuid not null references public.households(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id) on delete cascade,
  position integer not null check (position >= 0),
  primary key (household_id, vehicle_id),
  unique (household_id, position)
);

create table public.departure_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_member_id uuid not null references public.household_members(id),
  vehicle_id uuid not null references public.vehicles(id),
  source public.departure_source not null,
  schedule_item_id uuid references public.schedule_items(id) on delete cascade,
  label text not null,
  first_required_at timestamptz not null,
  recurrence jsonb,
  travel_buffer_minutes integer not null default 30 check (travel_buffer_minutes between 0 and 360),
  warning_minutes integer[] not null default array[60],
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index departure_rules_household_idx on public.departure_rules(household_id) where active;

create table public.departure_occurrences (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  rule_id uuid not null references public.departure_rules(id) on delete cascade,
  vehicle_id uuid not null references public.vehicles(id),
  owner_member_id uuid not null references public.household_members(id),
  required_at timestamptz not null,
  blocker_vehicle_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (rule_id, required_at)
);
create index departure_occurrences_due_idx on public.departure_occurrences(household_id, required_at);

create table public.notification_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  scope_type text not null check (scope_type in ('household', 'task', 'departure', 'event')),
  scope_id uuid,
  trigger_type text not null check (trigger_type in ('local_time', 'offset')),
  local_time time,
  offset_minutes integer,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  check (
    (trigger_type = 'local_time' and local_time is not null and offset_minutes is null)
    or (trigger_type = 'offset' and offset_minutes is not null and local_time is null)
  )
);
create index notification_rules_scope_idx on public.notification_rules(household_id, scope_type, scope_id);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  active boolean not null default true,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_member_idx on public.push_subscriptions(member_id) where active;

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  kind text not null,
  entity_type text not null,
  entity_id uuid not null,
  scheduled_at timestamptz not null,
  title text not null,
  body text not null,
  deep_link text not null default '/',
  urgency text not null default 'normal' check (urgency in ('very-low', 'low', 'normal', 'high')),
  status public.notification_status not null default 'pending',
  attempts integer not null default 0,
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (kind, entity_id, member_id, scheduled_at)
);
create index notification_outbox_due_idx on public.notification_outbox(status, scheduled_at);

create table public.notification_attempts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  outbox_id uuid not null references public.notification_outbox(id) on delete cascade,
  subscription_id uuid references public.push_subscriptions(id) on delete set null,
  status_code integer,
  success boolean not null,
  error text,
  attempted_at timestamptz not null default now()
);
create index notification_attempts_outbox_idx on public.notification_attempts(outbox_id);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  actor_member_id uuid references public.household_members(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  summary text not null,
  created_at timestamptz not null default now()
);
create index audit_events_household_idx on public.audit_events(household_id, created_at desc);

-- Auth and membership helpers. These are private, explicitly granted, and pin
-- search_path because they run with the migration owner's privileges.
create or replace function private.current_member_id(p_household_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select hm.id
  from public.household_members hm
  where hm.household_id = p_household_id
    and hm.profile_id = (select auth.uid())
    and hm.active
  limit 1
$$;

create or replace function private.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.current_member_id(p_household_id) is not null
$$;

create or replace function private.is_household_owner(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = p_household_id
      and hm.profile_id = (select auth.uid())
      and hm.role = 'owner'
      and hm.active
  )
$$;

revoke all on function private.current_member_id(uuid) from public;
revoke all on function private.is_household_member(uuid) from public;
revoke all on function private.is_household_owner(uuid) from public;
grant execute on function private.current_member_id(uuid) to authenticated, service_role;
grant execute on function private.is_household_member(uuid) to authenticated, service_role;
grant execute on function private.is_household_owner(uuid) to authenticated, service_role;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Roommate'),
    coalesce(new.email, '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end
$$;

create trigger on_auth_user_created
after insert or update of email on auth.users
for each row execute function private.handle_new_user();

create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_household_id uuid := nullif(v_row->>'household_id', '')::uuid;
  v_actor uuid;
begin
  if v_household_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  v_actor := private.current_member_id(v_household_id);
  insert into public.audit_events (
    household_id, actor_member_id, action, entity_type, entity_id,
    before_data, after_data, summary
  ) values (
    v_household_id,
    v_actor,
    lower(tg_table_name) || '.' || lower(tg_op),
    tg_table_name,
    nullif(v_row->>'id', '')::uuid,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    initcap(replace(tg_table_name, '_', ' ')) || ' ' || lower(tg_op)
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger audit_task_definitions after insert or update or delete on public.task_definitions
for each row execute function private.audit_row_change();
create trigger audit_task_occurrences after insert or update on public.task_occurrences
for each row execute function private.audit_row_change();
create trigger audit_infractions after insert or update on public.infractions
for each row execute function private.audit_row_change();
create trigger audit_expenses after insert or update on public.expenses
for each row execute function private.audit_row_change();
create trigger audit_settlements after insert or update on public.settlements
for each row execute function private.audit_row_change();
create trigger audit_fund_payments after insert or update on public.fund_payments
for each row execute function private.audit_row_change();
create trigger audit_calendar_events after insert or update or delete on public.calendar_events
for each row execute function private.audit_row_change();
create trigger audit_driveway_state after update on public.driveway_state
for each row execute function private.audit_row_change();

create or replace function private.create_household_impl(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_household uuid;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  if not exists (select 1 from public.profiles where id = v_user) then
    raise exception 'Profile not ready';
  end if;
  insert into public.households(name, created_by)
  values (trim(p_name), v_user)
  returning id into v_household;
  insert into public.household_members(household_id, profile_id, role)
  values (v_household, v_user, 'owner');
  insert into public.driveway_state(household_id) values (v_household);
  return v_household;
end
$$;
revoke all on function private.create_household_impl(text) from public;
grant execute on function private.create_household_impl(text) to authenticated;

create or replace function public.create_household(p_name text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_household_impl(p_name) $$;

create or replace function private.accept_household_invite_impl(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_email text;
  v_invite public.household_invites%rowtype;
begin
  if v_user is null then raise exception 'Authentication required'; end if;
  select email into v_email from public.profiles where id = v_user;
  select * into v_invite
  from public.household_invites
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and accepted_at is null and expires_at > now()
  for update;
  if not found or lower(v_invite.email) <> lower(v_email) then
    raise exception 'Invite is invalid or expired';
  end if;
  insert into public.household_members(household_id, profile_id, role)
  values (v_invite.household_id, v_user, v_invite.role)
  on conflict (household_id, profile_id) do update set active = true, left_at = null;
  update public.household_invites set accepted_at = now() where id = v_invite.id;
  return v_invite.household_id;
end
$$;
revoke all on function private.accept_household_invite_impl(text) from public;
grant execute on function private.accept_household_invite_impl(text) to authenticated;

create or replace function public.accept_household_invite(p_token text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.accept_household_invite_impl(p_token) $$;

create or replace function private.create_household_invite_impl(p_household_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id(p_household_id);
  v_token text := pg_catalog.encode(extensions.gen_random_bytes(24), 'base64');
begin
  if not private.is_household_owner(p_household_id) then
    raise exception 'Only the household owner can invite members';
  end if;
  v_token := replace(replace(replace(v_token, '+', '-'), '/', '_'), '=', '');
  insert into public.household_invites(household_id, email, token_hash, invited_by)
  values (
    p_household_id, lower(trim(p_email)),
    encode(extensions.digest(v_token, 'sha256'), 'hex'), v_member
  );
  return v_token;
end
$$;
revoke all on function private.create_household_invite_impl(uuid, text) from public;
grant execute on function private.create_household_invite_impl(uuid, text) to authenticated;

create or replace function public.create_household_invite(p_household_id uuid, p_email text)
returns text language sql security invoker set search_path = ''
as $$ select private.create_household_invite_impl(p_household_id, p_email) $$;

create or replace function private.create_task_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_task uuid;
  v_rotation jsonb := coalesce(p_input->'rotationMemberIds', '[]'::jsonb);
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  insert into public.task_definitions (
    household_id, title, description, area, assignment_mode, fixed_member_id,
    recurrence, due_time, penalty_enabled, created_by
  ) values (
    v_household,
    trim(p_input->>'title'),
    nullif(trim(p_input->>'description'), ''),
    coalesce(nullif(trim(p_input->>'area'), ''), 'House'),
    (p_input->>'assignmentMode')::public.task_assignment_mode,
    nullif(p_input->>'fixedMemberId', '')::uuid,
    coalesce(p_input->'recurrence', '{"frequency":"weekly","interval":1}'::jsonb),
    coalesce(nullif(p_input->>'dueTime', '')::time, '23:59'::time),
    coalesce((p_input->>'penaltyEnabled')::boolean, true),
    v_member
  ) returning id into v_task;
  insert into public.task_rotation_members(task_id, household_id, member_id, position)
  select v_task, v_household, value::text::uuid, ordinality - 1
  from jsonb_array_elements_text(v_rotation) with ordinality;
  return v_task;
end
$$;
revoke all on function private.create_task_impl(jsonb) from public;
grant execute on function private.create_task_impl(jsonb) to authenticated;

create or replace function public.create_task(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_task_impl(p_input) $$;

create or replace function private.update_task_impl(p_task_id uuid, p_input jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found or not private.is_household_member(v_task.household_id) then
    raise exception 'Task not found';
  end if;
  update public.task_definitions set
    title = coalesce(nullif(trim(p_input->>'title'), ''), title),
    description = case when p_input ? 'description' then nullif(trim(p_input->>'description'), '') else description end,
    area = coalesce(nullif(trim(p_input->>'area'), ''), area),
    due_time = coalesce(nullif(p_input->>'dueTime', '')::time, due_time),
    recurrence = coalesce(p_input->'recurrence', recurrence),
    reminder_override = case when p_input ? 'reminderOverride' then p_input->'reminderOverride' else reminder_override end,
    penalty_enabled = coalesce((p_input->>'penaltyEnabled')::boolean, penalty_enabled),
    active = coalesce((p_input->>'active')::boolean, active),
    updated_at = now()
  where id = p_task_id;
end
$$;
revoke all on function private.update_task_impl(uuid, jsonb) from public;
grant execute on function private.update_task_impl(uuid, jsonb) to authenticated;

create or replace function public.update_task(p_task_id uuid, p_input jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.update_task_impl(p_task_id, p_input) $$;

create or replace function private.complete_task_occurrence_impl(p_occurrence_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.task_occurrences%rowtype;
  v_member uuid;
begin
  select * into v_row from public.task_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'Occurrence not found'; end if;
  v_member := private.current_member_id(v_row.household_id);
  if v_member is null or v_member <> v_row.assignee_member_id then
    raise exception 'Only the assignee can complete this task';
  end if;
  if v_row.status <> 'assigned' or now() > v_row.due_at then
    raise exception 'This task can no longer be completed';
  end if;
  update public.task_occurrences
  set status = 'completed', completed_at = now(), completed_by = v_member
  where id = p_occurrence_id
  returning * into v_row;
  update public.notification_outbox set status = 'cancelled'
  where entity_id = p_occurrence_id and status = 'pending';
  return v_row;
end
$$;
revoke all on function private.complete_task_occurrence_impl(uuid) from public;
grant execute on function private.complete_task_occurrence_impl(uuid) to authenticated;

create or replace function public.complete_task_occurrence(p_occurrence_id uuid)
returns public.task_occurrences language sql security invoker set search_path = ''
as $$ select private.complete_task_occurrence_impl(p_occurrence_id) $$;

create or replace function private.dispute_infraction_impl(p_infraction_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.infractions%rowtype;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if not found or private.current_member_id(v_row.household_id) <> v_row.member_id then
    raise exception 'Only the affected member can dispute';
  end if;
  if v_row.status <> 'pending' or now() > v_row.dispute_deadline then
    raise exception 'The dispute window is closed';
  end if;
  if char_length(trim(p_reason)) < 5 then raise exception 'Please provide a reason'; end if;
  update public.infractions
  set status = 'disputed', dispute_reason = trim(p_reason), disputed_at = now()
  where id = p_infraction_id;
end
$$;
revoke all on function private.dispute_infraction_impl(uuid, text) from public;
grant execute on function private.dispute_infraction_impl(uuid, text) to authenticated;

create or replace function public.dispute_infraction(p_infraction_id uuid, p_reason text)
returns void language sql security invoker set search_path = ''
as $$ select private.dispute_infraction_impl(p_infraction_id, p_reason) $$;

create or replace function private.cast_infraction_vote_impl(
  p_infraction_id uuid,
  p_vote public.infraction_vote_choice
)
returns public.infraction_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.infractions%rowtype;
  v_voter uuid;
  v_uphold integer;
  v_excuse integer;
  v_status public.infraction_status;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if not found or v_row.status <> 'disputed' or now() > v_row.dispute_deadline then
    raise exception 'This vote is closed';
  end if;
  v_voter := private.current_member_id(v_row.household_id);
  if v_voter is null or v_voter = v_row.member_id then
    raise exception 'The affected member cannot vote';
  end if;
  insert into public.infraction_votes(household_id, infraction_id, voter_member_id, choice)
  values (v_row.household_id, p_infraction_id, v_voter, p_vote)
  on conflict (infraction_id, voter_member_id)
  do update set choice = excluded.choice, created_at = now();
  select
    count(*) filter (where choice = 'uphold'),
    count(*) filter (where choice = 'excuse')
  into v_uphold, v_excuse
  from public.infraction_votes where infraction_id = p_infraction_id;
  v_status := (case when v_uphold >= 2 then 'upheld'
                    when v_excuse >= 2 then 'excused'
                    else 'disputed' end)::public.infraction_status;
  if v_status <> 'disputed' then
    update public.infractions set status = v_status, resolved_at = now()
    where id = p_infraction_id;
  end if;
  return v_status;
end
$$;
revoke all on function private.cast_infraction_vote_impl(uuid, public.infraction_vote_choice) from public;
grant execute on function private.cast_infraction_vote_impl(uuid, public.infraction_vote_choice) to authenticated;

create or replace function public.cast_infraction_vote(
  p_infraction_id uuid,
  p_vote public.infraction_vote_choice
)
returns public.infraction_status language sql security invoker set search_path = ''
as $$ select private.cast_infraction_vote_impl(p_infraction_id, p_vote) $$;

create or replace function private.assert_balanced_transaction(p_transaction_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_total bigint;
begin
  select coalesce(sum(amount_cents), 0) into v_total
  from public.ledger_entries where transaction_id = p_transaction_id;
  if v_total <> 0 then raise exception 'Ledger transaction is not balanced: %', v_total; end if;
end
$$;

create or replace function private.create_expense_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_expense uuid := gen_random_uuid();
  v_transaction uuid;
  v_amount integer := (p_input->>'amountCents')::integer;
  v_paid bigint;
  v_used bigint;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  select coalesce(sum((item->>'amountCents')::integer), 0) into v_paid
  from jsonb_array_elements(p_input->'payers') item;
  select coalesce(sum((item->>'amountCents')::integer), 0) into v_used
  from jsonb_array_elements(p_input->'beneficiaries') item;
  if v_amount <= 0 or v_paid <> v_amount or v_used <> v_amount then
    raise exception 'Payers and beneficiaries must each equal the expense total';
  end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, description, created_by, posted_at
  ) values (
    v_household, 'expense', v_expense, p_input->>'title', v_member, now()
  ) returning id into v_transaction;
  insert into public.expenses(
    id, household_id, transaction_id, title, amount_cents, purchased_at,
    created_by, receipt_path
  ) values (
    v_expense, v_household, v_transaction, trim(p_input->>'title'), v_amount,
    coalesce((p_input->>'purchasedAt')::timestamptz, now()), v_member,
    nullif(p_input->>'receiptPath', '')
  );
  insert into public.expense_payers(expense_id, household_id, member_id, amount_cents)
  select v_expense, v_household, (item->>'memberId')::uuid, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'payers') item;
  insert into public.expense_shares(expense_id, household_id, member_id, amount_cents)
  select v_expense, v_household, (item->>'memberId')::uuid, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'beneficiaries') item;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, contribution_cents
  )
  select v_household, v_transaction, (item->>'memberId')::uuid,
         (item->>'amountCents')::integer, (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'payers') item;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, resource_use_cents
  )
  select v_household, v_transaction, (item->>'memberId')::uuid,
         -((item->>'amountCents')::integer), (item->>'amountCents')::integer
  from jsonb_array_elements(p_input->'beneficiaries') item;
  perform private.assert_balanced_transaction(v_transaction);
  return v_expense;
end
$$;
revoke all on function private.create_expense_impl(jsonb) from public;
grant execute on function private.create_expense_impl(jsonb) to authenticated;

create or replace function public.create_expense(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_expense_impl(p_input) $$;

create or replace function private.reverse_expense_impl(p_expense_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expense public.expenses%rowtype;
  v_member uuid;
  v_reversal uuid;
begin
  select * into v_expense from public.expenses where id = p_expense_id for update;
  if not found then raise exception 'Expense not found'; end if;
  v_member := private.current_member_id(v_expense.household_id);
  if v_member is null or v_member <> v_expense.created_by then
    raise exception 'Only the creator can reverse this expense';
  end if;
  if v_expense.reversed_at is not null then raise exception 'Expense already reversed'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'A reversal reason is required'; end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, reversal_of, description, created_by, posted_at
  ) values (
    v_expense.household_id, 'expense_reversal', p_expense_id,
    v_expense.transaction_id, 'Reversal: ' || trim(p_reason), v_member, now()
  ) returning id into v_reversal;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, household_fund, amount_cents,
    contribution_cents, resource_use_cents, settlement_adjustment_cents, fund_liability_cents
  )
  select household_id, v_reversal, member_id, household_fund, -amount_cents,
         -contribution_cents, -resource_use_cents, -settlement_adjustment_cents, -fund_liability_cents
  from public.ledger_entries where transaction_id = v_expense.transaction_id;
  perform private.assert_balanced_transaction(v_reversal);
  update public.expenses
  set reversed_at = now(), reversal_reason = trim(p_reason)
  where id = p_expense_id;
  return v_reversal;
end
$$;
revoke all on function private.reverse_expense_impl(uuid, text) from public;
grant execute on function private.reverse_expense_impl(uuid, text) to authenticated;

create or replace function public.reverse_expense(p_expense_id uuid, p_reason text)
returns uuid language sql security invoker set search_path = ''
as $$ select private.reverse_expense_impl(p_expense_id, p_reason) $$;

create or replace function private.propose_settlement_impl(
  p_to_member_id uuid, p_amount_cents integer, p_note text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid;
  v_from uuid;
  v_id uuid;
begin
  select household_id into v_household from public.household_members
  where id = p_to_member_id and active;
  v_from := private.current_member_id(v_household);
  if v_from is null or v_from = p_to_member_id then raise exception 'Invalid recipient'; end if;
  insert into public.settlements(
    household_id, from_member_id, to_member_id, amount_cents, note
  ) values (
    v_household, v_from, p_to_member_id, p_amount_cents, nullif(trim(p_note), '')
  ) returning id into v_id;
  return v_id;
end
$$;
revoke all on function private.propose_settlement_impl(uuid, integer, text) from public;
grant execute on function private.propose_settlement_impl(uuid, integer, text) to authenticated;

create or replace function public.propose_settlement(
  p_to_member_id uuid, p_amount_cents integer, p_note text default null
)
returns uuid language sql security invoker set search_path = ''
as $$ select private.propose_settlement_impl(p_to_member_id, p_amount_cents, p_note) $$;

create or replace function private.confirm_settlement_impl(p_settlement_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.settlements%rowtype;
  v_transaction uuid;
begin
  select * into v_row from public.settlements where id = p_settlement_id for update;
  if not found or private.current_member_id(v_row.household_id) <> v_row.to_member_id then
    raise exception 'Only the recipient can confirm';
  end if;
  if v_row.status <> 'pending' then raise exception 'Settlement already resolved'; end if;
  if not p_accept then
    update public.settlements set status = 'rejected', confirmed_at = now()
    where id = p_settlement_id;
    return;
  end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, description, created_by, posted_at
  ) values (
    v_row.household_id, 'settlement', v_row.id, 'Direct settlement',
    v_row.to_member_id, now()
  ) returning id into v_transaction;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, settlement_adjustment_cents
  ) values
    (v_row.household_id, v_transaction, v_row.from_member_id, v_row.amount_cents, v_row.amount_cents),
    (v_row.household_id, v_transaction, v_row.to_member_id, -v_row.amount_cents, -v_row.amount_cents);
  perform private.assert_balanced_transaction(v_transaction);
  update public.settlements
  set status = 'confirmed', transaction_id = v_transaction, confirmed_at = now()
  where id = p_settlement_id;
end
$$;
revoke all on function private.confirm_settlement_impl(uuid, boolean) from public;
grant execute on function private.confirm_settlement_impl(uuid, boolean) to authenticated;

create or replace function public.confirm_settlement(p_settlement_id uuid, p_accept boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.confirm_settlement_impl(p_settlement_id, p_accept) $$;

create or replace function private.propose_fund_payment_impl(p_amount_cents integer)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member public.household_members%rowtype;
  v_id uuid;
  v_owed bigint;
begin
  select hm.* into v_member
  from public.household_members hm
  where hm.profile_id = (select auth.uid()) and hm.active
  limit 1;
  if not found then raise exception 'No active household'; end if;
  select coalesce(sum(fund_liability_cents), 0) into v_owed
  from public.ledger_entries where member_id = v_member.id;
  if p_amount_cents <= 0 or p_amount_cents > v_owed then
    raise exception 'Payment must be positive and no greater than the fund balance';
  end if;
  insert into public.fund_payments(household_id, member_id, amount_cents)
  values (v_member.household_id, v_member.id, p_amount_cents)
  returning id into v_id;
  return v_id;
end
$$;
revoke all on function private.propose_fund_payment_impl(integer) from public;
grant execute on function private.propose_fund_payment_impl(integer) to authenticated;

create or replace function public.propose_fund_payment(p_amount_cents integer)
returns uuid language sql security invoker set search_path = ''
as $$ select private.propose_fund_payment_impl(p_amount_cents) $$;

create or replace function private.confirm_fund_payment_impl(
  p_fund_payment_id uuid, p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.fund_payments%rowtype;
  v_confirmer uuid;
  v_transaction uuid;
begin
  select * into v_row from public.fund_payments where id = p_fund_payment_id for update;
  if not found then raise exception 'Fund payment not found'; end if;
  v_confirmer := private.current_member_id(v_row.household_id);
  if v_confirmer is null or v_confirmer = v_row.member_id then
    raise exception 'Another roommate must confirm the payment';
  end if;
  if v_row.status <> 'pending' then raise exception 'Payment already resolved'; end if;
  if not p_accept then
    update public.fund_payments set status = 'rejected', confirmed_by = v_confirmer,
      confirmed_at = now() where id = p_fund_payment_id;
    return;
  end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, description, created_by, posted_at
  ) values (
    v_row.household_id, 'fund_payment', v_row.id, 'Household fund payment',
    v_confirmer, now()
  ) returning id into v_transaction;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, fund_liability_cents
  ) values (
    v_row.household_id, v_transaction, v_row.member_id,
    v_row.amount_cents, -v_row.amount_cents
  );
  insert into public.ledger_entries(
    household_id, transaction_id, household_fund, amount_cents
  ) values (
    v_row.household_id, v_transaction, true, -v_row.amount_cents
  );
  perform private.assert_balanced_transaction(v_transaction);
  update public.fund_payments
  set status = 'confirmed', confirmed_by = v_confirmer,
      transaction_id = v_transaction, confirmed_at = now()
  where id = p_fund_payment_id;
  update public.infractions i set status = 'paid'
  where i.member_id = v_row.member_id
    and i.status = 'upheld'
    and (
      select coalesce(sum(le.fund_liability_cents), 0)
      from public.ledger_entries le where le.member_id = v_row.member_id
    ) <= 0;
end
$$;
revoke all on function private.confirm_fund_payment_impl(uuid, boolean) from public;
grant execute on function private.confirm_fund_payment_impl(uuid, boolean) to authenticated;

create or replace function public.confirm_fund_payment(
  p_fund_payment_id uuid, p_accept boolean
)
returns void language sql security invoker set search_path = ''
as $$ select private.confirm_fund_payment_impl(p_fund_payment_id, p_accept) $$;

create or replace function private.upsert_calendar_event_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_id uuid := coalesce(nullif(p_input->>'id', '')::uuid, gen_random_uuid());
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  insert into public.calendar_events(
    id, household_id, title, description, start_at, end_at, all_day,
    timezone, location, audience, creator_member_id, reminder_offsets
  ) values (
    v_id, v_household, trim(p_input->>'title'), nullif(p_input->>'description', ''),
    (p_input->>'startAt')::timestamptz, (p_input->>'endAt')::timestamptz,
    coalesce((p_input->>'allDay')::boolean, false),
    coalesce(nullif(p_input->>'timezone', ''), 'America/Toronto'),
    nullif(p_input->>'location', ''),
    coalesce((p_input->>'audience')::public.event_audience, 'everyone'),
    v_member,
    coalesce(array(select jsonb_array_elements_text(p_input->'reminderOffsets')::integer), array[1440,60])
  )
  on conflict (id) do update set
    title = excluded.title, description = excluded.description,
    start_at = excluded.start_at, end_at = excluded.end_at,
    all_day = excluded.all_day, location = excluded.location,
    audience = excluded.audience, reminder_offsets = excluded.reminder_offsets,
    updated_at = now()
  where public.calendar_events.creator_member_id = v_member;
  delete from public.event_audiences where event_id = v_id;
  insert into public.event_audiences(event_id, household_id, member_id)
  select v_id, v_household, value::text::uuid
  from jsonb_array_elements_text(coalesce(p_input->'audienceMemberIds', '[]'::jsonb));
  return v_id;
end
$$;
revoke all on function private.upsert_calendar_event_impl(jsonb) from public;
grant execute on function private.upsert_calendar_event_impl(jsonb) to authenticated;

create or replace function public.upsert_calendar_event(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.upsert_calendar_event_impl(p_input) $$;

create or replace function private.reorder_driveway_impl(
  p_household_id uuid, p_expected_version bigint, p_ordered_vehicle_ids uuid[]
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_member uuid := private.current_member_id(p_household_id);
  v_version bigint;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  select version into v_version from public.driveway_state
  where household_id = p_household_id for update;
  if v_version <> p_expected_version then raise exception 'Driveway changed; refresh and try again'; end if;
  if cardinality(p_ordered_vehicle_ids) <> (
      select count(*) from public.vehicles
      where household_id = p_household_id and active
    )
    or exists (
      select 1
      from unnest(p_ordered_vehicle_ids) as ordered(id)
      left join public.vehicles v
        on v.id = ordered.id
       and v.household_id = p_household_id
       and v.active
      where v.id is null
    )
    or (
      select count(distinct id) from unnest(p_ordered_vehicle_ids) as ordered(id)
    ) <> cardinality(p_ordered_vehicle_ids)
  then
    raise exception 'The lineup must include every active vehicle exactly once';
  end if;
  delete from public.driveway_positions where household_id = p_household_id;
  insert into public.driveway_positions(household_id, vehicle_id, position)
  select p_household_id, id, ordinality - 1
  from unnest(p_ordered_vehicle_ids) with ordinality as ordered(id, ordinality);
  update public.driveway_state
  set version = version + 1, updated_by = v_member, updated_at = now()
  where household_id = p_household_id
  returning version into v_version;
  return v_version;
end
$$;
revoke all on function private.reorder_driveway_impl(uuid, bigint, uuid[]) from public;
grant execute on function private.reorder_driveway_impl(uuid, bigint, uuid[]) to authenticated;

create or replace function public.reorder_driveway(
  p_household_id uuid, p_expected_version bigint, p_ordered_vehicle_ids uuid[]
)
returns bigint language sql security invoker set search_path = ''
as $$ select private.reorder_driveway_impl(p_household_id, p_expected_version, p_ordered_vehicle_ids) $$;

create or replace function private.create_departure_rule_impl(p_input jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_household uuid := (p_input->>'householdId')::uuid;
  v_member uuid := private.current_member_id(v_household);
  v_id uuid;
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if not exists (
    select 1 from public.vehicles
    where id = (p_input->>'vehicleId')::uuid and owner_member_id = v_member
  ) then raise exception 'You can only schedule your own vehicle'; end if;
  insert into public.departure_rules(
    household_id, owner_member_id, vehicle_id, source, schedule_item_id,
    label, first_required_at, recurrence, travel_buffer_minutes, warning_minutes
  ) values (
    v_household, v_member, (p_input->>'vehicleId')::uuid,
    coalesce((p_input->>'source')::public.departure_source, 'manual'),
    nullif(p_input->>'scheduleItemId', '')::uuid,
    coalesce(nullif(trim(p_input->>'label'), ''), 'Departure'),
    (p_input->>'requiredAt')::timestamptz,
    p_input->'recurrence',
    coalesce((p_input->>'travelBufferMinutes')::integer, 30),
    coalesce(array(select jsonb_array_elements_text(p_input->'warningMinutes')::integer), array[60])
  ) returning id into v_id;
  return v_id;
end
$$;
revoke all on function private.create_departure_rule_impl(jsonb) from public;
grant execute on function private.create_departure_rule_impl(jsonb) to authenticated;

create or replace function public.create_departure_rule(p_input jsonb)
returns uuid language sql security invoker set search_path = ''
as $$ select private.create_departure_rule_impl(p_input) $$;

create or replace function private.generate_task_occurrences(p_horizon_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_task public.task_definitions%rowtype;
  v_house public.households%rowtype;
  v_date date;
  v_matches boolean;
  v_assignee uuid;
  v_count integer;
  v_inserted integer := 0;
  v_due timestamptz;
begin
  for v_task in
    select * from public.task_definitions where active
  loop
    select * into v_house from public.households where id = v_task.household_id;
    for v_date in
      select generate_series(
        greatest(v_task.starts_on, (now() at time zone v_house.timezone)::date),
        least(
          coalesce(v_task.ends_on, (now() at time zone v_house.timezone)::date + p_horizon_days),
          (now() at time zone v_house.timezone)::date + p_horizon_days
        ),
        interval '1 day'
      )::date
    loop
      v_matches := case coalesce(v_task.recurrence->>'frequency', 'weekly')
        when 'daily' then
          ((v_date - v_task.starts_on) % greatest(coalesce((v_task.recurrence->>'interval')::integer, 1), 1)) = 0
        when 'weekly' then
          (
            (v_task.recurrence->'weekdays' is null and extract(isodow from v_date) = extract(isodow from v_task.starts_on))
            or (v_task.recurrence->'weekdays') ? extract(isodow from v_date)::integer::text
          )
        when 'monthly' then extract(day from v_date) = extract(day from v_task.starts_on)
        when 'once' then v_date = v_task.starts_on
        else false
      end;
      if not v_matches then continue; end if;
      if v_task.assignment_mode = 'fixed' then
        v_assignee := v_task.fixed_member_id;
      elsif v_task.assignment_mode = 'rotation' then
        select count(*) into v_count from public.task_occurrences where task_id = v_task.id;
        select member_id into v_assignee
        from public.task_rotation_members
        where task_id = v_task.id and active
        order by position
        offset (v_count % greatest((select count(*) from public.task_rotation_members where task_id = v_task.id and active), 1))
        limit 1;
      else
        continue;
      end if;
      if v_assignee is null then continue; end if;
      v_due := (v_date + v_task.due_time) at time zone v_house.timezone;
      insert into public.task_occurrences(
        household_id, task_id, scheduled_date, assignee_member_id, due_at
      ) values (
        v_task.household_id, v_task.id, v_date, v_assignee, v_due
      ) on conflict (task_id, scheduled_date) do nothing;
      if found then
        v_inserted := v_inserted + 1;
        insert into public.notification_outbox(
          household_id, member_id, kind, entity_type, entity_id, scheduled_at,
          title, body, deep_link, urgency
        )
        select
          v_task.household_id, v_assignee, 'task_reminder', 'task_occurrence',
          o.id,
          (v_date + reminder.local_time) at time zone v_house.timezone,
          case when reminder.local_time = '23:30' then 'Last call: ' || v_task.title else v_task.title end,
          'Due by ' || to_char(v_task.due_time, 'HH12:MI AM'),
          '/chores',
          case when reminder.local_time = '23:30' then 'high' else 'normal' end
        from public.task_occurrences o
        cross join lateral (
          select (value->>'value')::time as local_time
          from jsonb_array_elements(coalesce(v_task.reminder_override, v_house.default_task_reminders))
          where value->>'type' = 'local_time'
        ) reminder
        where o.task_id = v_task.id and o.scheduled_date = v_date
          and (v_date + reminder.local_time) at time zone v_house.timezone < v_due
        on conflict do nothing;
      end if;
    end loop;
  end loop;
  return v_inserted;
end
$$;

create or replace function private.post_penalty(p_infraction_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.infractions%rowtype;
  v_transaction uuid;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if v_row.ledger_transaction_id is not null or v_row.status not in ('pending', 'disputed', 'upheld') then return; end if;
  insert into public.ledger_transactions(
    household_id, type, source_id, description, posted_at
  ) values (
    v_row.household_id, 'penalty', v_row.id, 'Missed chore penalty', now()
  ) returning id into v_transaction;
  insert into public.ledger_entries(
    household_id, transaction_id, member_id, amount_cents, fund_liability_cents
  ) values (
    v_row.household_id, v_transaction, v_row.member_id, -v_row.amount_cents, v_row.amount_cents
  );
  insert into public.ledger_entries(
    household_id, transaction_id, household_fund, amount_cents
  ) values (
    v_row.household_id, v_transaction, true, v_row.amount_cents
  );
  perform private.assert_balanced_transaction(v_transaction);
  update public.infractions
  set status = 'upheld', resolved_at = coalesce(resolved_at, now()),
      ledger_transaction_id = v_transaction
  where id = p_infraction_id;
end
$$;

create or replace function private.process_due_work()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.task_occurrences%rowtype;
  v_infraction public.infractions%rowtype;
  v_prior integer;
  v_missed integer := 0;
  v_finalized integer := 0;
begin
  perform private.generate_task_occurrences(30);
  for v_occurrence in
    select * from public.task_occurrences
    where status = 'assigned' and due_at < now()
    for update skip locked
  loop
    update public.task_occurrences set status = 'missed' where id = v_occurrence.id;
    select count(*) into v_prior
    from public.infractions
    where member_id = v_occurrence.assignee_member_id
      and status in ('upheld', 'paid')
      and created_at >= v_occurrence.due_at - interval '30 days'
      and created_at < v_occurrence.due_at;
    insert into public.infractions(
      household_id, occurrence_id, member_id, amount_cents, dispute_deadline
    ) values (
      v_occurrence.household_id, v_occurrence.id, v_occurrence.assignee_member_id,
      least(1000 + (v_prior * 500), 3000),
      v_occurrence.due_at + interval '24 hours'
    ) on conflict (occurrence_id) do nothing;
    update public.notification_outbox set status = 'cancelled'
    where entity_id = v_occurrence.id and status = 'pending';
    v_missed := v_missed + 1;
  end loop;
  for v_infraction in
    select * from public.infractions
    where status in ('pending', 'disputed', 'upheld')
      and dispute_deadline < now()
      and ledger_transaction_id is null
    for update skip locked
  loop
    perform private.post_penalty(v_infraction.id);
    v_finalized := v_finalized + 1;
  end loop;
  return jsonb_build_object('missed', v_missed, 'finalized', v_finalized);
end
$$;
revoke all on function private.generate_task_occurrences(integer) from public, anon, authenticated;
revoke all on function private.post_penalty(uuid) from public, anon, authenticated;
revoke all on function private.process_due_work() from public, anon, authenticated;
grant execute on function private.generate_task_occurrences(integer) to service_role;
grant execute on function private.process_due_work() to service_role;

create or replace function public.claim_notification_outbox(p_limit integer default 50)
returns setof public.notification_outbox
language sql
security invoker
set search_path = ''
as $$
  update public.notification_outbox
  set status = 'processing',
      locked_at = now(),
      attempts = attempts + 1
  where id in (
    select id
    from public.notification_outbox
    where status = 'pending' and scheduled_at <= now()
    order by scheduled_at
    for update skip locked
    limit greatest(1, least(p_limit, 100))
  )
  returning *
$$;
revoke all on function public.claim_notification_outbox(integer) from public, anon, authenticated;
grant execute on function public.claim_notification_outbox(integer) to service_role;

-- Read model for the money screen. Security invoker ensures the source-table
-- policies still apply to callers.
create view public.member_balances
with (security_invoker = true)
as
select
  hm.household_id,
  hm.id as member_id,
  coalesce(sum(le.contribution_cents), 0)::bigint as contribution_cents,
  coalesce(sum(le.resource_use_cents), 0)::bigint as resource_use_cents,
  coalesce(sum(le.settlement_adjustment_cents), 0)::bigint as settlement_adjustment_cents,
  coalesce(sum(le.amount_cents), 0)::bigint as net_cents,
  coalesce(sum(le.fund_liability_cents), 0)::bigint as fund_owed_cents
from public.household_members hm
left join public.ledger_entries le on le.member_id = hm.id
where hm.active
group by hm.household_id, hm.id;

-- RLS: every exposed table is enabled, including append-only operational rows.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','households','household_members','household_invites',
    'task_definitions','task_rotation_members','task_occurrences','infractions','infraction_votes',
    'ledger_transactions','ledger_entries','expenses','expense_payers','expense_shares','settlements','fund_payments',
    'calendar_events','event_audiences','course_imports','courses','schedule_items',
    'vehicles','driveway_state','driveway_positions','departure_rules','departure_occurrences',
    'notification_rules','push_subscriptions','notification_outbox','notification_attempts','audit_events'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create policy profiles_select_housemates on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or exists (
    select 1
    from public.household_members mine
    join public.household_members theirs on theirs.household_id = mine.household_id
    where mine.profile_id = (select auth.uid()) and mine.active and theirs.profile_id = profiles.id and theirs.active
  )
);
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy household_member_select on public.households for select to authenticated
using ((select private.is_household_member(id)));
create policy household_owner_update on public.households for update to authenticated
using ((select private.is_household_owner(id))) with check ((select private.is_household_owner(id)));

create policy memberships_select on public.household_members for select to authenticated
using ((select private.is_household_member(household_id)));
create policy invites_select_owner_or_email on public.household_invites for select to authenticated
using (
  (select private.is_household_owner(household_id))
  or lower(email) = lower((select p.email from public.profiles p where p.id = (select auth.uid())))
);
create policy invites_owner_insert on public.household_invites for insert to authenticated
with check ((select private.is_household_owner(household_id)));
create policy invites_owner_update on public.household_invites for update to authenticated
using ((select private.is_household_owner(household_id)))
with check ((select private.is_household_owner(household_id)));

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'task_definitions','task_rotation_members','task_occurrences','infractions','infraction_votes',
    'ledger_transactions','ledger_entries','expenses','expense_payers','expense_shares','settlements','fund_payments',
    'calendar_events','event_audiences','course_imports','courses','schedule_items',
    'vehicles','driveway_state','driveway_positions','departure_rules','departure_occurrences',
    'notification_rules','notification_outbox','notification_attempts','audit_events'
  ]
  loop
    execute format(
      'create policy %I on public.%I for select to authenticated using ((select private.is_household_member(household_id)))',
      table_name || '_household_select', table_name
    );
  end loop;
end $$;

create policy push_subscriptions_self_select on public.push_subscriptions for select to authenticated
using (member_id = (select private.current_member_id(household_id)));
create policy push_subscriptions_self_insert on public.push_subscriptions for insert to authenticated
with check (member_id = (select private.current_member_id(household_id)));
create policy push_subscriptions_self_update on public.push_subscriptions for update to authenticated
using (member_id = (select private.current_member_id(household_id)))
with check (member_id = (select private.current_member_id(household_id)));
create policy push_subscriptions_self_delete on public.push_subscriptions for delete to authenticated
using (member_id = (select private.current_member_id(household_id)));

-- Trusted peers may manage non-financial definitions directly. Sensitive state
-- remains RPC-only because no direct write policy is granted.
create policy task_definitions_member_insert on public.task_definitions for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy task_definitions_member_update on public.task_definitions for update to authenticated
using ((select private.is_household_member(household_id)))
with check ((select private.is_household_member(household_id)));
create policy calendar_events_member_insert on public.calendar_events for insert to authenticated
with check ((select private.is_household_member(household_id)));
create policy calendar_events_creator_update on public.calendar_events for update to authenticated
using (creator_member_id = (select private.current_member_id(household_id)))
with check (creator_member_id = (select private.current_member_id(household_id)));
create policy vehicles_member_insert on public.vehicles for insert to authenticated
with check (owner_member_id = (select private.current_member_id(household_id)));
create policy vehicles_owner_update on public.vehicles for update to authenticated
using (owner_member_id = (select private.current_member_id(household_id)))
with check (owner_member_id = (select private.current_member_id(household_id)));

-- Explicit Data API grants for 2026+ projects where SQL-created tables are no
-- longer automatically exposed.
grant select on all tables in schema public to authenticated;
grant update on public.profiles, public.households, public.task_definitions,
  public.calendar_events, public.vehicles, public.push_subscriptions to authenticated;
grant insert on public.household_invites, public.task_definitions,
  public.calendar_events, public.vehicles, public.push_subscriptions to authenticated;
grant delete on public.push_subscriptions to authenticated;
grant select on public.member_balances to authenticated;

revoke insert, update, delete on public.ledger_transactions, public.ledger_entries,
  public.expenses, public.expense_payers, public.expense_shares, public.settlements,
  public.fund_payments,
  public.task_occurrences, public.infractions, public.infraction_votes,
  public.audit_events, public.notification_outbox, public.notification_attempts
from authenticated, anon;

revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_household(text) to authenticated;
grant execute on function public.accept_household_invite(text) to authenticated;
grant execute on function public.create_household_invite(uuid, text) to authenticated;
grant execute on function public.create_task(jsonb) to authenticated;
grant execute on function public.update_task(uuid, jsonb) to authenticated;
grant execute on function public.complete_task_occurrence(uuid) to authenticated;
grant execute on function public.dispute_infraction(uuid, text) to authenticated;
grant execute on function public.cast_infraction_vote(uuid, public.infraction_vote_choice) to authenticated;
grant execute on function public.create_expense(jsonb) to authenticated;
grant execute on function public.reverse_expense(uuid, text) to authenticated;
grant execute on function public.propose_settlement(uuid, integer, text) to authenticated;
grant execute on function public.confirm_settlement(uuid, boolean) to authenticated;
grant execute on function public.propose_fund_payment(integer) to authenticated;
grant execute on function public.confirm_fund_payment(uuid, boolean) to authenticated;
grant execute on function public.upsert_calendar_event(jsonb) to authenticated;
grant execute on function public.reorder_driveway(uuid, bigint, uuid[]) to authenticated;
grant execute on function public.create_departure_rule(jsonb) to authenticated;

-- Private receipt storage. Object paths are household_id/expense_id/file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts', 'receipts', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy receipts_household_select on storage.objects for select to authenticated
using (
  bucket_id = 'receipts'
  and private.is_household_member((storage.foldername(name))[1]::uuid)
);
create policy receipts_household_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'receipts'
  and private.is_household_member((storage.foldername(name))[1]::uuid)
);

-- The SQL processor is safe to schedule directly. The push Edge Function is
-- scheduled after deployment because its URL/key live in Vault.
select cron.schedule(
  'howsehowld-process-due-work',
  '* * * * *',
  $$select private.process_due_work()$$
)
where not exists (
  select 1 from cron.job where jobname = 'howsehowld-process-due-work'
);
