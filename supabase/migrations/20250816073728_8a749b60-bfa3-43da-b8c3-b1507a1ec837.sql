-- Fix assignment status update issues - Delete duplicates and add constraint

-- Step 1: Delete duplicate submissions, keeping only the latest one for each student_id, assignment_id, version
DELETE FROM submissions 
WHERE id NOT IN (
  SELECT DISTINCT ON (student_id, assignment_id, version) id
  FROM submissions 
  ORDER BY student_id, assignment_id, version, created_at DESC
);

-- Step 2: Now renumber versions to be sequential for each student-assignment pair
WITH numbered_submissions AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY student_id, assignment_id 
      ORDER BY created_at ASC
    ) as new_version
  FROM submissions
)
UPDATE submissions 
SET version = ns.new_version
FROM numbered_submissions ns
WHERE submissions.id = ns.id;

-- Step 3: Add unique constraint to prevent future duplicates
ALTER TABLE submissions 
ADD CONSTRAINT unique_submission_version 
UNIQUE (student_id, assignment_id, version);

-- Step 4: Ensure submissions table is properly configured for real-time
ALTER TABLE submissions REPLICA IDENTITY FULL;