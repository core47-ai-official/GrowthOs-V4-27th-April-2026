-- Fix the update_student_fees_cleared_status trigger function
-- Change entity_type to 'user' (allowed value) and add error handling for admin_logs

CREATE OR REPLACE FUNCTION public.update_student_fees_cleared_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_student_id uuid;
  v_student_user_id uuid;
  v_total_invoices int;
  v_paid_invoices int;
BEGIN
  -- Get student_id from the invoice
  v_student_id := COALESCE(NEW.student_id, OLD.student_id);
  
  IF v_student_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Get the user_id for this student
  SELECT user_id INTO v_student_user_id
  FROM public.students
  WHERE id = v_student_id;
  
  IF v_student_user_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  
  -- Count total invoices and paid invoices for this student
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'paid')
  INTO v_total_invoices, v_paid_invoices
  FROM public.invoices
  WHERE student_id = v_student_id;
  
  -- If all invoices are paid, set fees_cleared to true
  IF v_total_invoices > 0 AND v_total_invoices = v_paid_invoices THEN
    UPDATE public.students
    SET fees_cleared = true,
        updated_at = now()
    WHERE id = v_student_id
      AND fees_cleared = false;
    
    -- Log the fees cleared action (with error handling to prevent blocking)
    BEGIN
      INSERT INTO public.admin_logs (
        entity_type,
        entity_id,
        action,
        description,
        performed_by,
        created_at,
        data
      ) VALUES (
        'user',  -- Use 'user' instead of 'student' to satisfy check constraint
        v_student_user_id,
        'updated',
        'Student fees marked as cleared - all invoices paid',
        v_student_user_id,
        now(),
        jsonb_build_object(
          'student_id', v_student_id,
          'user_id', v_student_user_id,
          'total_invoices', v_total_invoices,
          'paid_invoices', v_paid_invoices
        )
      );
    EXCEPTION
      WHEN OTHERS THEN
        -- Log the error but don't block the transaction
        RAISE NOTICE 'Failed to log fees_cleared status to admin_logs: %', SQLERRM;
    END;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;