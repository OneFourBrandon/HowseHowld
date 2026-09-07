revoke all on table public.shared_courses from public, anon, authenticated;
revoke all on table public.shared_course_enrollments from public, anon, authenticated;
revoke all on table public.shared_course_meetings from public, anon, authenticated;
revoke all on table public.shared_course_assessments from public, anon, authenticated;

grant select, insert, update on table public.shared_courses to authenticated;
grant select, insert, delete on table public.shared_course_enrollments to authenticated;
grant select, insert, update, delete on table public.shared_course_meetings to authenticated;
grant select, insert, update, delete on table public.shared_course_assessments to authenticated;
