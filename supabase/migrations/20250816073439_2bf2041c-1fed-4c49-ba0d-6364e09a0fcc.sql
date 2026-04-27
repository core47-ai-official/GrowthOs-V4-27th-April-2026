-- Fix assignment status update issues

-- Step 1: Clean up duplicate version entries and add unique constraint
-- First, let's identify and fix any duplicate versions
UPDATE submissions 
SET version = (
  SELECT ROW_NUMBER() OVER (
    PARTITION BY student_id, assignment_id 
    ORDER BY created_at ASC
  )
  FROM submissions s2 
  WHERE s2.student_id = submissions.student_id 
    AND s2.assignment_id = submissions.assignment_id 
    AND s2.id = submissions.id
)
WHERE EXISTS (
  SELECT 1 
  FROM submissions s3 
  WHERE s3.student_id = submissions.student_id 
    AND s3.assignment_id = submissions.assignment_id 
    AND s3.version = submissions.version 
    AND s3.id != submissions.id
);

-- Step 2: Add unique constraint to prevent future duplicates
ALTER TABLE submissions 
ADD CONSTRAINT unique_submission_version 
UNIQUE (student_id, assignment_id, version);

-- Step 3: Ensure submissions table is properly configured for real-time
ALTER TABLE submissions REPLICA IDENTITY FULL;

-- Step 4: Add submissions table to realtime publication if not already added
DO $$
BEGIN
  -- Check if the table is already in the publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'submissions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE submissions;
  END IF;
END $$;