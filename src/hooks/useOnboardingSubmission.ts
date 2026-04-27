import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { safeLogger } from '@/lib/safe-logger';

// Legacy interface - kept for backward compatibility but no longer used
export interface OnboardingData {
  income_goal: string;
  motivation: string;
  ecommerce_experience: string;
  perceived_blockers: string[];
  thirty_day_aspirations: string;
}

export const useOnboardingSubmission = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submitOnboardingAnswers = async (
    userId: string, 
    data: OnboardingData
  ): Promise<boolean> => {
    setLoading(true);
    try {
      // Store onboarding responses in the proper table
      const responses = Object.entries(data).map(([questionId, answer]) => ({
        user_id: userId,
        question_id: questionId,
        answer: String(answer),
        answer_type: typeof answer === 'string' ? 'text' : 'json'
      }));

      const { error: responseError } = await supabase
        .from('onboarding_responses')
        .insert(responses);

      if (responseError) {
        throw responseError;
      }

      toast({
        title: "Onboarding Complete",
        description: "Your information has been saved successfully."
      });

      return true;
    } catch (error) {
      safeLogger.error('Onboarding submission error:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save onboarding information"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    submitOnboardingAnswers,
    loading
  };
};