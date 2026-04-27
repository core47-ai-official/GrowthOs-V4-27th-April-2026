/**
 * Real recovery rate calculation hook
 * Replaces hard-coded 85% with actual database calculations
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { MigrationMonitor } from '@/lib/migration-utilities';
import { safeLogger } from '@/lib/safe-logger';
import { ENV_CONFIG } from '@/lib/env-config';

interface RecoveryRateData {
  recoveryRate: number;
  totalInactiveStudents: number;
  recoveredStudents: number;
  calculationMethod: 'real' | 'fallback';
}

export function useRealRecoveryRate() {
  const [data, setData] = useState<RecoveryRateData>({
    recoveryRate: ENV_CONFIG.DEFAULT_RECOVERY_RATE,
    totalInactiveStudents: 0,
    recoveredStudents: 0,
    calculationMethod: 'fallback'
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const calculateRecoveryRate = async () => {
      try {
        setLoading(true);
        setError(null);

        if (!isFeatureEnabled('ENABLE_REAL_RECOVERY_RATE')) {
          // Use fallback rate
          MigrationMonitor.trackMetric('recovery_rate', 'fallback_used', {
            rate: ENV_CONFIG.DEFAULT_RECOVERY_RATE
          });
          
          setData({
            recoveryRate: ENV_CONFIG.DEFAULT_RECOVERY_RATE,
            totalInactiveStudents: 0,
            recoveredStudents: 0,
            calculationMethod: 'fallback'
          });
          return;
        }

        // Calculate real recovery rate from database
        MigrationMonitor.trackMetric('recovery_rate', 'calculation_started', {});

        // Get recovery messages data
        const { data: recoveryMessages, error: recoveryError } = await supabase
          .from('student_recovery_messages')
          .select('recovery_successful, user_id')
          .not('recovery_successful', 'is', null);

        if (recoveryError) {
          throw new Error(`Recovery messages query failed: ${recoveryError.message}`);
        }

        if (!recoveryMessages || recoveryMessages.length === 0) {
          // No recovery data available, use fallback
          MigrationMonitor.trackMetric('recovery_rate', 'no_data_fallback', {});
          safeLogger.info('No recovery data available, using fallback rate');
          
          setData({
            recoveryRate: ENV_CONFIG.DEFAULT_RECOVERY_RATE,
            totalInactiveStudents: 0,
            recoveredStudents: 0,
            calculationMethod: 'fallback'
          });
          return;
        }

        // Calculate recovery rate
        const totalMessages = recoveryMessages.length;
        const successfulRecoveries = recoveryMessages.filter(msg => msg.recovery_successful).length;
        const calculatedRate = totalMessages > 0 ? (successfulRecoveries / totalMessages) * 100 : ENV_CONFIG.DEFAULT_RECOVERY_RATE;

        MigrationMonitor.trackMetric('recovery_rate', 'real_calculation', {
          totalMessages,
          successfulRecoveries,
          calculatedRate
        });

        safeLogger.info('Real recovery rate calculated', {
          totalMessages,
          successfulRecoveries,
          calculatedRate
        });

        setData({
          recoveryRate: Math.round(calculatedRate),
          totalInactiveStudents: totalMessages,
          recoveredStudents: successfulRecoveries,
          calculationMethod: 'real'
        });

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        
        MigrationMonitor.trackMetric('recovery_rate', 'calculation_error', {
          error: errorMessage
        });
        
        safeLogger.error('Recovery rate calculation failed, using fallback', err);
        setError(errorMessage);
        
        // Use fallback on error
        setData({
          recoveryRate: ENV_CONFIG.DEFAULT_RECOVERY_RATE,
          totalInactiveStudents: 0,
          recoveredStudents: 0,
          calculationMethod: 'fallback'
        });
      } finally {
        setLoading(false);
      }
    };

    calculateRecoveryRate();
  }, []);

  const refetch = async () => {
    setLoading(true);
    setError(null);
    // Re-trigger the useEffect
    window.location.reload();
  };

  return {
    ...data,
    loading,
    error,
    refetch
  };
}