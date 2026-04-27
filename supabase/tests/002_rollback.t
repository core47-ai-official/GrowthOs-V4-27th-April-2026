-- Test that down migration restores original behavior
BEGIN;

SELECT plan(3);

-- Apply down migration manually to test rollback
\i supabase/migrations/20250103152001_revert_admin_logs_fkey_and_trigger.sql

-- Test 1: Verify performed_by is NOT NULL again
SELECT ok(
  (SELECT is_nullable FROM information_schema.columns 
   WHERE table_name = 'admin_logs' AND column_name = 'performed_by') = 'NO',
  'After rollback: admin_logs.performed_by is NOT NULL'
);

-- Test 2: Verify FK constraint is ON DELETE RESTRICT
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'admin_logs'
    AND rc.delete_rule = 'RESTRICT'
  ),
  'After rollback: FK constraint has ON DELETE RESTRICT'
);

-- Test 3: Service role deletion should fail again
-- Mock service role context
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

INSERT INTO auth.users (id, email) 
VALUES ('33333333-3333-3333-3333-333333333333', 'rollback-test@example.com');

-- This should throw an error due to FK constraint violation
SELECT throws_ok(
  'DELETE FROM auth.users WHERE id = ''33333333-3333-3333-3333-333333333333''',
  '23503',
  'After rollback: service role deletion fails with FK violation'
);

SELECT * FROM finish();
ROLLBACK;