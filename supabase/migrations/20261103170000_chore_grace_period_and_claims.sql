-- Chores get an admin-configurable grace period before they count as missed,
-- every chore carries a penalty, and a roommate can cover a missed chore with
-- before and after photos that the uninvolved roommates review.

-- Grace period ---------------------------------------------------------------

alter table public.households add column chore_grace_minutes integer not null default 240
  constraint households_chore_grace_minutes_check check (chore_grace_minutes between 0 and 720);

create function private.update_chore_grace_period_impl(p_household_id uuid, p_minutes integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.household_members
    where id = private.current_member_id(p_household_id)
      and household_id = p_household_id and active and role = 'owner'
  ) then raise exception 'Only the admin can change the grace period.'; end if;
  if p_minutes is null or p_minutes not between 0 and 720 then
    raise exception 'Choose a grace period between 0 and 12 hours.';
  end if;
  update public.households set chore_grace_minutes = p_minutes where id = p_household_id;
end;
$$;
revoke all on function private.update_chore_grace_period_impl(uuid, integer) from public, anon;
grant execute on function private.update_chore_grace_period_impl(uuid, integer) to authenticated;

create function public.update_chore_grace_period(p_household_id uuid, p_minutes integer)
returns void language sql security invoker set search_path = '' as $$
  select private.update_chore_grace_period_impl(p_household_id, p_minutes);
$$;
revoke all on function public.update_chore_grace_period(uuid, integer) from public, anon;
grant execute on function public.update_chore_grace_period(uuid, integer) to authenticated;

-- The assignee can finish a chore until its grace period ends. The grace period
-- may run past midnight, so the end of the grace period is the only cutoff.
create or replace function private.complete_task_occurrence_impl(p_occurrence_id uuid)
returns public.task_occurrences
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.task_occurrences%rowtype;
  v_member uuid;
  v_is_rolling_queue boolean;
  v_house public.households%rowtype;
begin
  select * into v_row
  from public.task_occurrences
  where id = p_occurrence_id
  for update;

  if not found then raise exception 'Occurrence not found'; end if;

  v_member := private.current_member_id(v_row.household_id);
  if v_member is null or v_member <> v_row.assignee_member_id then
    raise exception 'Only the assignee can complete this task';
  end if;
  if v_row.status <> 'assigned' then
    raise exception 'This task can no longer be completed';
  end if;

  select * into v_house from public.households where id = v_row.household_id;

  if (now() at time zone v_house.timezone)::date < v_row.scheduled_date then
    raise exception 'This task can only be completed on its scheduled day';
  end if;
  if now() > v_row.due_at + make_interval(mins => v_house.chore_grace_minutes) then
    raise exception 'This task has expired';
  end if;

  select task.recurrence->>'frequency' = 'rolling_queue'
  into v_is_rolling_queue
  from public.task_definitions task
  where task.id = v_row.task_id;

  update public.task_occurrences
  set status = 'completed', completed_at = now(), completed_by = v_member
  where id = p_occurrence_id
  returning * into v_row;

  update public.notification_outbox
  set status = 'cancelled'
  where entity_id = p_occurrence_id and status = 'pending';

  if coalesce(v_is_rolling_queue, false) then
    perform private.ensure_rolling_queue_occurrences_impl(v_row.household_id, 30);
  end if;

  return v_row;
end
$$;

-- Every chore carries a penalty ----------------------------------------------
-- The miss processor never read this flag, so dropping it changes no behavior.

alter table public.task_definitions drop column penalty_enabled;

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
  v_mode public.task_assignment_mode := (p_input->>'assignmentMode')::public.task_assignment_mode;
  v_fixed uuid := nullif(p_input->>'fixedMemberId', '')::uuid;
  v_rotation jsonb := coalesce(p_input->'rotationMemberIds', '[]'::jsonb);
begin
  if v_member is null then raise exception 'Not a household member'; end if;
  if char_length(trim(coalesce(p_input->>'title', ''))) < 2 then
    raise exception 'Give the chore a name';
  end if;
  if v_mode = 'rotation' and jsonb_array_length(v_rotation) = 0 then
    raise exception 'A rotating task needs at least one roommate';
  end if;
  if v_mode = 'fixed' and not exists (
    select 1 from public.household_members
    where id = v_fixed and household_id = v_household and active
  ) then raise exception 'Choose an active fixed assignee'; end if;
  if exists (
    select 1
    from jsonb_array_elements_text(v_rotation) rotation_member
    left join public.household_members household_member
      on household_member.id = rotation_member.value::uuid
      and household_member.household_id = v_household
      and household_member.active
    where household_member.id is null
  ) then raise exception 'Rotation contains an invalid roommate'; end if;

  insert into public.task_definitions(
    household_id, title, description, area, assignment_mode, fixed_member_id,
    recurrence, starts_on, ends_on, due_time, reminder_override, created_by
  ) values (
    v_household,
    trim(p_input->>'title'),
    nullif(trim(p_input->>'description'), ''),
    coalesce(nullif(trim(p_input->>'area'), ''), 'House'),
    v_mode,
    case when v_mode = 'fixed' then v_fixed else null end,
    coalesce(p_input->'recurrence', '{"frequency":"weekly","interval":1}'::jsonb),
    coalesce(nullif(p_input->>'startsOn', '')::date, current_date),
    nullif(p_input->>'endsOn', '')::date,
    coalesce(nullif(p_input->>'dueTime', '')::time, '23:59'::time),
    case
      when p_input ? 'reminderTimes' then (
        select jsonb_agg(jsonb_build_object('type', 'local_time', 'value', value))
        from jsonb_array_elements_text(p_input->'reminderTimes')
      )
      else p_input->'reminderOverride'
    end,
    v_member
  ) returning id into v_task;

  insert into public.task_rotation_members(task_id, household_id, member_id, position)
  select v_task, v_household, value::text::uuid, ordinality - 1
  from jsonb_array_elements_text(v_rotation) with ordinality;

  perform private.generate_task_occurrences(30);
  return v_task;
end
$$;

-- Schedule edits rebuild only future assignments. A chore that is already past
-- due is either in its grace period or about to be marked missed, so an edit
-- must not quietly erase it.
create or replace function private.update_task_impl(p_task_id uuid, p_input jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_task public.task_definitions%rowtype;
  v_mode public.task_assignment_mode;
  v_fixed uuid;
  v_rotation jsonb;
  v_recurrence jsonb;
begin
  select * into v_task from public.task_definitions where id = p_task_id for update;
  if not found or v_task.deleted_at is not null then
    raise exception 'Task not found';
  end if;
  if not private.is_household_owner(v_task.household_id) then
    raise exception 'Only the household admin can edit chores';
  end if;

  v_mode := coalesce(nullif(p_input->>'assignmentMode', '')::public.task_assignment_mode, v_task.assignment_mode);
  v_fixed := case when p_input ? 'fixedMemberId' then nullif(p_input->>'fixedMemberId', '')::uuid else v_task.fixed_member_id end;
  if v_mode in ('fixed', 'manual', 'one_off') and v_fixed is not null and not exists (
    select 1 from public.household_members where id = v_fixed and household_id = v_task.household_id and active
  ) then raise exception 'Choose an active assignee'; end if;
  if v_mode = 'fixed' and v_fixed is null then raise exception 'Choose an active fixed assignee'; end if;

  v_recurrence := coalesce(p_input->'recurrence', v_task.recurrence);
  if v_recurrence->>'frequency' not in ('daily', 'weekly', 'monthly', 'once', 'rolling_queue')
    or coalesce((v_recurrence->>'interval')::integer, 0) not between 1 and 30
    or (v_recurrence->>'frequency' = 'rolling_queue' and v_mode <> 'rotation')
  then raise exception 'Invalid chore schedule'; end if;
  if v_recurrence->>'frequency' = 'weekly' and jsonb_array_length(coalesce(v_recurrence->'weekdays', '[]'::jsonb)) = 0 then
    raise exception 'Choose at least one weekday';
  end if;

  if p_input ?| array['startsOn', 'endsOn', 'dueTime', 'recurrence', 'assignmentMode', 'fixedMemberId', 'rotationMemberIds', 'reminderOverride', 'active'] then
    update public.notification_outbox set status = 'cancelled'
    where entity_type = 'task_occurrence' and status in ('pending', 'processing')
      and entity_id in (
        select id from public.task_occurrences
        where task_id = p_task_id and status = 'assigned' and due_at > now()
      );
    delete from public.task_occurrences o
    where o.task_id = p_task_id and o.status = 'assigned' and o.due_at > now()
      and not exists (select 1 from public.infractions i where i.occurrence_id = o.id);
  end if;

  update public.task_definitions set
    title = coalesce(nullif(trim(p_input->>'title'), ''), title),
    description = case when p_input ? 'description' then nullif(trim(p_input->>'description'), '') else description end,
    area = coalesce(nullif(trim(p_input->>'area'), ''), area),
    assignment_mode = v_mode,
    fixed_member_id = case when v_mode in ('fixed', 'manual', 'one_off') then v_fixed else null end,
    starts_on = coalesce(nullif(p_input->>'startsOn', '')::date, starts_on),
    ends_on = case when p_input ? 'endsOn' then nullif(p_input->>'endsOn', '')::date else ends_on end,
    due_time = coalesce(nullif(p_input->>'dueTime', '')::time, due_time),
    recurrence = v_recurrence,
    reminder_override = case when p_input ? 'reminderOverride' then p_input->'reminderOverride' else reminder_override end,
    active = coalesce((p_input->>'active')::boolean, active),
    updated_at = now()
  where id = p_task_id;

  if p_input ? 'rotationMemberIds' then
    v_rotation := coalesce(p_input->'rotationMemberIds', '[]'::jsonb);
    if v_mode = 'rotation' and jsonb_array_length(v_rotation) = 0 then
      raise exception 'A rotating task needs at least one roommate';
    end if;
    if exists (
      select 1 from jsonb_array_elements_text(v_rotation) r
      left join public.household_members hm on hm.id = r.value::uuid and hm.household_id = v_task.household_id and hm.active
      where hm.id is null
    ) then raise exception 'Rotation contains an invalid roommate'; end if;
    delete from public.task_rotation_members where task_id = p_task_id;
    insert into public.task_rotation_members(task_id, household_id, member_id, position)
    select p_task_id, v_task.household_id, value::text::uuid, ordinality - 1
    from jsonb_array_elements_text(v_rotation) with ordinality;
  end if;

  if p_input ?| array['startsOn', 'endsOn', 'dueTime', 'recurrence', 'assignmentMode', 'fixedMemberId', 'rotationMemberIds', 'reminderOverride', 'active'] then
    perform private.generate_task_occurrences(30);
    perform private.ensure_rolling_queue_occurrences_impl(v_task.household_id, 30);
  end if;
end;
$$;

-- Chore claims ---------------------------------------------------------------

create type public.chore_claim_status as enum ('claimed', 'submitted', 'approved', 'rejected', 'lapsed');
create type public.chore_claim_vote_choice as enum ('approve', 'reject');

create table public.chore_claims (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  occurrence_id uuid not null references public.task_occurrences(id) on delete restrict,
  infraction_id uuid not null references public.infractions(id) on delete restrict,
  claimer_member_id uuid not null references public.household_members(id),
  assignee_member_id uuid not null references public.household_members(id),
  status public.chore_claim_status not null default 'claimed',
  reward_cents integer not null check (reward_cents > 0),
  before_photo_path text not null,
  after_photo_path text,
  assignee_note text check (assignee_note is null or char_length(assignee_note) between 1 and 500),
  claim_deadline timestamptz not null,
  vote_deadline timestamptz,
  ledger_transaction_id uuid references public.ledger_transactions(id),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  resolved_at timestamptz,
  constraint chore_claims_not_own_chore check (claimer_member_id <> assignee_member_id),
  constraint chore_claims_distinct_photos check (after_photo_path is null or after_photo_path <> before_photo_path),
  constraint chore_claims_submission check (
    status in ('claimed', 'lapsed')
    or (after_photo_path is not null and submitted_at is not null and vote_deadline is not null)
  ),
  constraint chore_claims_resolution check ((status in ('approved', 'rejected', 'lapsed')) = (resolved_at is not null)),
  constraint chore_claims_payout check ((status = 'approved') = (ledger_transaction_id is not null))
);
-- One live claim per chore. A lapsed claim frees the chore for someone else.
create unique index chore_claims_one_live_claim_idx on public.chore_claims(occurrence_id) where status <> 'lapsed';
create index chore_claims_household_idx on public.chore_claims(household_id, created_at desc);
create index chore_claims_occurrence_idx on public.chore_claims(occurrence_id);
create index chore_claims_infraction_idx on public.chore_claims(infraction_id);
create index chore_claims_claimer_idx on public.chore_claims(claimer_member_id);
create index chore_claims_assignee_idx on public.chore_claims(assignee_member_id);
create index chore_claims_ledger_transaction_idx on public.chore_claims(ledger_transaction_id);
create index chore_claims_open_idx on public.chore_claims(status) where status in ('claimed', 'submitted');

create table public.chore_claim_votes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  claim_id uuid not null references public.chore_claims(id) on delete cascade,
  voter_member_id uuid not null references public.household_members(id),
  choice public.chore_claim_vote_choice not null,
  created_at timestamptz not null default now(),
  unique (claim_id, voter_member_id)
);
create index chore_claim_votes_household_idx on public.chore_claim_votes(household_id);
create index chore_claim_votes_voter_idx on public.chore_claim_votes(voter_member_id);

alter table public.chore_claims enable row level security;
alter table public.chore_claim_votes enable row level security;
create policy chore_claims_household_select on public.chore_claims for select to authenticated
using ((select private.is_household_member(household_id)));
create policy chore_claim_votes_household_select on public.chore_claim_votes for select to authenticated
using ((select private.is_household_member(household_id)));
-- Claims carry money, so every write goes through the RPCs below.
revoke all on public.chore_claims, public.chore_claim_votes from anon;
revoke insert, update, delete, truncate on public.chore_claims, public.chore_claim_votes from authenticated;
grant select on public.chore_claims, public.chore_claim_votes to authenticated;

create trigger audit_chore_claims after insert or update on public.chore_claims
for each row execute function private.audit_row_change();

do $$
declare
  v_table text;
begin
  foreach v_table in array array['chore_claims', 'chore_claim_votes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    exception when duplicate_object or undefined_object then
      null;
    end;
  end loop;
end
$$;

-- Private photo storage. Object paths are household_id/occurrence_id/file.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chore-claims', 'chore-claims', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy chore_claim_photos_household_select on storage.objects for select to authenticated
using (
  bucket_id = 'chore-claims'
  and private.is_household_member((storage.foldername(name))[1]::uuid)
);
-- Photos are evidence, so members can add them but never replace or delete them.
create policy chore_claim_photos_household_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'chore-claims'
  and private.is_household_member((storage.foldername(name))[1]::uuid)
);

-- Claims open when the grace period ends and close at the end of the day after
-- the chore's scheduled day, in the household's time zone.
create function private.chore_claim_deadline(p_scheduled_date date, p_timezone text)
returns timestamptz language sql stable set search_path = '' as $$
  select ((p_scheduled_date + 2)::timestamp) at time zone p_timezone
$$;
revoke all on function private.chore_claim_deadline(date, text) from public, anon, authenticated;

create function private.member_display_name(p_member_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((
    select profile.display_name
    from public.household_members member
    join public.profiles profile on profile.id = member.profile_id
    where member.id = p_member_id
  ), 'A roommate')
$$;
revoke all on function private.member_display_name(uuid) from public, anon, authenticated;

create function private.assert_chore_claim_photo(p_household_id uuid, p_occurrence_id uuid, p_path text)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_path is null
    or p_path not like p_household_id::text || '/' || p_occurrence_id::text || '/%'
    or position('..' in p_path) > 0
    or not exists (
      select 1 from storage.objects
      where bucket_id = 'chore-claims' and name = p_path
        and owner_id = (select auth.uid())::text
    )
  then
    raise exception 'Upload a photo of the chore first';
  end if;
end
$$;
revoke all on function private.assert_chore_claim_photo(uuid, uuid, text) from public, anon, authenticated;

create function private.claim_missed_chore_impl(p_occurrence_id uuid, p_before_photo_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_occurrence public.task_occurrences%rowtype;
  v_infraction public.infractions%rowtype;
  v_house public.households%rowtype;
  v_member uuid;
  v_deadline timestamptz;
  v_claim uuid;
  v_title text;
begin
  select * into v_occurrence from public.task_occurrences where id = p_occurrence_id for update;
  if not found then raise exception 'Chore not found'; end if;
  v_member := private.current_member_id(v_occurrence.household_id);
  if v_member is null then raise exception 'Only household members can cover a chore'; end if;
  if v_member = v_occurrence.assignee_member_id then raise exception 'You cannot cover your own chore'; end if;
  if v_occurrence.status <> 'missed' then raise exception 'Only missed chores can be covered'; end if;
  if (
    select count(*) from public.household_members
    where household_id = v_occurrence.household_id and active
  ) < 3 then
    raise exception 'Covering chores needs at least three roommates';
  end if;

  select * into v_house from public.households where id = v_occurrence.household_id;
  v_deadline := private.chore_claim_deadline(v_occurrence.scheduled_date, v_house.timezone);
  if now() >= v_deadline then raise exception 'The window to cover this chore has closed'; end if;

  select * into v_infraction from public.infractions where occurrence_id = v_occurrence.id for update;
  if not found
    or v_infraction.status not in ('pending', 'disputed', 'upheld')
    or v_infraction.ledger_transaction_id is not null
    or v_infraction.amount_cents <= 0
  then
    raise exception 'This chore can no longer be covered';
  end if;
  if exists (
    select 1 from public.chore_claims
    where occurrence_id = v_occurrence.id and status <> 'lapsed'
  ) then
    raise exception 'Someone is already covering this chore';
  end if;
  perform private.assert_chore_claim_photo(v_occurrence.household_id, v_occurrence.id, p_before_photo_path);

  insert into public.chore_claims(
    household_id, occurrence_id, infraction_id, claimer_member_id, assignee_member_id,
    reward_cents, before_photo_path, claim_deadline
  ) values (
    v_occurrence.household_id, v_occurrence.id, v_infraction.id, v_member,
    v_occurrence.assignee_member_id, least(1000, v_infraction.amount_cents),
    p_before_photo_path, v_deadline
  ) returning id into v_claim;

  select title into v_title from public.task_definitions where id = v_occurrence.task_id;
  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  ) values (
    v_occurrence.household_id, v_occurrence.assignee_member_id, 'chore_claim_started',
    'chore_claim', v_claim, now(), 'A roommate is covering your chore',
    private.member_display_name(v_member) || ' is covering ' || coalesce(v_title, 'your chore')
      || '. Add a note to the claim if you disagree.',
    '/chores', 'normal'
  ) on conflict do nothing;
  return v_claim;
end
$$;
revoke all on function private.claim_missed_chore_impl(uuid, text) from public, anon;
grant execute on function private.claim_missed_chore_impl(uuid, text) to authenticated;
create function public.claim_missed_chore(p_occurrence_id uuid, p_before_photo_path text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.claim_missed_chore_impl(p_occurrence_id, p_before_photo_path)
$$;
revoke all on function public.claim_missed_chore(uuid, text) from public, anon;
grant execute on function public.claim_missed_chore(uuid, text) to authenticated;

-- Books an approved claim: the assignee pays the full penalty, the roommate who
-- covered it receives up to $10, and the household fund receives the rest.
create function private.post_covered_penalty(p_claim_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims%rowtype;
  v_infraction public.infractions%rowtype;
  v_transaction uuid;
  v_fund_share integer;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  select * into v_infraction from public.infractions where id = v_claim.infraction_id for update;
  if v_infraction.ledger_transaction_id is not null
    or v_infraction.status not in ('pending', 'disputed', 'upheld')
  then
    raise exception 'This penalty was already settled';
  end if;
  v_fund_share := v_infraction.amount_cents - v_claim.reward_cents;
  if v_fund_share < 0 then raise exception 'The reward cannot exceed the penalty'; end if;

  insert into public.ledger_transactions(household_id, type, source_id, description, posted_at)
  values (v_claim.household_id, 'penalty', v_infraction.id, 'Missed chore penalty, covered by a roommate', now())
  returning id into v_transaction;
  insert into public.ledger_entries(household_id, transaction_id, member_id, amount_cents, fund_liability_cents)
  values (v_claim.household_id, v_transaction, v_infraction.member_id, -v_infraction.amount_cents, v_fund_share);
  insert into public.ledger_entries(household_id, transaction_id, member_id, amount_cents)
  values (v_claim.household_id, v_transaction, v_claim.claimer_member_id, v_claim.reward_cents);
  if v_fund_share > 0 then
    insert into public.ledger_entries(household_id, transaction_id, household_fund, amount_cents)
    values (v_claim.household_id, v_transaction, true, v_fund_share);
  end if;
  perform private.assert_balanced_transaction(v_transaction);

  update public.infractions
  set status = 'upheld', resolved_at = coalesce(resolved_at, now()), ledger_transaction_id = v_transaction
  where id = v_infraction.id;
  update public.chore_claims
  set status = 'approved', resolved_at = now(), ledger_transaction_id = v_transaction
  where id = p_claim_id;
  return v_transaction;
end
$$;
revoke all on function private.post_covered_penalty(uuid) from public, anon, authenticated;

-- Closes the vote once every uninvolved roommate has voted, or when the vote
-- window ends. More rejections than approvals rejects the claim, which clears
-- the assignee. A tie, or no votes at all, approves it on the photo evidence.
create function private.resolve_chore_claim(p_claim_id uuid)
returns public.chore_claim_status language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims%rowtype;
  v_eligible integer;
  v_approve integer;
  v_reject integer;
  v_status public.chore_claim_status;
  v_title text;
  v_claimer text;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if v_claim.status <> 'submitted' then return v_claim.status; end if;

  select count(*) into v_eligible
  from public.household_members member
  where member.household_id = v_claim.household_id and member.active
    and member.id not in (v_claim.claimer_member_id, v_claim.assignee_member_id);
  select count(*) filter (where vote.choice = 'approve'), count(*) filter (where vote.choice = 'reject')
  into v_approve, v_reject
  from public.chore_claim_votes vote
  join public.household_members member on member.id = vote.voter_member_id and member.active
  where vote.claim_id = p_claim_id
    and vote.voter_member_id not in (v_claim.claimer_member_id, v_claim.assignee_member_id);

  if now() < v_claim.vote_deadline and v_approve + v_reject < v_eligible then
    return 'submitted'::public.chore_claim_status;
  end if;

  if v_reject > v_approve then
    update public.chore_claims set status = 'rejected', resolved_at = now() where id = p_claim_id;
    update public.infractions set status = 'excused', resolved_at = now()
    where id = v_claim.infraction_id and ledger_transaction_id is null;
    v_status := 'rejected';
  else
    perform private.post_covered_penalty(p_claim_id);
    v_status := 'approved';
  end if;

  select task.title into v_title
  from public.task_occurrences occurrence
  join public.task_definitions task on task.id = occurrence.task_id
  where occurrence.id = v_claim.occurrence_id;
  v_title := coalesce(v_title, 'the chore');
  v_claimer := private.member_display_name(v_claim.claimer_member_id);
  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select v_claim.household_id, recipient.member_id, 'chore_claim_result', 'chore_claim', p_claim_id, now(),
    case when v_status = 'approved' then 'Chore claim approved' else 'Chore claim rejected' end,
    case
      when v_status = 'approved' then v_claimer || ' earned ' || to_char(v_claim.reward_cents / 100.0, 'FM$999,990.00')
        || ' for covering ' || v_title || '.'
      else 'The house rejected ' || v_claimer || '''s claim on ' || v_title || '. The missed chore was excused.'
    end,
    '/chores', 'normal'
  from (values (v_claim.claimer_member_id), (v_claim.assignee_member_id)) recipient(member_id)
  on conflict do nothing;
  return v_status;
end
$$;
revoke all on function private.resolve_chore_claim(uuid) from public, anon, authenticated;

create function private.submit_chore_claim_impl(p_claim_id uuid, p_after_photo_path text)
returns public.chore_claim_status language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims%rowtype;
  v_title text;
  v_claimer text;
  v_assignee text;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if private.current_member_id(v_claim.household_id) is distinct from v_claim.claimer_member_id then
    raise exception 'Only the roommate covering this chore can finish it';
  end if;
  if v_claim.status <> 'claimed' then raise exception 'This claim is no longer waiting for photos'; end if;
  if now() >= v_claim.claim_deadline then raise exception 'The window to finish this chore has closed'; end if;
  if p_after_photo_path is not distinct from v_claim.before_photo_path then
    raise exception 'Take a new photo after the chore is done';
  end if;
  perform private.assert_chore_claim_photo(v_claim.household_id, v_claim.occurrence_id, p_after_photo_path);

  update public.chore_claims
  set status = 'submitted', after_photo_path = p_after_photo_path,
      submitted_at = now(), vote_deadline = now() + interval '48 hours'
  where id = p_claim_id;

  select task.title into v_title
  from public.task_occurrences occurrence
  join public.task_definitions task on task.id = occurrence.task_id
  where occurrence.id = v_claim.occurrence_id;
  v_claimer := private.member_display_name(v_claim.claimer_member_id);
  v_assignee := private.member_display_name(v_claim.assignee_member_id);
  insert into public.notification_outbox(
    household_id, member_id, kind, entity_type, entity_id, scheduled_at,
    title, body, deep_link, urgency
  )
  select v_claim.household_id, member.id, 'chore_claim_review', 'chore_claim', p_claim_id, now(),
    'Review a covered chore',
    v_claimer || ' covered ' || v_assignee || '''s ' || coalesce(v_title, 'chore') || '. Check the photos and vote.',
    '/chores', 'normal'
  from public.household_members member
  where member.household_id = v_claim.household_id and member.active
    and member.id not in (v_claim.claimer_member_id, v_claim.assignee_member_id)
  on conflict do nothing;

  -- Resolves immediately if nobody is left to vote.
  return private.resolve_chore_claim(p_claim_id);
end
$$;
revoke all on function private.submit_chore_claim_impl(uuid, text) from public, anon;
grant execute on function private.submit_chore_claim_impl(uuid, text) to authenticated;
create function public.submit_chore_claim(p_claim_id uuid, p_after_photo_path text)
returns public.chore_claim_status language sql security invoker set search_path = '' as $$
  select private.submit_chore_claim_impl(p_claim_id, p_after_photo_path)
$$;
revoke all on function public.submit_chore_claim(uuid, text) from public, anon;
grant execute on function public.submit_chore_claim(uuid, text) to authenticated;

create function private.vote_chore_claim_impl(p_claim_id uuid, p_choice public.chore_claim_vote_choice)
returns public.chore_claim_status language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims%rowtype;
  v_voter uuid;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  if not found or v_claim.status <> 'submitted' or now() >= v_claim.vote_deadline then
    raise exception 'This vote is closed';
  end if;
  v_voter := private.current_member_id(v_claim.household_id);
  if v_voter is null then raise exception 'Only household members can vote'; end if;
  if v_voter in (v_claim.claimer_member_id, v_claim.assignee_member_id) then
    raise exception 'Only roommates outside this claim can vote';
  end if;
  if p_choice is null then raise exception 'Choose approve or reject'; end if;
  insert into public.chore_claim_votes(household_id, claim_id, voter_member_id, choice)
  values (v_claim.household_id, p_claim_id, v_voter, p_choice)
  on conflict (claim_id, voter_member_id)
  do update set choice = excluded.choice, created_at = now();
  return private.resolve_chore_claim(p_claim_id);
end
$$;
revoke all on function private.vote_chore_claim_impl(uuid, public.chore_claim_vote_choice) from public, anon;
grant execute on function private.vote_chore_claim_impl(uuid, public.chore_claim_vote_choice) to authenticated;
create function public.vote_chore_claim(p_claim_id uuid, p_choice public.chore_claim_vote_choice)
returns public.chore_claim_status language sql security invoker set search_path = '' as $$
  select private.vote_chore_claim_impl(p_claim_id, p_choice)
$$;
revoke all on function public.vote_chore_claim(uuid, public.chore_claim_vote_choice) from public, anon;
grant execute on function public.vote_chore_claim(uuid, public.chore_claim_vote_choice) to authenticated;

create function private.note_chore_claim_impl(p_claim_id uuid, p_note text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_claim public.chore_claims%rowtype;
begin
  select * into v_claim from public.chore_claims where id = p_claim_id for update;
  if not found then raise exception 'Claim not found'; end if;
  if private.current_member_id(v_claim.household_id) is distinct from v_claim.assignee_member_id then
    raise exception 'Only the roommate who missed the chore can add a note';
  end if;
  if v_claim.status not in ('claimed', 'submitted') then raise exception 'This claim is closed'; end if;
  if char_length(trim(coalesce(p_note, ''))) not between 1 and 500 then
    raise exception 'Notes must be between 1 and 500 characters';
  end if;
  update public.chore_claims set assignee_note = trim(p_note) where id = p_claim_id;
end
$$;
revoke all on function private.note_chore_claim_impl(uuid, text) from public, anon;
grant execute on function private.note_chore_claim_impl(uuid, text) to authenticated;
create function public.note_chore_claim(p_claim_id uuid, p_note text)
returns void language sql security invoker set search_path = '' as $$
  select private.note_chore_claim_impl(p_claim_id, p_note)
$$;
revoke all on function public.note_chore_claim(uuid, text) from public, anon;
grant execute on function public.note_chore_claim(uuid, text) to authenticated;

-- Claims replace the normal review --------------------------------------------
-- While a claim is open, and after it is approved, the infraction cannot be
-- disputed, voted on, or forgiven.

create function private.infraction_has_live_claim(p_infraction_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.chore_claims
    where infraction_id = p_infraction_id and status in ('claimed', 'submitted', 'approved')
  )
$$;
revoke all on function private.infraction_has_live_claim(uuid) from public, anon, authenticated;

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
  if private.infraction_has_live_claim(p_infraction_id) then
    raise exception 'A roommate covered this chore. Add a note to the claim instead.';
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

create or replace function private.cast_infraction_vote_impl(
  p_infraction_id uuid, p_vote public.infraction_vote_choice
)
returns public.infraction_status
language plpgsql security definer set search_path = '' as $$
declare
  v_row public.infractions%rowtype;
  v_voter uuid;
  v_uphold integer;
  v_excuse integer;
  v_status public.infraction_status;
begin
  select * into v_row from public.infractions where id = p_infraction_id for update;
  if not found or v_row.status not in ('pending', 'disputed') or now() >= v_row.dispute_deadline then
    raise exception 'This vote is closed';
  end if;
  if private.infraction_has_live_claim(p_infraction_id) then
    raise exception 'A roommate covered this chore, so the claim vote decides it';
  end if;
  v_voter := private.current_member_id(v_row.household_id);
  if v_voter is null then raise exception 'Only household members can vote'; end if;
  if p_vote is null then raise exception 'Choose excuse or uphold'; end if;
  insert into public.infraction_votes(household_id, infraction_id, voter_member_id, choice)
  values (v_row.household_id, p_infraction_id, v_voter, p_vote)
  on conflict (infraction_id, voter_member_id)
  do update set choice = excluded.choice, created_at = now();
  select count(*) filter (where choice = 'uphold'), count(*) filter (where choice = 'excuse')
  into v_uphold, v_excuse from public.infraction_votes where infraction_id = p_infraction_id;
  v_status := (case when v_uphold >= 2 then 'upheld'
    when v_excuse >= 2 then 'excused' else 'disputed' end)::public.infraction_status;
  update public.infractions set status = v_status,
    resolved_at = case when v_status <> 'disputed' then now() else resolved_at end
  where id = p_infraction_id;
  return v_status;
end
$$;

create or replace function private.forgive_infraction_impl(p_infraction_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_infraction public.infractions%rowtype;
  v_admin uuid;
  v_reversal uuid;
begin
  select * into v_infraction from public.infractions where id = p_infraction_id for update;
  if not found then raise exception 'Infraction not found'; end if;
  v_admin := private.current_member_id(v_infraction.household_id);
  if not exists (select 1 from public.household_members where id = v_admin
    and household_id = v_infraction.household_id and active and role = 'owner') then
    raise exception 'Only the admin can forgive an infraction';
  end if;
  if v_infraction.status = 'excused' then return; end if;
  if private.infraction_has_live_claim(p_infraction_id) then
    raise exception 'A roommate covered this chore, so it cannot be forgiven';
  end if;
  if v_infraction.ledger_transaction_id is not null then
    insert into public.ledger_transactions(
      household_id, type, source_id, reversal_of, description, created_by, posted_at
    ) values (
      v_infraction.household_id, 'penalty_reversal', v_infraction.id,
      v_infraction.ledger_transaction_id, 'Admin forgave missed chore penalty', v_admin, now()
    ) returning id into v_reversal;
    insert into public.ledger_entries(
      household_id, transaction_id, member_id, household_fund, amount_cents,
      contribution_cents, resource_use_cents, settlement_adjustment_cents, fund_liability_cents
    )
    select household_id, v_reversal, member_id, household_fund, -amount_cents,
      -contribution_cents, -resource_use_cents, -settlement_adjustment_cents, -fund_liability_cents
    from public.ledger_entries where transaction_id = v_infraction.ledger_transaction_id;
    perform private.assert_balanced_transaction(v_reversal);
  end if;
  update public.infractions set status = 'excused', resolved_at = now() where id = p_infraction_id;
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
  -- A claim settles its own penalty when it is decided.
  if private.infraction_has_live_claim(p_infraction_id) then return; end if;
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

-- Due work ---------------------------------------------------------------------

create or replace function private.process_due_work()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_occurrence public.task_occurrences%rowtype;
  v_infraction public.infractions%rowtype;
  v_household_id uuid;
  v_claim_id uuid;
  v_prior integer;
  v_tiers integer[];
  v_missed integer := 0;
  v_finalized integer := 0;
  v_departures integer := 0;
  v_calendar_notifications integer := 0;
  v_driveway_notifications integer := 0;
  v_claims_lapsed integer := 0;
  v_claims_resolved integer := 0;
begin
  perform private.generate_task_occurrences(30);
  v_departures := private.generate_departure_occurrences(30);
  v_calendar_notifications := private.enqueue_calendar_reminders();
  v_driveway_notifications := private.enqueue_departure_reminders();

  -- A chore counts as missed only once its household's grace period has ended.
  for v_occurrence in
    select occurrence.* from public.task_occurrences occurrence
    join public.households house on house.id = occurrence.household_id
    where occurrence.status = 'assigned' and occurrence.due_at < now()
      and occurrence.due_at + make_interval(mins => house.chore_grace_minutes) < now()
    for update of occurrence skip locked
  loop
    update public.task_occurrences set status = 'missed' where id = v_occurrence.id;
    select count(*) into v_prior
    from public.infractions
    where member_id = v_occurrence.assignee_member_id
      and status in ('upheld', 'paid')
      and created_at >= v_occurrence.due_at - interval '30 days'
      and created_at < v_occurrence.due_at;
    select penalty_tiers into v_tiers from public.households where id = v_occurrence.household_id;
    insert into public.infractions(
      household_id, occurrence_id, member_id, amount_cents, dispute_deadline
    ) values (
      v_occurrence.household_id, v_occurrence.id, v_occurrence.assignee_member_id,
      v_tiers[least(v_prior + 1, cardinality(v_tiers))],
      now() + interval '7 days'
    ) on conflict (occurrence_id) do nothing;
    update public.notification_outbox set status = 'cancelled'
    where entity_id = v_occurrence.id and status = 'pending';
    v_missed := v_missed + 1;
  end loop;

  -- This also creates the first item for a newly configured queue and advances
  -- queues whose previous item was marked missed above.
  for v_household_id in
    select distinct task.household_id
    from public.task_definitions task
    where task.active and task.recurrence->>'frequency' = 'rolling_queue'
  loop
    perform private.ensure_rolling_queue_occurrences_impl(v_household_id, 30);
  end loop;

  -- A claim without its after photo by the deadline lapses, and the infraction
  -- returns to the normal review.
  update public.chore_claims set status = 'lapsed', resolved_at = now()
  where status = 'claimed' and claim_deadline <= now();
  get diagnostics v_claims_lapsed = row_count;

  for v_claim_id in
    select id from public.chore_claims where status = 'submitted'
    for update skip locked
  loop
    if private.resolve_chore_claim(v_claim_id) <> 'submitted' then
      v_claims_resolved := v_claims_resolved + 1;
    end if;
  end loop;

  for v_infraction in
    select * from public.infractions infraction
    where infraction.status in ('pending', 'disputed', 'upheld')
      and infraction.dispute_deadline < now()
      and infraction.ledger_transaction_id is null
      and not private.infraction_has_live_claim(infraction.id)
    for update skip locked
  loop
    perform private.post_penalty(v_infraction.id);
    v_finalized := v_finalized + 1;
  end loop;

  return jsonb_build_object(
    'missed', v_missed,
    'finalized', v_finalized,
    'departures', v_departures,
    'calendar_notifications', v_calendar_notifications,
    'driveway_notifications', v_driveway_notifications,
    'claims_lapsed', v_claims_lapsed,
    'claims_resolved', v_claims_resolved
  );
end
$$;
