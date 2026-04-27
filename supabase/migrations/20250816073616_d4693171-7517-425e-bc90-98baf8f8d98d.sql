-- Fix assignment status update issues - Step 1: Clean duplicates first

-- First, create a temporary table to track which submissions to keep
CREATE TEMP TABLE submissions_to_keep AS (
  SELECT DISTINCT ON (student_id, assignment_id, version)
    id,
    student_id, 
    assignment_id, 
    version,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, assignment_id 
      ORDER BY created_at ASC
    ) as new_version
  FROM submissions
  ORDER BY student_id, assignment_id, version, created_at DESC
);

-- Update version numbers to be sequential for each student-assignment pair
UPDATE submissions 
SET version = stk.new_version
FROM submissions_to_keep stk
WHERE submissions.id = stk.id;

-- Now add the unique constraint
ALTER TABLE submissions 
ADD CONSTRAINT unique_submission_version 
UNIQUE (student_id, assignment_id, version);

-- Ensure submissions table is properly configured for real-time
ALTER TABLE submissions REPLICA IDENTITY FULL;