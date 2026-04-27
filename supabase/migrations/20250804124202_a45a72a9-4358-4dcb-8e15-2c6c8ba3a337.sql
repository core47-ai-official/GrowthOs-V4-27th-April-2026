-- Drop the old broken function if it exists
DROP FUNCTION IF EXISTS create_student_atomic(text, text, text, text, text, uuid, text, text);

-- Create comprehensive student creation function
CREATE OR REPLACE FUNCTION create_student_complete(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_mentor_id uuid DEFAULT NULL,
  p_batch_id uuid DEFAULT NULL,
  p_pod_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_data jsonb;
  v_result jsonb;
BEGIN
  -- Input validation
  IF p_email IS NULL OR p_email = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Email is required',
      'error_code', 'INVALID_EMAIL'
    );
  END IF;

  IF p_password IS NULL OR p_password = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Password is required',
      'error_code', 'INVALID_PASSWORD'
    );
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Full name is required',
      'error_code', 'INVALID_NAME'
    );
  END IF;

  -- Validate mentor exists if provided
  IF p_mentor_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_mentor_id AND role = 'mentor') THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid mentor ID',
        'error_code', 'INVALID_MENTOR'
      );
    END IF;
  END IF;

  -- Validate batch exists if provided
  IF p_batch_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM batches WHERE id = p_batch_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid batch ID',
        'error_code', 'INVALID_BATCH'
      );
    END IF;
  END IF;

  -- Validate pod exists if provided
  IF p_pod_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM pods WHERE id = p_pod_id) THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'Invalid pod ID',
        'error_code', 'INVALID_POD'
      );
    END IF;
  END IF;

  BEGIN
    -- Create auth user
    SELECT auth.uid() INTO v_user_id;
    
    -- Insert into users table
    INSERT INTO users (
      id,
      email,
      password,
      full_name,
      role,
      phone,
      address,
      mentor_id,
      batch_id,
      pod_id,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      p_email,
      p_password,
      p_full_name,
      'student',
      p_phone,
      p_address,
      p_mentor_id,
      p_batch_id,
      p_pod_id,
      now(),
      now()
    ) RETURNING id INTO v_user_id;

    -- Initialize user progress for all modules
    INSERT INTO user_module_progress (user_id, module_id, is_completed, created_at, updated_at)
    SELECT v_user_id, m.id, false, now(), now()
    FROM modules m;

    -- Initialize progress tracking
    INSERT INTO progress (user_id, module_id, status, time_spent_min, score)
    SELECT v_user_id, m.id, 'not_started', 0, 0
    FROM modules m;

    -- Get created user data
    SELECT jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'full_name', u.full_name,
      'role', u.role,
      'phone', u.phone,
      'address', u.address,
      'mentor_id', u.mentor_id,
      'batch_id', u.batch_id,
      'pod_id', u.pod_id,
      'created_at', u.created_at
    ) INTO v_user_data
    FROM users u
    WHERE u.id = v_user_id;

    -- Return success result
    RETURN jsonb_build_object(
      'success', true,
      'data', v_user_data,
      'message', 'Student created successfully'
    );

  EXCEPTION WHEN OTHERS THEN
    -- Log the error
    RAISE LOG 'Error creating student: %', SQLERRM;
    
    -- Return error result
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Failed to create student: ' || SQLERRM,
      'error_code', 'CREATION_FAILED'
    );
  END;
END;
$$;