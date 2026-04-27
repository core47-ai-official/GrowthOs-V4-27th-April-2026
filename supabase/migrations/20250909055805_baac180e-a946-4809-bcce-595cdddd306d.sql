-- Update the notify_on_invoice_issued function to include currency in payload
CREATE OR REPLACE FUNCTION public.notify_on_invoice_issued()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  student_user_id uuid;
  student_name text;
  company_currency text;
  payload jsonb;
begin
  -- Only when newly issued or status changed to issued
  if not (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from new.status)) then
    return coalesce(new, old);
  end if;

  if new.status <> 'issued' then
    return new;
  end if;

  select s.user_id, u.full_name
    into student_user_id, student_name
  from public.students s
  join public.users u on u.id = s.user_id
  where s.id = new.student_id
  limit 1;

  -- Get company currency
  select currency into company_currency 
  from public.company_settings 
  where id = 1 
  limit 1;

  payload := jsonb_build_object(
    'invoice_number', coalesce(new.installment_number::text, new.id::text),
    'student_name', coalesce(student_name, 'Student'),
    'amount', coalesce(new.amount::text,''),
    'currency', coalesce(company_currency, 'USD'),
    'due_date', coalesce(new.due_date::text,''),
    'invoice_id', new.id,
    'student_user_id', student_user_id
  );

  perform public.notify_roles(array['admin','superadmin'], 'invoice_issued', payload);
  if student_user_id is not null then
    perform public.notify_users(array[student_user_id], 'invoice_issued', payload);
  end if;

  return new;
end;
$function$;