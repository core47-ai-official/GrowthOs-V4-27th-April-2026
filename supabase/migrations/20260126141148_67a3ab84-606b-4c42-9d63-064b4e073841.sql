-- Add batch targeting to success sessions
alter table public.success_sessions
  add column if not exists batch_id uuid;

-- Add FK constraint (guarded)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'success_sessions_batch_id_fkey'
      and conrelid = 'public.success_sessions'::regclass
  ) then
    alter table public.success_sessions
      add constraint success_sessions_batch_id_fkey
      foreign key (batch_id)
      references public.batches(id)
      on delete set null;
  end if;
end $$;

create index if not exists idx_success_sessions_batch_id
  on public.success_sessions(batch_id);

-- Ensure RLS is enabled
alter table public.success_sessions enable row level security;

-- Replace overly-broad SELECT policy
drop policy if exists "All authenticated users can view success sessions" on public.success_sessions;

create policy "Role-based visibility for success sessions"
on public.success_sessions
for select
to authenticated
using (
  -- Staff can see all sessions
  (get_current_user_role() = any (array['admin'::text, 'superadmin'::text, 'enrollment_manager'::text]))

  -- Mentors see only their assigned sessions
  or (get_current_user_role() = 'mentor'::text and mentor_id = auth.uid())

  -- Students see sessions matching their ACTIVE enrollments (course + batch or unbatched)
  or (
    get_current_user_role() = 'student'::text
    and exists (
      select 1
      from public.students s
      join public.course_enrollments ce on ce.student_id = s.id
      where s.user_id = auth.uid()
        and ce.status = 'active'
        and ce.course_id = success_sessions.course_id
        and (
          (success_sessions.batch_id is null and ce.batch_id is null)
          or (success_sessions.batch_id = ce.batch_id)
        )
    )
  )
);
