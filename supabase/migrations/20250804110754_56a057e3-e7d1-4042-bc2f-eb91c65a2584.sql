-- Fix the fees_structure format in create_student_atomic function
CREATE OR REPLACE FUNCTION public.create_student_atomic(p_full_name text, p_email text, p_phone text, p_installments integer, p_company_id uuid DEFAULT NULL::uuid, p_course_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_user_id UUID;
  v_student_id TEXT;
  v_result JSON;
  v_temp_password TEXT;
  v_fees_structure TEXT;
BEGIN
  -- Start transaction (implicit in function)
  
  -- Validate installments against company settings
  IF p_installments > (SELECT maximum_installment_count FROM public.company_settings LIMIT 1) THEN
    RAISE EXCEPTION 'Installments exceed maximum allowed';
  END IF;
  
  -- Check for existing email
  IF EXISTS (SELECT 1 FROM public.users WHERE email = p_email) THEN
    RAISE EXCEPTION 'A student with this email already exists' USING ERRCODE = '23505';
  END IF;
  
  -- Check for existing phone
  IF EXISTS (SELECT 1 FROM public.users WHERE phone = p_phone) THEN
    RAISE EXCEPTION 'A student with this phone number already exists' USING ERRCODE = '23505';
  END IF;
  
  -- Generate student ID
  SELECT 'STU' || LPAD(
    (COALESCE(MAX(CAST(SUBSTRING(student_id FROM 4) AS INTEGER)), 0) + 1)::TEXT, 
    6, '0'
  ) INTO v_student_id
  FROM public.users 
  WHERE role = 'student' AND student_id IS NOT NULL;
  
  -- Generate UUID for user
  v_user_id := gen_random_uuid();
  
  -- Generate temporary password
  v_temp_password := 'Temp' || LPAD((RANDOM() * 999999)::INTEGER::TEXT, 6, '0') || '!';
  
  -- Generate correct fees_structure format (singular for 1, plural for others)
  v_fees_structure := CASE 
    WHEN p_installments = 1 THEN '1_installment'
    ELSE p_installments::text || '_installments'
  END;
  
  -- Insert user record with all required fields including lms_password
  INSERT INTO public.users (
    id,
    email,
    full_name,
    phone,
    role,
    fees_structure,
    student_id,
    status,
    lms_status,
    lms_password,
    onboarding_done,
    created_at
  ) VALUES (
    v_user_id,
    p_email,
    p_full_name,
    p_phone,
    'student',
    v_fees_structure,
    v_student_id,
    'Active',
    'inactive',
    v_temp_password,
    false,
    now()
  );
  
  -- Create initial installment payment records
  INSERT INTO public.installment_payments (
    user_id,
    installment_number,
    total_installments,
    amount,
    status
  )
  SELECT 
    v_user_id,
    generate_series(1, p_installments),
    p_installments,
    (SELECT original_fee_amount FROM public.company_settings LIMIT 1) / p_installments,
    'pending';
  
  -- Create initial user activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    activity_type,
    metadata
  ) VALUES (
    v_user_id,
    'account_created',
    jsonb_build_object(
      'student_id', v_student_id,
      'installments', p_installments,
      'created_by', auth.uid()
    )
  );
  
  -- Log admin action
  INSERT INTO public.admin_logs (
    entity_type,
    entity_id,
    action,
    description,
    performed_by,
    data
  ) VALUES (
    'user',
    v_user_id,
    'created',
    'Student ' || v_student_id || ' created',
    auth.uid(),
    jsonb_build_object(
      'student_id', v_student_id,
      'full_name', p_full_name,
      'email', p_email,
      'phone', p_phone,
      'installments', p_installments,
      'fees_structure', v_fees_structure
    )
  );
  
  -- Return success with user data including temp password
  v_result := json_build_object(
    'success', true,
    'user_id', v_user_id,
    'student_id', v_student_id,
    'full_name', p_full_name,
    'email', p_email,
    'phone', p_phone,
    'fees_structure', v_fees_structure,
    'status', 'Active',
    'lms_status', 'inactive',
    'temp_password', v_temp_password
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error with better details
    INSERT INTO public.admin_logs (
      entity_type,
      entity_id,
      action,
      description,
      performed_by,
      data
    ) VALUES (
      'user',
      v_user_id,
      'creation_failed',
      'Student creation failed: ' || SQLERRM,
      auth.uid(),
      jsonb_build_object(
        'error', SQLERRM,
        'error_detail', SQLSTATE,
        'full_name', p_full_name,
        'email', p_email,
        'phone', p_phone,
        'installments', p_installments
      )
    );
    
    -- Re-raise the exception to trigger rollback
    RAISE;
END;
$function$