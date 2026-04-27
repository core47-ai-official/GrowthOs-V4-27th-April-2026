-- Enable RLS on leaderboard table
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Create policy to allow everyone to view leaderboard data
CREATE POLICY "Everyone can view leaderboard" 
ON public.leaderboard 
FOR SELECT 
USING (true);

-- Create policy to allow system to insert/update leaderboard data
CREATE POLICY "System can manage leaderboard" 
ON public.leaderboard 
FOR ALL 
USING (auth.role() = 'service_role'::text);

-- Insert sample leaderboard data using the current user and some mock entries
-- Note: We'll only insert for the current user for now
INSERT INTO public.leaderboard (user_id, points, rank) VALUES
('30026c0c-e14c-4bc1-82de-f275e66bcb9c', 1950, 4); -- Current user