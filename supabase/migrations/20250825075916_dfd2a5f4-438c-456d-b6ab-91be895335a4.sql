-- Phase 1: Remove pod, batch, and tenant features completely

-- Drop foreign key columns from existing tables
ALTER TABLE public.available_lessons DROP COLUMN IF EXISTS batch_id;
ALTER TABLE public.modules DROP COLUMN IF EXISTS tenant_id;

-- Drop the tables in correct order (respecting dependencies)
DROP TABLE IF EXISTS public.pods CASCADE;
DROP TABLE IF EXISTS public.batches CASCADE; 
DROP TABLE IF EXISTS public.tenants CASCADE;

-- Update the create_student_complete function to remove batch_id and pod_id parameters
CREATE OR REPLACE FUNCTION public.create_student_complete(
    p_email text, 
    p_password text, 
    p_full_name text, 
    p_phone text DEFAULT NULL::text, 
    p_address text DEFAULT NULL::text, 
    p_mentor_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
    v_user_id uuid;
    v_student_id uuid;
    v_password_display text;
    v_encrypted_password text;
    result jsonb;
BEGIN
    -- Generate a display password
    v_password_display := p_password;
    
    -- For security, we'll hash the password (in production, this should be done by auth system)
    v_encrypted_password := crypt(p_password, gen_salt('bf'));
    
    -- Create the user first
    INSERT INTO public.users (
        email,
        full_name,
        role,
        password_display,
        password_hash,
        is_temp_password,
        status,
        lms_status,
        created_at,
        updated_at
    ) VALUES (
        p_email,
        p_full_name,
        'student',
        v_password_display,
        v_encrypted_password,
        true,
        'active',
        'active',
        now(),
        now()
    ) RETURNING id INTO v_user_id;
    
    -- Create the student record with onboarding_completed = false
    INSERT INTO public.students (
        user_id,
        onboarding_completed,
        enrollment_date,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        false, -- Ensure onboarding is required
        now(),
        now(),
        now()
    ) RETURNING id INTO v_student_id;
    
    -- Return success result
    result := jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'student_id', v_student_id,
        'message', 'Student created successfully'
    );
    
    RETURN result;
    
EXCEPTION
    WHEN unique_violation THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User with this email already exists'
        );
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Failed to create student: ' || SQLERRM
        );
END;
$function$;