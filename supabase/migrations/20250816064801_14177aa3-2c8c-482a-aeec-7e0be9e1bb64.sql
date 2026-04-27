-- Update the student's fees_cleared status to true to unlock the first recording
UPDATE students 
SET fees_cleared = true 
WHERE user_id = 'c6b1cdd2-1188-46de-8431-9b10cbc137a4';