-- Drop the existing trigger first
DROP TRIGGER IF EXISTS update_fees_cleared_on_invoice_paid ON public.invoices;

-- Drop the function with CASCADE in case there are other dependencies
DROP FUNCTION IF EXISTS public.update_student_fees_cleared_status() CASCADE;

-- Recreate the function with correct action value
CREATE OR REPLACE FUNCTION public.update_student_fees_cleared_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_user_id uuid;
  v_all_paid boolean;
BEGIN
  -- Only proceed if status changed to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    -- Get the student's user_id
    SELECT user_id INTO v_student_user_id
    FROM public.students
    WHERE id = NEW.student_id;
    
    -- Check if all invoices for this student are now paid
    SELECT NOT EXISTS(
      SELECT 1 FROM public.invoices
      WHERE student_id = NEW.student_id
      AND status != 'paid'
    ) INTO v_all_paid;
    
    -- If all invoices are paid, update fees_cleared
    IF v_all_paid THEN
      UPDATE public.students
      SET fees_cleared = true
      WHERE id = NEW.student_id;
      
      -- Log the fees cleared status change with allowed action value
      INSERT INTO public.admin_logs (
        entity_type,
        entity_id,
        action,
        description,
        performed_by,
        created_at
      ) VALUES (
        'student',
        v_student_user_id,
        'updated',
        'Student fees cleared - all installments paid',
        COALESCE(auth.uid(), v_student_user_id),
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER update_fees_cleared_on_invoice_paid
  AFTER UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_student_fees_cleared_status();