-- Create Super Milestone System Tables
-- Milestone Categories for organization
CREATE TABLE public.milestone_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#3B82F6',
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Main Milestones Table
CREATE TABLE public.milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.milestone_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT DEFAULT '🏆',
  badge_url TEXT,
  points INTEGER DEFAULT 10,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  
  -- Trigger Configuration
  trigger_type TEXT NOT NULL CHECK (trigger_type IN (
    'recording_watched', 'assignment_submitted', 'assignment_approved', 
    'integration_connected', 'course_completed', 'onboarding_completed',
    'time_based', 'performance_based', 'sequence_based', 'manual'
  )),
  trigger_config JSONB DEFAULT '{}',
  
  -- Celebration Settings
  show_celebration BOOLEAN DEFAULT false,
  celebration_message TEXT,
  celebration_config JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User Milestone Completions
CREATE TABLE public.user_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  milestone_id UUID REFERENCES public.milestones(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  awarded_by UUID, -- For manual awards
  notes TEXT,
  progress_data JSONB DEFAULT '{}',
  
  UNIQUE(user_id, milestone_id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.milestone_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_milestones ENABLE ROW LEVEL SECURITY;

-- RLS Policies for milestone_categories
CREATE POLICY "Everyone can view milestone categories" ON public.milestone_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage milestone categories" ON public.milestone_categories FOR ALL USING (get_current_user_role() = ANY(ARRAY['admin', 'superadmin'])) WITH CHECK (get_current_user_role() = ANY(ARRAY['admin', 'superadmin']));

-- RLS Policies for milestones
CREATE POLICY "Everyone can view milestones" ON public.milestones FOR SELECT USING (is_active = true);
CREATE POLICY "Admins can manage milestones" ON public.milestones FOR ALL USING (get_current_user_role() = ANY(ARRAY['admin', 'superadmin'])) WITH CHECK (get_current_user_role() = ANY(ARRAY['admin', 'superadmin']));

-- RLS Policies for user_milestones
CREATE POLICY "Users can view their own milestones" ON public.user_milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Staff can view all user milestones" ON public.user_milestones FOR SELECT USING (get_current_user_role() = ANY(ARRAY['admin', 'superadmin', 'mentor', 'enrollment_manager']));
CREATE POLICY "System can award milestones" ON public.user_milestones FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage user milestones" ON public.user_milestones FOR ALL USING (get_current_user_role() = ANY(ARRAY['admin', 'superadmin'])) WITH CHECK (get_current_user_role() = ANY(ARRAY['admin', 'superadmin']));

-- Insert Milestone Categories
INSERT INTO public.milestone_categories (name, description, icon, color, display_order) VALUES
('Learning', 'Course progress and learning achievements', '📚', '#10B981', 1),
('Integration', 'Platform and tool connections', '🔗', '#3B82F6', 2),
('Achievement', 'Performance and excellence awards', '🏆', '#F59E0B', 3),
('Special', 'Special recognition and badges', '⭐', '#8B5CF6', 4);

-- Insert Learning Milestones
INSERT INTO public.milestones (category_id, name, description, icon, trigger_type, trigger_config, show_celebration, celebration_message, display_order) VALUES
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'First Steps', 'Watched your first lesson - the journey begins!', '👶', 'recording_watched', '{"count": 1}', false, 'Welcome to your learning journey!', 1),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Product Market Fit Expert', 'Completed Product Market Fit module with assignment', '🎯', 'sequence_based', '{"recording_sequence": [1], "require_assignment": true}', false, 'You understand market validation!', 2),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Research Pro', 'Mastered product research techniques', '🔍', 'sequence_based', '{"recording_sequence": [2], "require_assignment": true}', false, 'Research skills unlocked!', 3),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Supplier Hunter', 'Learned advanced supplier finding strategies', '🏭', 'sequence_based', '{"recording_sequence": [3], "require_assignment": true}', false, 'Supplier network awaits!', 4),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Branding Guru', 'Completed branding and design modules', '🎨', 'sequence_based', '{"recording_sequence": [4,5,6,7,8], "require_assignment": true}', false, 'Brand master achieved!', 5),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Store Builder', 'Mastered store setup and optimization', '🏪', 'sequence_based', '{"recording_sequence": [9,10], "require_assignment": true}', false, 'Store building expertise!', 6),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Fast Learner', 'Completed 3 lessons in 24 hours', '⚡', 'time_based', '{"lessons_count": 3, "time_window": 24}', false, 'Speed learning champion!', 7),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Consistent Student', 'Watched videos 5 days in a row', '📅', 'time_based', '{"consecutive_days": 5, "activity": "video_watched"}', false, 'Consistency pays off!', 8),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Knowledge Seeker', 'Watched 10 lessons total', '🧠', 'recording_watched', '{"count": 10}', false, 'Curious mind at work!', 9),
((SELECT id FROM public.milestone_categories WHERE name = 'Learning'), 'Assignment Master', 'Submitted 5 assignments', '📝', 'assignment_submitted', '{"count": 5}', false, 'Assignment expert!', 10);

-- Insert Integration Milestones
INSERT INTO public.milestones (category_id, name, description, icon, trigger_type, trigger_config, show_celebration, celebration_message, display_order) VALUES
((SELECT id FROM public.milestone_categories WHERE name = 'Integration'), 'Connection Champion', 'Connected your Shopify store', '🛒', 'integration_connected', '{"platform": "shopify"}', false, 'Shopify integration complete!', 1),
((SELECT id FROM public.milestone_categories WHERE name = 'Integration'), 'Marketing Pro', 'Connected Meta Ads account', '📢', 'integration_connected', '{"platform": "meta_ads"}', false, 'Marketing tools ready!', 2),
((SELECT id FROM public.milestone_categories WHERE name = 'Integration'), 'Integration Master', 'Connected all required integrations', '🔗', 'integration_connected', '{"all_required": true}', true, 'All systems connected! You''re ready to scale!', 3),
((SELECT id FROM public.milestone_categories WHERE name = 'Integration'), 'Tech Savvy', 'Completed integrations within 7 days', '⚙️', 'time_based', '{"integrations_completed": true, "time_window": 168}', false, 'Technical excellence!', 4);

-- Insert Achievement Milestones
INSERT INTO public.milestones (category_id, name, description, icon, trigger_type, trigger_config, show_celebration, celebration_message, display_order) VALUES
((SELECT id FROM public.milestone_categories WHERE name = 'Achievement'), 'Early Bird', 'Completed onboarding within 48 hours', '🌅', 'onboarding_completed', '{"time_window": 48}', false, 'Quick starter advantage!', 1),
((SELECT id FROM public.milestone_categories WHERE name = 'Achievement'), 'High Achiever', 'Maintained 90%+ assignment approval rate', '📈', 'performance_based', '{"approval_rate": 90, "min_submissions": 3}', false, 'Excellence in execution!', 2),
((SELECT id FROM public.milestone_categories WHERE name = 'Achievement'), 'Perfect Student', 'Submitted all assignments on time', '⏰', 'performance_based', '{"on_time_rate": 100, "min_submissions": 5}', false, 'Time management master!', 3),
((SELECT id FROM public.milestone_categories WHERE name = 'Achievement'), 'Dedicated Learner', 'No missed lessons for 2 weeks', '🎯', 'time_based', '{"no_missed_lessons": 14}', false, 'Dedication recognized!', 4),
((SELECT id FROM public.milestone_categories WHERE name = 'Achievement'), 'Quality Controller', 'Received excellent feedback on 3 assignments', '⭐', 'performance_based', '{"excellent_feedback": 3}', false, 'Quality standard setter!', 5);

-- Insert Special Badge Milestones (with celebrations)
INSERT INTO public.milestones (category_id, name, description, icon, trigger_type, trigger_config, show_celebration, celebration_message, points, display_order) VALUES
((SELECT id FROM public.milestone_categories WHERE name = 'Special'), 'Graduation Star', 'Completed the entire course - congratulations!', '🌟', 'course_completed', '{"completion_rate": 100}', true, 'Congratulations! You''ve mastered the complete program! You''re now ready to build your successful business!', 100, 1),
((SELECT id FROM public.milestone_categories WHERE name = 'Special'), 'Elite Student', 'Top 10% performance across all metrics', '👑', 'performance_based', '{"top_percentile": 10, "all_metrics": true}', true, 'Elite status achieved! You''re among the best students in the program!', 75, 2),
((SELECT id FROM public.milestone_categories WHERE name = 'Special'), 'Innovation Award', 'Demonstrated creativity in assignments', '💡', 'manual', '{"requires_manual_award": true}', true, 'Innovation recognized! Your creative approach sets you apart!', 50, 3),
((SELECT id FROM public.milestone_categories WHERE name = 'Special'), 'Excellence Badge', 'Maintained 95%+ quality across all work', '🏅', 'performance_based', '{"quality_score": 95, "consistency": true}', true, 'Excellence achieved! Your consistent high performance is remarkable!', 60, 4),
((SELECT id FROM public.milestone_categories WHERE name = 'Special'), 'Community Leader', 'Helped other students and showed leadership', '👥', 'manual', '{"requires_manual_award": true, "leadership": true}', true, 'Leadership recognized! Thank you for helping build our community!', 40, 5);

-- Create milestone checking functions
CREATE OR REPLACE FUNCTION public.check_and_award_milestone(p_user_id UUID, p_milestone_type TEXT, p_context JSONB DEFAULT '{}')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  milestone_record RECORD;
  should_award BOOLEAN := false;
  existing_award UUID;
BEGIN
  -- Loop through all active milestones of the given type
  FOR milestone_record IN 
    SELECT * FROM public.milestones 
    WHERE trigger_type = p_milestone_type AND is_active = true
  LOOP
    -- Check if user already has this milestone
    SELECT id INTO existing_award FROM public.user_milestones 
    WHERE user_id = p_user_id AND milestone_id = milestone_record.id;
    
    IF existing_award IS NOT NULL THEN
      CONTINUE; -- Skip if already awarded
    END IF;
    
    -- Check milestone-specific conditions
    should_award := false;
    
    CASE milestone_record.trigger_type
      WHEN 'recording_watched' THEN
        -- Check if user has watched required number of recordings
        should_award := (
          SELECT COUNT(*) FROM public.recording_views rv
          WHERE rv.user_id = p_user_id AND rv.watched = true
        ) >= COALESCE((milestone_record.trigger_config->>'count')::INTEGER, 1);
        
      WHEN 'assignment_submitted' THEN
        -- Check if user has submitted required number of assignments
        should_award := (
          SELECT COUNT(*) FROM public.submissions s
          WHERE s.student_id = p_user_id
        ) >= COALESCE((milestone_record.trigger_config->>'count')::INTEGER, 1);
        
      WHEN 'assignment_approved' THEN
        -- Check if user has required number of approved assignments
        should_award := (
          SELECT COUNT(*) FROM public.submissions s
          WHERE s.student_id = p_user_id AND s.status = 'approved'
        ) >= COALESCE((milestone_record.trigger_config->>'count')::INTEGER, 1);
        
      WHEN 'integration_connected' THEN
        -- Check integration connections
        IF milestone_record.trigger_config ? 'platform' THEN
          should_award := EXISTS(
            SELECT 1 FROM public.integrations i
            WHERE i.user_id = p_user_id 
            AND i.source = (milestone_record.trigger_config->>'platform')
          );
        ELSIF milestone_record.trigger_config ? 'all_required' THEN
          -- Check if both Shopify and Meta Ads are connected
          should_award := (
            SELECT COUNT(DISTINCT source) FROM public.integrations
            WHERE user_id = p_user_id AND source IN ('shopify', 'meta_ads')
          ) >= 2;
        END IF;
        
      WHEN 'onboarding_completed' THEN
        -- Check if onboarding is completed
        should_award := EXISTS(
          SELECT 1 FROM public.students s
          WHERE s.user_id = p_user_id AND s.onboarding_completed = true
        );
        
      WHEN 'course_completed' THEN
        -- Check if all lessons are watched and assignments approved
        should_award := public.has_completed_all_modules(p_user_id);
        
      ELSE
        -- For other types, award based on context
        should_award := COALESCE((p_context->>'award')::BOOLEAN, false);
    END CASE;
    
    -- Award the milestone if conditions are met
    IF should_award THEN
      INSERT INTO public.user_milestones (user_id, milestone_id, progress_data)
      VALUES (p_user_id, milestone_record.id, p_context)
      ON CONFLICT (user_id, milestone_id) DO NOTHING;
      
      -- Create notification if milestone has celebration
      IF milestone_record.show_celebration THEN
        PERFORM public.create_notification(
          p_user_id,
          'milestone_celebration',
          '🎉 Milestone Achieved!',
          'You''ve earned the "' || milestone_record.name || '" milestone!',
          jsonb_build_object(
            'milestone_id', milestone_record.id,
            'milestone_name', milestone_record.name,
            'celebration_message', milestone_record.celebration_message,
            'points', milestone_record.points,
            'icon', milestone_record.icon
          )
        );
      END IF;
    END IF;
  END LOOP;
  
  RETURN true;
END;
$function$;

-- Create triggers for automatic milestone checking
CREATE OR REPLACE FUNCTION public.check_milestones_on_recording_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- Only check when watched status changes to true
  IF NEW.watched = true AND (OLD.watched IS NULL OR OLD.watched = false) THEN
    PERFORM public.check_and_award_milestone(NEW.user_id, 'recording_watched');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_milestones_on_submission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_and_award_milestone(NEW.student_id, 'assignment_submitted');
  ELSIF TG_OP = 'UPDATE' AND NEW.status = 'approved' AND OLD.status != 'approved' THEN
    PERFORM public.check_and_award_milestone(NEW.student_id, 'assignment_approved');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_milestones_on_integration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.check_and_award_milestone(NEW.user_id, 'integration_connected');
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.check_milestones_on_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.onboarding_completed = true AND (OLD.onboarding_completed IS NULL OR OLD.onboarding_completed = false) THEN
    PERFORM public.check_and_award_milestone(NEW.user_id, 'onboarding_completed');
  END IF;
  RETURN NEW;
END;
$function$;

-- Create the triggers
CREATE TRIGGER milestone_check_recording_view
  AFTER INSERT OR UPDATE ON public.recording_views
  FOR EACH ROW EXECUTE FUNCTION public.check_milestones_on_recording_view();

CREATE TRIGGER milestone_check_submission
  AFTER INSERT OR UPDATE ON public.submissions
  FOR EACH ROW EXECUTE FUNCTION public.check_milestones_on_submission();

CREATE TRIGGER milestone_check_integration
  AFTER INSERT ON public.integrations
  FOR EACH ROW EXECUTE FUNCTION public.check_milestones_on_integration();

CREATE TRIGGER milestone_check_onboarding
  AFTER UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.check_milestones_on_onboarding();

-- Update timestamps trigger
CREATE TRIGGER update_milestone_categories_updated_at
  BEFORE UPDATE ON public.milestone_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_milestones_updated_at
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();