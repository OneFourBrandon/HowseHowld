create index shared_courses_creator_idx
  on public.shared_courses(created_by_member_id);

create index shared_course_enrollments_member_idx
  on public.shared_course_enrollments(member_id);

create index shared_course_meetings_enrollment_idx
  on public.shared_course_meetings(course_id, member_id);

create index shared_course_assessments_enrollment_idx
  on public.shared_course_assessments(course_id, member_id);
