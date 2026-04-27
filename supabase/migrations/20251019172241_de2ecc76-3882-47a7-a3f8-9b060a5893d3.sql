-- Safely fix generic JSON validation trigger to avoid "record 'NEW' has no field 'payload'" when used across multiple tables
-- Replaces the trigger function with a record-safe implementation and refreshes triggers

-- 1) Replace function with a version that never references NEW.<col> directly across tables
CREATE OR REPLACE FUNCTION public.validate_json_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  rec jsonb;
BEGIN
  rec := to_jsonb(NEW);

  -- Students.answers_json (only if the column exists on this NEW)
  IF TG_TABLE_NAME = 'students' AND (rec ? 'answers_json') AND NEW.answers_json IS NOT NULL THEN
    BEGIN
      PERFORM NEW.answers_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in answers_json: %', SQLERRM;
    END;
  END IF;

  -- Notifications.payload
  IF TG_TABLE_NAME = 'notifications' AND (rec ? 'payload') AND NEW.payload IS NOT NULL THEN
    BEGIN
      PERFORM NEW.payload::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in payload: %', SQLERRM;
    END;
  END IF;

  -- Submissions.file_urls / links
  IF TG_TABLE_NAME = 'submissions' THEN
    IF (rec ? 'file_urls') AND NEW.file_urls IS NOT NULL THEN
      BEGIN
        PERFORM NEW.file_urls::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid JSON in file_urls: %', SQLERRM;
      END;
    END IF;

    IF (rec ? 'links') AND NEW.links IS NOT NULL THEN
      BEGIN
        PERFORM NEW.links::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid JSON in links: %', SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_json_fields() IS 'Validates JSON columns safely across multiple tables using to_jsonb(NEW) checks.';

-- 2) Refresh triggers to ensure they reference the latest function definition
DO $$
BEGIN
  -- Students
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_students_json') THEN
    EXECUTE 'DROP TRIGGER validate_students_json ON public.students';
  END IF;
  EXECUTE 'CREATE TRIGGER validate_students_json BEFORE INSERT OR UPDATE ON public.students FOR EACH ROW EXECUTE FUNCTION public.validate_json_fields()';

  -- Notifications
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_notifications_json') THEN
    EXECUTE 'DROP TRIGGER validate_notifications_json ON public.notifications';
  END IF;
  EXECUTE 'CREATE TRIGGER validate_notifications_json BEFORE INSERT OR UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.validate_json_fields()';

  -- Submissions
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_submissions_json') THEN
    EXECUTE 'DROP TRIGGER validate_submissions_json ON public.submissions';
  END IF;
  EXECUTE 'CREATE TRIGGER validate_submissions_json BEFORE INSERT OR UPDATE ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.validate_json_fields()';
END $$;