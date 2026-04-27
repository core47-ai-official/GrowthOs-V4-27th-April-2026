-- Fix critical security issues (corrected)

-- 1. Fix search_path for all security definer functions
ALTER FUNCTION public.is_module_completed SET search_path = '';
ALTER FUNCTION public.get_current_user_role SET search_path = '';
ALTER FUNCTION public.generate_student_id SET search_path = '';
ALTER FUNCTION public.notify_admins_user_created SET search_path = '';
ALTER FUNCTION public.create_student_atomic SET search_path = '';
ALTER FUNCTION public.audit_user SET search_path = '';
ALTER FUNCTION public.get_user_unlock_status SET search_path = '';
ALTER FUNCTION public.delete_student_atomic SET search_path = '';
ALTER FUNCTION public.notify_financial_events SET search_path = '';
ALTER FUNCTION public.notify_user_status_changes SET search_path = '';
ALTER FUNCTION public.is_recording_watched SET search_path = '';
ALTER FUNCTION public.handle_auth_user_deleted SET search_path = '';
ALTER FUNCTION public.create_notification SET search_path = '';
ALTER FUNCTION public.notify_all_students SET search_path = '';
ALTER FUNCTION public.notify_mentor_students SET search_path = '';
ALTER FUNCTION public.handle_module_changes SET search_path = '';
ALTER FUNCTION public.handle_recording_changes SET search_path = '';
ALTER FUNCTION public.handle_success_session_changes SET search_path = '';
ALTER FUNCTION public.handle_ticket_reply SET search_path = '';
ALTER FUNCTION public.handle_ticket_status_change SET search_path = '';
ALTER FUNCTION public.handle_badge_award SET search_path = '';
ALTER FUNCTION public.update_company_branding SET search_path = '';
ALTER FUNCTION public.get_user_lms_status SET search_path = '';
ALTER FUNCTION public.enqueue_student_onboarding_jobs SET search_path = '';
ALTER FUNCTION public.log_user_deletions SET search_path = '';
ALTER FUNCTION public.notify_submission_status_change SET search_path = '';
ALTER FUNCTION public.validate_questionnaire_structure SET search_path = '';
ALTER FUNCTION public.initialize_student_unlocks SET search_path = '';
ALTER FUNCTION public.unlock_next_recording SET search_path = '';
ALTER FUNCTION public.handle_new_student_unlock SET search_path = '';
ALTER FUNCTION public.handle_submission_approval SET search_path = '';
ALTER FUNCTION public.get_student_unlock_sequence SET search_path = '';
ALTER FUNCTION public.handle_submission_approval_unlock SET search_path = '';

-- 2. Remove temp_password and lms_password columns for security
ALTER TABLE public.users DROP COLUMN IF EXISTS temp_password;
ALTER TABLE public.users DROP COLUMN IF EXISTS lms_password;

-- 3. Add encrypted credentials storage
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS encrypted_shopify_credentials TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS encrypted_meta_ads_credentials TEXT;

-- 4. Update existing credentials to encrypted format (temporary - will be properly encrypted by edge function)
UPDATE public.users 
SET encrypted_shopify_credentials = shopify_credentials,
    shopify_credentials = NULL
WHERE shopify_credentials IS NOT NULL;

UPDATE public.users 
SET encrypted_meta_ads_credentials = meta_ads_credentials,
    meta_ads_credentials = NULL
WHERE meta_ads_credentials IS NOT NULL;