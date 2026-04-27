
-- 1) Create lesson_ratings table (used by useVideoRating) with RLS

create table if not exists public.lesson_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  recording_id uuid not null,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (user_id, recording_id)
);

alter table public.lesson_ratings enable row level security;

-- Users manage their own ratings
create policy if not exists "Users can manage their own ratings"
on public.lesson_ratings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Staff can view all lesson ratings
create policy if not exists "Staff can view all lesson ratings"
on public.lesson_ratings
for select
using (get_current_user_role() = any (array['admin','superadmin','mentor','enrollment_manager']));

create index if not exists idx_lesson_ratings_recording on public.lesson_ratings(recording_id);
create index if not exists idx_lesson_ratings_user on public.lesson_ratings(user_id);


-- 2) Automate LMS gating from invoices

-- Function to recalculate a user's LMS status from their invoices
create or replace function public.recalculate_lms_status(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_student_id uuid;
  v_overdue boolean;
  v_new_status text;
begin
  -- Find student record associated to this user
  select s.id
    into v_student_id
  from public.students s
  where s.user_id = p_user_id
  limit 1;

  if v_student_id is null then
    -- No student row, return current status
    return (select lms_status from public.users where id = p_user_id);
  end if;

  -- Overdue if any issued invoice past due date
  select exists (
    select 1
    from public.invoices i
    where i.student_id = v_student_id
      and i.status = 'issued'
      and i.due_date < now()
  ) into v_overdue;

  if v_overdue then
    v_new_status := 'suspended';
  else
    v_new_status := 'active';
  end if;

  update public.users
     set lms_status = v_new_status,
         updated_at = now()
   where id = p_user_id;

  return v_new_status;
end;
$$;

-- Trigger function to run whenever invoices change
create or replace function public.handle_invoice_change_lms()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid;
  v_student_id uuid;
begin
  v_student_id := coalesce(new.student_id, old.student_id);

  if v_student_id is null then
    return coalesce(new, old);
  end if;

  select s.user_id
    into v_user_id
  from public.students s
  where s.id = v_student_id
  limit 1;

  if v_user_id is not null then
    perform public.recalculate_lms_status(v_user_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_invoices_lms_update on public.invoices;

create trigger trg_invoices_lms_update
after insert or update of status, due_date, paid_at
on public.invoices
for each row
execute function public.handle_invoice_change_lms();


-- 3) Backfill: recalculate LMS status for all existing students now
do $$
declare
  r record;
begin
  for r in
    select u.id as user_id
    from public.users u
    where u.role = 'student'
  loop
    perform public.recalculate_lms_status(r.user_id);
  end loop;
end $$;
