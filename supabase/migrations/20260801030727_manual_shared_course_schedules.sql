create table public.shared_courses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  code text not null check (char_length(trim(code)) between 1 and 32),
  name text not null check (char_length(trim(name)) between 1 and 160),
  color text not null default '#568742' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by_member_id uuid not null references public.household_members(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index shared_courses_household_code_unique
  on public.shared_courses (household_id, lower(regexp_replace(trim(code), '\s+', '', 'g')));
create index shared_courses_household_idx on public.shared_courses(household_id);

create table public.shared_course_enrollments (
  course_id uuid not null references public.shared_courses(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  member_id uuid not null references public.household_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (course_id, member_id)
);
create index shared_course_enrollments_household_idx
  on public.shared_course_enrollments(household_id, member_id);

create table public.shared_course_meetings (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  course_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('lecture', 'lab')),
  weekday smallint not null check (weekday between 1 and 5),
  start_time time not null,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  location text check (location is null or char_length(location) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, member_id)
    references public.shared_course_enrollments(course_id, member_id)
    on delete cascade,
  unique (course_id, member_id, kind, weekday, start_time)
);
create index shared_course_meetings_household_weekday_idx
  on public.shared_course_meetings(household_id, weekday, start_time);

create table public.shared_course_assessments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  course_id uuid not null,
  member_id uuid not null,
  kind text not null check (kind in ('midterm', 'exam')),
  title text not null check (char_length(trim(title)) between 1 and 160),
  starts_at timestamptz not null,
  duration_minutes integer not null check (duration_minutes between 5 and 720),
  location text check (location is null or char_length(location) <= 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (course_id, member_id)
    references public.shared_course_enrollments(course_id, member_id)
    on delete cascade
);
create index shared_course_assessments_household_start_idx
  on public.shared_course_assessments(household_id, starts_at);

alter table public.shared_courses enable row level security;
alter table public.shared_course_enrollments enable row level security;
alter table public.shared_course_meetings enable row level security;
alter table public.shared_course_assessments enable row level security;

create policy shared_courses_household_select
on public.shared_courses for select to authenticated
using ((select private.is_household_member(household_id)));

create policy shared_courses_member_insert
on public.shared_courses for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and created_by_member_id = (select private.current_member_id(household_id))
);

create policy shared_courses_creator_update
on public.shared_courses for update to authenticated
using (created_by_member_id = (select private.current_member_id(household_id)))
with check (created_by_member_id = (select private.current_member_id(household_id)));

create policy shared_course_enrollments_household_select
on public.shared_course_enrollments for select to authenticated
using ((select private.is_household_member(household_id)));

create policy shared_course_enrollments_self_insert
on public.shared_course_enrollments for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and member_id = (select private.current_member_id(household_id))
  and exists (
    select 1 from public.shared_courses course
    where course.id = course_id and course.household_id = household_id
  )
);

create policy shared_course_enrollments_self_delete
on public.shared_course_enrollments for delete to authenticated
using (member_id = (select private.current_member_id(household_id)));

create policy shared_course_meetings_household_select
on public.shared_course_meetings for select to authenticated
using ((select private.is_household_member(household_id)));

create policy shared_course_meetings_self_insert
on public.shared_course_meetings for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and member_id = (select private.current_member_id(household_id))
);
create policy shared_course_meetings_self_update
on public.shared_course_meetings for update to authenticated
using (member_id = (select private.current_member_id(household_id)))
with check (member_id = (select private.current_member_id(household_id)));
create policy shared_course_meetings_self_delete
on public.shared_course_meetings for delete to authenticated
using (member_id = (select private.current_member_id(household_id)));

create policy shared_course_assessments_household_select
on public.shared_course_assessments for select to authenticated
using ((select private.is_household_member(household_id)));

create policy shared_course_assessments_self_insert
on public.shared_course_assessments for insert to authenticated
with check (
  (select private.is_household_member(household_id))
  and member_id = (select private.current_member_id(household_id))
);
create policy shared_course_assessments_self_update
on public.shared_course_assessments for update to authenticated
using (member_id = (select private.current_member_id(household_id)))
with check (member_id = (select private.current_member_id(household_id)));
create policy shared_course_assessments_self_delete
on public.shared_course_assessments for delete to authenticated
using (member_id = (select private.current_member_id(household_id)));

grant select, insert, update on public.shared_courses to authenticated;
grant select, insert, delete on public.shared_course_enrollments to authenticated;
grant select, insert, update, delete on public.shared_course_meetings to authenticated;
grant select, insert, update, delete on public.shared_course_assessments to authenticated;

create or replace function public.save_shared_course(p_input jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_household_id uuid := (p_input->>'householdId')::uuid;
  v_member_id uuid;
  v_course_id uuid := nullif(p_input->>'courseId', '')::uuid;
  v_code text := upper(trim(p_input->>'code'));
  v_name text := trim(p_input->>'name');
  v_color text := coalesce(nullif(p_input->>'color', ''), '#568742');
begin
  v_member_id := private.current_member_id(v_household_id);
  if v_member_id is null then raise exception 'Active household membership required'; end if;
  if v_code is null or v_name is null then raise exception 'Course code and name are required'; end if;

  if v_course_id is null then
    select id into v_course_id
    from public.shared_courses
    where household_id = v_household_id
      and lower(regexp_replace(trim(code), '\s+', '', 'g')) = lower(regexp_replace(v_code, '\s+', '', 'g'))
    limit 1;
  end if;

  if v_course_id is null then
    insert into public.shared_courses (household_id, code, name, color, created_by_member_id)
    values (v_household_id, v_code, v_name, v_color, v_member_id)
    returning id into v_course_id;
  else
    update public.shared_courses
    set name = v_name, color = v_color, updated_at = now()
    where id = v_course_id and household_id = v_household_id
      and created_by_member_id = v_member_id;
  end if;

  insert into public.shared_course_enrollments (course_id, household_id, member_id)
  values (v_course_id, v_household_id, v_member_id)
  on conflict (course_id, member_id) do nothing;

  delete from public.shared_course_meetings
  where course_id = v_course_id and member_id = v_member_id;
  insert into public.shared_course_meetings (
    household_id, course_id, member_id, kind, weekday, start_time, duration_minutes, location
  )
  select v_household_id, v_course_id, v_member_id,
    meeting.kind, meeting.weekday, meeting.start_time, meeting.duration_minutes,
    nullif(trim(meeting.location), '')
  from jsonb_to_recordset(coalesce(p_input->'meetings', '[]'::jsonb))
    as meeting(kind text, weekday smallint, start_time time, duration_minutes integer, location text);

  delete from public.shared_course_assessments
  where course_id = v_course_id and member_id = v_member_id;
  insert into public.shared_course_assessments (
    household_id, course_id, member_id, kind, title, starts_at, duration_minutes, location
  )
  select v_household_id, v_course_id, v_member_id,
    assessment.kind, trim(assessment.title), assessment.starts_at,
    assessment.duration_minutes, nullif(trim(assessment.location), '')
  from jsonb_to_recordset(coalesce(p_input->'assessments', '[]'::jsonb))
    as assessment(kind text, title text, starts_at timestamptz, duration_minutes integer, location text);

  return v_course_id;
end
$$;

revoke all on function public.save_shared_course(jsonb) from public, anon;
grant execute on function public.save_shared_course(jsonb) to authenticated;
