-- Remove quiz-related database elements
DROP TABLE IF EXISTS quiz_questions;

-- Remove quiz_questions field from modules table
ALTER TABLE modules DROP COLUMN IF EXISTS quiz_questions;