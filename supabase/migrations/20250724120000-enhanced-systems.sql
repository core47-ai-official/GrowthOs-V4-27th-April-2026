-- Create lesson ratings table for student feedback
CREATE TABLE IF NOT EXISTS lesson_ratings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL,
  lesson_title TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, recording_id)
);

-- Enable RLS on lesson_ratings
ALTER TABLE lesson_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for lesson_ratings
CREATE POLICY "Users can view their own ratings" ON lesson_ratings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own ratings" ON lesson_ratings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ratings" ON lesson_ratings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins and superadmins can view all ratings" ON lesson_ratings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Create company settings table
CREATE TABLE IF NOT EXISTS company_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  company_name TEXT NOT NULL DEFAULT 'Your Company',
  primary_phone TEXT NOT NULL DEFAULT '',
  secondary_phone TEXT,
  address TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  original_fee_amount DECIMAL(10,2) NOT NULL DEFAULT 3000.00,
  maximum_installment_count INTEGER NOT NULL DEFAULT 3 CHECK (maximum_installment_count >= 1 AND maximum_installment_count <= 12),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT single_settings_row CHECK (id = 1)
);

-- Enable RLS on company_settings
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings (only superadmins can access)
CREATE POLICY "Superadmins can manage company settings" ON company_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'superadmin'
    )
  );

-- Insert default company settings
INSERT INTO company_settings (id, company_name, primary_phone, address, contact_email) 
VALUES (1, 'Your Company', '+1 (555) 123-4567', '123 Business St, City, State 12345', 'contact@yourcompany.com')
ON CONFLICT (id) DO NOTHING;

-- Add trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lesson_ratings_updated_at
  BEFORE UPDATE ON lesson_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Fix assignment submissions RLS policies to ensure admins and superadmins see all submissions
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Users can insert their own submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Users can update their own unreviewed submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Mentors can view their assigned submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Mentors can update their assigned submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can view all submissions" ON assignment_submissions;
DROP POLICY IF EXISTS "Admins and superadmins can update all submissions" ON assignment_submissions;

-- Create comprehensive RLS policies for assignment_submissions
-- Students can view their own submissions
CREATE POLICY "Students can view own submissions" ON assignment_submissions
  FOR SELECT USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

-- Students can insert their own submissions
CREATE POLICY "Students can insert own submissions" ON assignment_submissions
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

-- Students can update their own unreviewed submissions
CREATE POLICY "Students can update own unreviewed submissions" ON assignment_submissions
  FOR UPDATE USING (
    auth.uid() = user_id AND 
    reviewed_at IS NULL AND
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'student')
  );

-- Mentors can view submissions from their assigned students
CREATE POLICY "Mentors can view assigned student submissions" ON assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users mentor
      WHERE mentor.id = auth.uid() 
      AND mentor.role = 'mentor'
      AND EXISTS (
        SELECT 1 FROM users student
        WHERE student.id = assignment_submissions.user_id
        AND student.mentor_id = mentor.id
      )
    )
  );

-- Mentors can update submissions from their assigned students
CREATE POLICY "Mentors can update assigned student submissions" ON assignment_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users mentor
      WHERE mentor.id = auth.uid() 
      AND mentor.role = 'mentor'
      AND EXISTS (
        SELECT 1 FROM users student
        WHERE student.id = assignment_submissions.user_id
        AND student.mentor_id = mentor.id
      )
    )
  );

-- Admins and superadmins can view ALL submissions (this ensures full visibility)
CREATE POLICY "Admins and superadmins view all submissions" ON assignment_submissions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Admins and superadmins can update ALL submissions
CREATE POLICY "Admins and superadmins update all submissions" ON assignment_submissions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'superadmin')
    )
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_user_recording ON lesson_ratings(user_id, recording_id);
CREATE INDEX IF NOT EXISTS idx_lesson_ratings_rating ON lesson_ratings(rating);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_status ON assignment_submissions(status);
CREATE INDEX IF NOT EXISTS idx_assignment_submissions_reviewed_at ON assignment_submissions(reviewed_at);

-- Function to check if a recording has been watched completely and trigger rating prompt
CREATE OR REPLACE FUNCTION check_recording_completion_for_rating(
  p_user_id UUID,
  p_recording_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if recording has been watched and no rating exists yet
  RETURN (
    EXISTS (
      SELECT 1 FROM recording_views
      WHERE user_id = p_user_id 
      AND recording_id = p_recording_id 
      AND watched = true
    )
    AND NOT EXISTS (
      SELECT 1 FROM lesson_ratings
      WHERE user_id = p_user_id 
      AND recording_id = p_recording_id
    )
  );
END;
$$;