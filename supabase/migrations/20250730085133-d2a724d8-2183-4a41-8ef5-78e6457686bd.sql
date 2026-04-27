-- Create function to handle student welcome email workflow
CREATE OR REPLACE FUNCTION public.fn_send_student_welcome()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Fire only when a *new* student is inserted
  IF TG_OP = 'INSERT' AND NEW.role = 'student' THEN
    -- 1. Generate one-time password if missing (16 random chars)
    IF NEW.temp_password IS NULL THEN
      UPDATE public.users
         SET temp_password = encode(gen_random_bytes(12), 'hex')
       WHERE id = NEW.id;
      
      -- Get the updated temp_password for NEW record
      SELECT temp_password INTO NEW.temp_password 
      FROM public.users WHERE id = NEW.id;
    END IF;

    -- 2. Hash the temp password and store in lms_password
    -- Note: We'll handle bcrypt hashing in the edge function since postgres doesn't have bcrypt by default
    
    -- 3. Enqueue email sending job
    INSERT INTO public.messages (
      user_id,
      template_name,
      status,
      context
    ) VALUES (
      NEW.id,
      'student_onboarding',
      'queued',
      jsonb_build_object(
        'email', NEW.email,
        'full_name', NEW.full_name,
        'temp_password', NEW.temp_password,
        'user_id', NEW.id,
        'student_id', NEW.student_id
      )
    );

  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists and create new one
DROP TRIGGER IF EXISTS trg_send_student_welcome ON public.users;
CREATE TRIGGER trg_send_student_welcome
  AFTER INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_send_student_welcome();