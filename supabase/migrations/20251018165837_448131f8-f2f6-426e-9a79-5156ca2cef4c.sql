-- Create leaderboard_snapshots table for safe, performant leaderboard data
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_initials TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  progress INTEGER NOT NULL DEFAULT 0,
  videos_watched INTEGER NOT NULL DEFAULT 0,
  assignments_completed INTEGER NOT NULL DEFAULT 0,
  milestones_completed INTEGER NOT NULL DEFAULT 0,
  sessions_attended INTEGER NOT NULL DEFAULT 0,
  has_shopify BOOLEAN NOT NULL DEFAULT false,
  has_meta BOOLEAN NOT NULL DEFAULT false,
  streak INTEGER NOT NULL DEFAULT 0,
  rank INTEGER NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies: All authenticated users can read, only service role can write
CREATE POLICY "All authenticated users can view leaderboard"
  ON public.leaderboard_snapshots
  FOR SELECT
  TO authenticated
  USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_user_id ON public.leaderboard_snapshots(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_score ON public.leaderboard_snapshots(score DESC, progress DESC);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_calculated_at ON public.leaderboard_snapshots(calculated_at DESC);

-- Additional indexes for related tables to improve edge function performance
CREATE INDEX IF NOT EXISTS idx_recording_views_user_watched ON public.recording_views(user_id, watched) WHERE watched = true;
CREATE INDEX IF NOT EXISTS idx_submissions_student_status ON public.submissions(student_id, status) WHERE status = 'approved';
CREATE INDEX IF NOT EXISTS idx_session_attendance_user ON public.session_attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_user_source ON public.integrations(user_id, source);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);