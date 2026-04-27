-- Fix generic validation trigger causing "record 'new' has no field 'payload'" on students updates
-- by avoiding direct NEW.<col> references across multiple tables

-- Replace validate_json_fields() with a safe version using to_jsonb(NEW)
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

  -- Validate students.answers_json if present
  IF TG_TABLE_NAME = 'students' AND (rec ? 'answers_json') AND NEW.answers_json IS NOT NULL THEN
    BEGIN
      PERFORM NEW.answers_json::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in answers_json: %', SQLERRM;
    END;
  END IF;

  -- Validate notifications.payload if present
  IF TG_TABLE_NAME = 'notifications' AND (rec ? 'payload') AND NEW.payload IS NOT NULL THEN
    BEGIN
      PERFORM NEW.payload::jsonb;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Invalid JSON in payload: %', SQLERRM;
    END;
  END IF;

  -- Validate submissions.file_urls and submissions.links if present
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