-- Add foreign key constraint between support_tickets and users
-- First check if the foreign key already exists, if not, add it
DO $$ 
BEGIN
    -- Check if foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'support_tickets_user_id_fkey' 
        AND table_name = 'support_tickets'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE public.support_tickets 
        ADD CONSTRAINT support_tickets_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Also add foreign key for ticket_replies if it doesn't exist
DO $$ 
BEGIN
    -- Check if foreign key constraint already exists
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'ticket_replies_user_id_fkey' 
        AND table_name = 'ticket_replies'
    ) THEN
        -- Add the foreign key constraint
        ALTER TABLE public.ticket_replies 
        ADD CONSTRAINT ticket_replies_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;