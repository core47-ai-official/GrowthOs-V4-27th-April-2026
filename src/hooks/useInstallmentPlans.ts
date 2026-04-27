import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface InstallmentPlan {
  installments: number;
  amount_per_installment: number;
  description?: string;
}

export const useInstallmentPlans = () => {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstallmentPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('company_settings')
        .select('installment_plans')
        .eq('id', 1)
        .maybeSingle();

      if (fetchError) {
        logger.error('Error fetching installment plans:', fetchError);
        setError('Failed to load installment plans');
        return;
      }

      const installmentPlans = (data as any)?.installment_plans || [];

      if (installmentPlans && installmentPlans.length > 0) {
        setPlans(installmentPlans);
      } else {
        // Default plans if none configured
        setPlans([
          { installments: 1, amount_per_installment: 0, description: 'Full payment' },
          { installments: 2, amount_per_installment: 0, description: '2 installments' },
          { installments: 3, amount_per_installment: 0, description: '3 installments' }
        ]);
      }
    } catch (err) {
      logger.error('Error in fetchInstallmentPlans:', err);
      setError('Failed to load installment plans');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstallmentPlans();
  }, []);

  return {
    plans,
    loading,
    error,
    refetch: fetchInstallmentPlans
  };
};