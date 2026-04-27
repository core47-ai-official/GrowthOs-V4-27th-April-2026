
-- Create a function to unlock the next recording after an assignment is approved
create or replace function public.unlock_next_recording(p_user_id uuid, p_current_recording_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  current_seq integer;
  next_recording_id uuid;
begin
  -- Determine current recording's sequence
  select sequence_order
    into current_seq
  from public.available_lessons
  where id = p_current_recording_id;

  if current_seq is null then
    -- If sequence order missing, try to fall back to the next by title
    select id
      into next_recording_id
    from public.available_lessons
    where id <> p_current_recording_id
    order by coalesce(sequence_order, 999), recording_title
    limit 1;

  else
    -- Find the next recording in sequence
    select id
      into next_recording_id
    from public.available_lessons
    where coalesce(sequence_order, 999) > coalesce(current_seq, 999)
    order by coalesce(sequence_order, 999), recording_title
    limit 1;
  end if;

  if next_recording_id is null then
    -- Nothing to unlock (last recording)
    return;
  end if;

  -- Record unlock in user_unlocks (assumes unique constraint on (user_id, recording_id))
  insert into public.user_unlocks (user_id, recording_id, is_unlocked, unlocked_at)
  values (p_user_id, next_recording_id, true, now())
  on conflict (user_id, recording_id)
  do update set is_unlocked = true, unlocked_at = excluded.unlocked_at;
end;
$function$;
