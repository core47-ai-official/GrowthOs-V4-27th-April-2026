-- Test user deletion audit functionality
BEGIN;

SELECT plan(4);

-- Test 1: Normal user deletion creates audit log
INSERT INTO auth.users (id, email) 
VALUES ('11111111-1111-1111-1111-111111111111', 'test1@example.com');

DELETE FROM auth.users 
WHERE id = '11111111-1111-1111-1111-111111111111';

SELECT ok(
  EXISTS(
    SELECT 1 FROM public.admin_logs 
    WHERE entity_id = '11111111-1111-1111-1111-111111111111'
    AND action = 'deleted'
    AND performed_by = '11111111-1111-1111-1111-111111111111'
  ),
  'Normal user deletion creates audit log'
);

-- Test 2: Service role deletion succeeds without audit log
-- Mock service role context
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);

INSERT INTO auth.users (id, email) 
VALUES ('22222222-2222-2222-2222-222222222222', 'service@example.com');

DELETE FROM auth.users 
WHERE id = '22222222-2222-2222-2222-222222222222';

SELECT ok(
  NOT EXISTS(
    SELECT 1 FROM public.admin_logs 
    WHERE entity_id = '22222222-2222-2222-2222-222222222222'
  ),
  'Service role deletion does not create audit log'
);

-- Test 3: Verify FK constraint allows NULL
SELECT ok(
  (SELECT is_nullable FROM information_schema.columns 
   WHERE table_name = 'admin_logs' AND column_name = 'performed_by') = 'YES',
  'admin_logs.performed_by column is nullable'
);

-- Test 4: Verify FK constraint is ON DELETE SET NULL
SELECT ok(
  EXISTS(
    SELECT 1 FROM information_schema.referential_constraints rc
    JOIN information_schema.table_constraints tc 
      ON rc.constraint_name = tc.constraint_name
    WHERE tc.table_name = 'admin_logs'
    AND rc.delete_rule = 'SET NULL'
  ),
  'FK constraint has ON DELETE SET NULL'
);

SELECT * FROM finish();
ROLLBACK;