/**
 * Migration dashboard utilities for monitoring fix implementation
 * Provides real-time status of all migration phases
 */

import { MigrationMonitor } from './migration-utilities';
import { isFeatureEnabled, FEATURE_FLAGS } from './feature-flags';

export interface MigrationPhaseStatus {
  phase: string;
  enabled: boolean;
  operations: number;
  successes: number;
  failures: number;
  lastActivity: number | null;
}

export interface MigrationDashboard {
  overall: {
    totalOperations: number;
    successRate: number;
    activePhasesCount: number;
    lastActivity: number | null;
  };
  phases: MigrationPhaseStatus[];
  featureFlags: Record<string, boolean>;
  recommendations: string[];
}

/**
 * Get comprehensive migration status
 */
export function getMigrationDashboard(): MigrationDashboard {
  const metrics = MigrationMonitor.getMetrics();
  const phases: MigrationPhaseStatus[] = [];
  
  // Analyze each phase
  const phaseNames = ['database', 'logging', 'navigation', 'types', 'performance'];
  let totalOperations = 0;
  let totalSuccesses = 0;
  let overallLastActivity: number | null = null;
  
  phaseNames.forEach(phaseName => {
    const phaseMetrics = MigrationMonitor.getMetrics(phaseName);
    let operations = 0;
    let successes = 0;
    let lastActivity: number | null = null;
    
    Object.values(phaseMetrics).forEach((metricArray: any) => {
      if (Array.isArray(metricArray)) {
        operations += metricArray.length;
        metricArray.forEach((metric: any) => {
          if (metric.operation?.includes('success')) {
            successes++;
          }
          if (!lastActivity || metric.timestamp > lastActivity) {
            lastActivity = metric.timestamp;
          }
        });
      }
    });
    
    if (!overallLastActivity || (lastActivity && lastActivity > overallLastActivity)) {
      overallLastActivity = lastActivity;
    }
    
    totalOperations += operations;
    totalSuccesses += successes;
    
    phases.push({
      phase: phaseName,
      enabled: isPhaseEnabled(phaseName),
      operations,
      successes,
      failures: operations - successes,
      lastActivity
    });
  });
  
  // Generate recommendations
  const recommendations = generateRecommendations(phases);
  
  return {
    overall: {
      totalOperations,
      successRate: totalOperations > 0 ? (totalSuccesses / totalOperations) * 100 : 0,
      activePhasesCount: phases.filter(p => p.enabled).length,
      lastActivity: overallLastActivity
    },
    phases,
    featureFlags: Object.fromEntries(
      Object.entries(FEATURE_FLAGS).map(([key, value]) => [key, value])
    ),
    recommendations
  };
}

/**
 * Check if a migration phase is enabled
 */
function isPhaseEnabled(phase: string): boolean {
  switch (phase) {
    case 'database':
      return isFeatureEnabled('MIGRATE_SINGLE_QUERIES') || 
             isFeatureEnabled('ENABLE_DATABASE_ERROR_BOUNDARIES');
    case 'logging':
      return isFeatureEnabled('MIGRATE_CONSOLE_LOGS');
    case 'navigation':
      return isFeatureEnabled('REPLACE_WINDOW_RELOAD');
    case 'types':
      return isFeatureEnabled('STRICT_TYPE_CHECKING') || 
             isFeatureEnabled('RUNTIME_TYPE_VALIDATION');
    case 'performance':
      return isFeatureEnabled('OPTIMIZE_DATABASE_QUERIES') || 
             isFeatureEnabled('ENABLE_REAL_RECOVERY_RATE');
    default:
      return false;
  }
}

/**
 * Generate recommendations based on migration status
 */
function generateRecommendations(phases: MigrationPhaseStatus[]): string[] {
  const recommendations: string[] = [];
  
  // Check if any phases have high failure rates
  phases.forEach(phase => {
    if (phase.operations > 0) {
      const failureRate = (phase.failures / phase.operations) * 100;
      if (failureRate > 20) {
        recommendations.push(`High failure rate in ${phase.phase} phase (${failureRate.toFixed(1)}%) - consider rollback`);
      }
    }
  });
  
  // Check if no phases are enabled
  const enabledPhases = phases.filter(p => p.enabled);
  if (enabledPhases.length === 0) {
    recommendations.push('No migration phases are currently enabled - ready to start gradual rollout');
  }
  
  // Check for stalled phases
  const now = Date.now();
  phases.forEach(phase => {
    if (phase.enabled && phase.lastActivity && (now - phase.lastActivity) > 300000) { // 5 minutes
      recommendations.push(`${phase.phase} phase appears stalled - no activity for 5+ minutes`);
    }
  });
  
  // Performance recommendations
  const databasePhase = phases.find(p => p.phase === 'database');
  if (databasePhase?.enabled && databasePhase.operations > 100) {
    recommendations.push('Database phase is active with high volume - monitor performance impact');
  }
  
  return recommendations;
}

/**
 * Emergency rollback trigger
 */
export function triggerEmergencyRollback(reason: string) {
  console.warn(`EMERGENCY ROLLBACK TRIGGERED: ${reason}`);
  MigrationMonitor.trackMetric('rollback', 'emergency_triggered', { reason });
  
  // Log rollback for monitoring
  const dashboard = getMigrationDashboard();
  console.warn('Migration status at rollback:', dashboard);
  
  // In a real implementation, this would disable all feature flags
  return dashboard;
}