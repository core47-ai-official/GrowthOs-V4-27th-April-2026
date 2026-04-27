-- Add JSON validation and error handling improvements

-- Function to validate JSON columns before insert/update
CREATE OR REPLACE FUNCTION validate_json_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Validate students.answers_json
  IF TG_TABLE_NAME = 'students' AND NEW.answers_json IS NOT NULL THEN
    BEGIN
      PERFORM NEW.answers_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in answers_json: %', SQLERRM;
    END;
  END IF;

  -- Validate notifications.payload
  IF TG_TABLE_NAME = 'notifications' AND NEW.payload IS NOT NULL THEN
    BEGIN
      PERFORM NEW.payload::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in payload: %', SQLERRM;
    END;
  END IF;

  -- Validate submissions.file_urls and links
  IF TG_TABLE_NAME = 'submissions' THEN
    IF NEW.file_urls IS NOT NULL THEN
      BEGIN
        PERFORM NEW.file_urls::jsonb;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid JSON in file_urls: %', SQLERRM;
      END;
    END IF;
    IF NEW.links IS NOT NULL THEN
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

-- Add validation triggers if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_students_json') THEN
    CREATE TRIGGER validate_students_json
      BEFORE INSERT OR UPDATE ON public.students
      FOR EACH ROW
      EXECUTE FUNCTION validate_json_fields();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_notifications_json') THEN
    CREATE TRIGGER validate_notifications_json
      BEFORE INSERT OR UPDATE ON public.notifications
      FOR EACH ROW
      EXECUTE FUNCTION validate_json_fields();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'validate_submissions_json') THEN
    CREATE TRIGGER validate_submissions_json
      BEFORE INSERT OR UPDATE ON public.submissions
      FOR EACH ROW
      EXECUTE FUNCTION validate_json_fields();
  END IF;
END $$;

-- Add index for success_partner_messages to improve realtime performance
CREATE INDEX IF NOT EXISTS idx_success_partner_messages_user_timestamp 
ON public.success_partner_messages(user_id, timestamp DESC);

-- Add index for success_partner_credits lookups
CREATE INDEX IF NOT EXISTS idx_success_partner_credits_user_date 
ON public.success_partner_credits(user_id, date);

COMMENT ON FUNCTION validate_json_fields() IS 'Validates JSON columns to prevent malformed data';
