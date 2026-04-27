-- Add trigger to automatically set fees_cleared when all invoices are paid
-- This ensures students get access to content automatically after payment

-- Function to check and update fees_cleared status
CREATE OR REPLACE FUNCTION public.update_student_fees_cleared_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_student_id uuid;
  v_user_id uuid;
  v_total_invoices integer;
  v_paid_invoices integer;
BEGIN
  -- Get student_id and user_id from the invoice
  SELECT student_id INTO v_student_id FROM public.invoices WHERE id = NEW.id;
  SELECT user_id INTO v_user_id FROM public.students WHERE id = v_student_id;
  
  -- Count total and paid invoices for this student
  SELECT COUNT(*) INTO v_total_invoices
  FROM public.invoices
  WHERE student_id = v_student_id;
  
  SELECT COUNT(*) INTO v_paid_invoices
  FROM public.invoices
  WHERE student_id = v_student_id AND status = 'paid';
  
  -- If all invoices are paid, set fees_cleared = true
  IF v_total_invoices > 0 AND v_total_invoices = v_paid_invoices THEN
    UPDATE public.students
    SET fees_cleared = true
    WHERE id = v_student_id;
    
    -- Log the update
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      created_at
    ) VALUES (
      'student',
      v_user_id,
      'fees_cleared',
      'Fees automatically cleared after all invoices paid',
      v_user_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger on invoices table
DROP TRIGGER IF EXISTS trigger_update_fees_cleared ON public.invoices;

CREATE TRIGGER trigger_update_fees_cleared
AFTER UPDATE OF status ON public.invoices
FOR EACH ROW
WHEN (NEW.status = 'paid' AND OLD.status != 'paid')
EXECUTE FUNCTION public.update_student_fees_cleared_status();