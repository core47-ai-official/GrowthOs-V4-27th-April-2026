-- Add missing columns to users table (if they don't exist)
DO $$ 
BEGIN
    -- Add dream_goal_summary column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'dream_goal_summary') THEN
        ALTER TABLE public.users ADD COLUMN dream_goal_summary TEXT;
    END IF;
    
    -- Add shopify_credentials column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'shopify_credentials') THEN
        ALTER TABLE public.users ADD COLUMN shopify_credentials TEXT;
    END IF;
    
    -- Add meta_ads_credentials column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'meta_ads_credentials') THEN
        ALTER TABLE public.users ADD COLUMN meta_ads_credentials TEXT;
    END IF;
    
    -- Add lms_status column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lms_status') THEN
        ALTER TABLE public.users ADD COLUMN lms_status TEXT DEFAULT 'inactive';
    END IF;
    
    -- Add lms_user_id column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'lms_user_id') THEN
        ALTER TABLE public.users ADD COLUMN lms_user_id TEXT;
    END IF;
    
    -- Add last_active_at column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'last_active_at') THEN
        ALTER TABLE public.users ADD COLUMN last_active_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;