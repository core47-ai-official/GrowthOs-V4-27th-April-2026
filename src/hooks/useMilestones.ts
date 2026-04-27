import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { safeLogger } from '@/lib/safe-logger';

export interface MilestoneCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
}

export interface Milestone {
  id: string;
  category_id: string;
  name: string;
  description: string;
  icon: string;
  badge_url?: string;
  points: number;
  display_order: number;
  is_active: boolean;
  trigger_type: string;
  trigger_config: any;
  show_celebration: boolean;
  celebration_message?: string;
  celebration_config: any;
  created_at: string;
  updated_at: string;
}

export interface UserMilestone {
  id: string;
  user_id: string;
  milestone_id: string;
  completed_at: string;
  awarded_by?: string;
  notes?: string;
  progress_data: any;
  milestone?: Milestone;
}

export const useMilestones = () => {
  const { user } = useAuth();
  const [categories, setCategories] = useState<MilestoneCategory[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [userMilestones, setUserMilestones] = useState<UserMilestone[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('milestone_categories')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      safeLogger.error('Error fetching milestone categories:', error);
    }
  };

  const fetchMilestones = async () => {
    try {
      const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      setMilestones(data || []);
    } catch (error) {
      safeLogger.error('Error fetching milestones:', error);
    }
  };

  const fetchUserMilestones = async () => {
    if (!user?.id) return;

    try {
      const { data, error } = await supabase
        .from('user_milestones')
        .select(`
          *,
          milestone:milestones(*)
        `)
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false });

      if (error) throw error;
      setUserMilestones(data || []);
    } catch (error) {
      safeLogger.error('Error fetching user milestones:', error);
    }
  };

  const getMilestonesByCategory = (categoryName: string) => {
    const category = categories.find(cat => cat.name === categoryName);
    if (!category) return [];
    
    return milestones.filter(milestone => milestone.category_id === category.id);
  };

  const getUserMilestonesByCategory = (categoryName: string) => {
    const categoryMilestones = getMilestonesByCategory(categoryName);
    const milestoneIds = categoryMilestones.map(m => m.id);
    
    return userMilestones.filter(um => milestoneIds.includes(um.milestone_id));
  };

  const getCompletedMilestonesCount = () => {
    return userMilestones.length;
  };

  const getTotalMilestonesCount = () => {
    return milestones.length;
  };

  const getMilestoneProgress = (categoryName?: string) => {
    if (categoryName) {
      const categoryMilestones = getMilestonesByCategory(categoryName);
      const completedInCategory = getUserMilestonesByCategory(categoryName);
      return {
        completed: completedInCategory.length,
        total: categoryMilestones.length,
        percentage: categoryMilestones.length > 0 
          ? Math.round((completedInCategory.length / categoryMilestones.length) * 100)
          : 0
      };
    }

    const completed = getCompletedMilestonesCount();
    const total = getTotalMilestonesCount();
    return {
      completed,
      total,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  };

  const isMilestoneCompleted = (milestoneId: string) => {
    return userMilestones.some(um => um.milestone_id === milestoneId);
  };

  const refreshMilestones = async () => {
    setLoading(true);
    await Promise.all([
      fetchCategories(),
      fetchMilestones(),
      fetchUserMilestones()
    ]);
    setLoading(false);
  };

  useEffect(() => {
    refreshMilestones();
  }, [user?.id]);

  return {
    categories,
    milestones,
    userMilestones,
    loading,
    getMilestonesByCategory,
    getUserMilestonesByCategory,
    getCompletedMilestonesCount,
    getTotalMilestonesCount,
    getMilestoneProgress,
    isMilestoneCompleted,
    refreshMilestones
  };
};