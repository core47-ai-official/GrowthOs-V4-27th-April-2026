-- Add new columns to users table for student management
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS student_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_structure TEXT CHECK (fees_structure IN ('1_installment', '2_installments', '3_installments'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS lms_suspended BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_overdue BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_invoice_date TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_invoice_sent BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fees_due_date TIMESTAMPTZ;

-- Generate unique student IDs for existing students
UPDATE public.users 
SET student_id = 'STU' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::TEXT, 6, '0')
WHERE role = 'student' AND student_id IS NULL;

-- Create a function to auto-generate student IDs for new students
CREATE OR REPLACE FUNCTION generate_student_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'student' AND NEW.student_id IS NULL THEN
    NEW.student_id := 'STU' || LPAD(
      (SELECT COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1
       FROM public.users 
       WHERE role = 'student' AND student_id IS NOT NULL)::TEXT, 
      6, '0'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate student IDs
DROP TRIGGER IF EXISTS trigger_generate_student_id ON public.users;
CREATE TRIGGER trigger_generate_student_id
  BEFORE INSERT ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION generate_student_id();