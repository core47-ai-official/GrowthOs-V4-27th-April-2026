import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface AtRiskRules {
  no_login_days: number;
  stuck_recording_days: number;
  stuck_assignment_days: number;
  missed_sessions_count: number;
}

const DEFAULT_RULES: AtRiskRules = {
  no_login_days: 0,
  stuck_recording_days: 0,
  stuck_assignment_days: 0,
  missed_sessions_count: 0,
};

export const useAtRiskRules = () => {
  const [rules, setRules] = useState<AtRiskRules>(DEFAULT_RULES);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings' as any)
        .select('branding')
        .maybeSingle();

      if (error) throw error;

      const branding = (data as any)?.branding;
      if (branding?.at_risk_rules) {
        const r = branding.at_risk_rules;
        const parsed: AtRiskRules = {
          no_login_days: r.no_login_days || 0,
          stuck_recording_days: r.stuck_recording_days || 0,
          stuck_assignment_days: r.stuck_assignment_days || 0,
          missed_sessions_count: r.missed_sessions_count || 0,
        };
        setRules(parsed);
        setConfigured(
          parsed.no_login_days > 0 ||
          parsed.stuck_recording_days > 0 ||
          parsed.stuck_assignment_days > 0 ||
          parsed.missed_sessions_count > 0
        );
      }
    } catch (err) {
      console.error('Error fetching at-risk rules:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveRules = async (newRules: AtRiskRules) => {
    try {
      const { data } = await supabase
        .from('company_settings' as any)
        .select('branding, id')
        .maybeSingle();

      const row = data as any;
      const existingBranding = row?.branding || {};
      const updatedBranding = {
        ...existingBranding,
        at_risk_rules: newRules,
      };

      const { error } = await supabase
        .from('company_settings' as any)
        .update({ branding: updatedBranding } as any)
        .eq('id', row?.id || 1);

      if (error) throw error;

      setRules(newRules);
      setConfigured(
        newRules.no_login_days > 0 ||
        newRules.stuck_recording_days > 0 ||
        newRules.stuck_assignment_days > 0 ||
        newRules.missed_sessions_count > 0
      );
      return true;
    } catch (err) {
      console.error('Error saving at-risk rules:', err);
      return false;
    }
  };

  return { rules, configured, loading, saveRules, refetch: fetchRules };
};
