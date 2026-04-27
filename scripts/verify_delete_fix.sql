-- Verification script for admin_logs FK fix
-- Run with: psql -f scripts/verify_delete_fix.sql

\echo '=== FK Constraint Check ==='
SELECT 
  rc.delete_rule as "ON DELETE",
  cols.is_nullable as "NULLABLE"
FROM information_schema.referential_constraints rc
JOIN information_schema.table_constraints tc 
  ON rc.constraint_name = tc.constraint_name
JOIN information_schema.columns cols
  ON cols.table_name = tc.table_name 
  AND cols.column_name = 'performed_by'
WHERE tc.table_name = 'admin_logs'
  AND tc.constraint_type = 'FOREIGN KEY';

\echo '=== Latest Admin Logs ==='
SELECT 
  entity_type,
  action,
  performed_by,
  created_at
FROM public.admin_logs 
ORDER BY created_at DESC 
LIMIT 5;

\echo '=== Testing User Deletion ==='
DO $$
DECLARE
  test_id uuid := 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
  deletion_success boolean := false;
  constraint_violations int := 0;
BEGIN
  -- Insert test user
  INSERT INTO auth.users (id, email) 
  VALUES (test_id, 'verify-test@example.com');
  
  -- Attempt deletion
  BEGIN
    DELETE FROM auth.users WHERE id = test_id;
    deletion_success := true;
  EXCEPTION 
    WHEN foreign_key_violation THEN
      constraint_violations := constraint_violations + 1;
    WHEN OTHERS THEN
      RAISE NOTICE 'Unexpected error: %', SQLERRM;
  END;
  
  -- Output results
  RAISE NOTICE 'delete_ok: %', deletion_success;
  RAISE NOTICE 'constraint_violation: %', constraint_violations;
END $$;