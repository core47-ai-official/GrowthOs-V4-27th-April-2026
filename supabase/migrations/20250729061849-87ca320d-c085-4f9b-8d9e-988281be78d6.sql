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

-- Insert sample leaderboard data
INSERT INTO public.leaderboard (user_id, points, rank) VALUES
-- Generate some realistic user IDs and data
(gen_random_uuid(), 2450, 1),
(gen_random_uuid(), 2280, 2),
(gen_random_uuid(), 2150, 3),
('30026c0c-e14c-4bc1-82de-f275e66bcb9c', 1950, 4), -- Current user
(gen_random_uuid(), 1820, 5),
(gen_random_uuid(), 1675, 6),
(gen_random_uuid(), 1590, 7),
(gen_random_uuid(), 1480, 8),
(gen_random_uuid(), 1375, 9),
(gen_random_uuid(), 1250, 10),
(gen_random_uuid(), 1180, 11),
(gen_random_uuid(), 1095, 12);