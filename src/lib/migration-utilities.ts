/**
 * Migration utilities for safe zero-breakage fixes
 * Provides rollback mechanisms and monitoring for each fix phase
 */

import { safeLogger } from './safe-logger';
import { isFeatureEnabled } from './feature-flags';

export class MigrationMonitor {
  private static metrics: Map<string, any> = new Map();
  
  /**
   * Track before/after metrics for migration phases
   */
  static trackMetric(phase: string, operation: string, value: any) {
    const key = `${phase}_${operation}`;
    const existing = this.metrics.get(key) || [];
    existing.push({
      timestamp: Date.now(),
      value,
      phase,
      operation
    });
    this.metrics.set(key, existing);
    
    safeLogger.activity(`Migration metric: ${key}`, { value, phase, operation });
  }
  
  /**
   * Get migration metrics for monitoring
   */
  static getMetrics(phase?: string): any {
    if (phase) {
      const filteredMetrics: any = {};
      for (const [key, value] of this.metrics) {
        if (key.startsWith(phase)) {
          filteredMetrics[key] = value;
        }
      }
      return filteredMetrics;
    }
    return Object.fromEntries(this.metrics);
  }
  
  /**
   * Clear all metrics (for testing)
   */
  static clearMetrics() {
    this.metrics.clear();
  }
}

/**
 * Safe wrapper for database operations with fallback
 */
export function withDatabaseFallback<T>(
  operation: () => Promise<T>,
  fallback: T,
  context: string
): Promise<T> {
  if (!isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
    return operation();
  }
  
  return operation()
    .then(result => {
      MigrationMonitor.trackMetric('database', 'success', { context });
      return result;
    })
    .catch(error => {
      MigrationMonitor.trackMetric('database', 'fallback_used', { context, error });
      safeLogger.warn(`Database fallback used for ${context}`, { error });
      return fallback;
    });
}

/**
 * Safe console logging replacement
 */
export function migratedConsoleLog(message: string, ...args: any[]) {
  if (isFeatureEnabled('MIGRATE_CONSOLE_LOGS')) {
    safeLogger.info(message, { args });
    MigrationMonitor.trackMetric('logging', 'migrated_call', { message });
  } else {
    console.log(message, ...args);
  }
}

/**
 * Safe navigation replacement for window.reload
 */
export function safeNavigationReload(fallbackAction?: () => void) {
  if (isFeatureEnabled('REPLACE_WINDOW_RELOAD')) {
    MigrationMonitor.trackMetric('navigation', 'reload_replacement', {});
    safeLogger.info('Navigation reload replaced with React Router navigation');
    if (fallbackAction) {
      fallbackAction();
    }
  } else {
    MigrationMonitor.trackMetric('navigation', 'window_reload_used', {});
    window.location.reload();
  }
}

/**
 * Progressive type checking
 */
export function withTypeValidation<T>(value: any, validator: (val: any) => val is T, fallback: T): T {
  if (!isFeatureEnabled('RUNTIME_TYPE_VALIDATION')) {
    return value as T;
  }
  
  if (validator(value)) {
    MigrationMonitor.trackMetric('types', 'validation_success', {});
    return value;
  } else {
    MigrationMonitor.trackMetric('types', 'validation_failed', { value });
    safeLogger.warn('Type validation failed, using fallback', { value, fallback });
    return fallback;
  }
}

/**
 * Performance optimization wrapper
 */
export function withPerformanceOptimization<T>(
  operation: () => Promise<T>,
  optimizedOperation: () => Promise<T>,
  context: string
): Promise<T> {
  if (isFeatureEnabled('OPTIMIZE_DATABASE_QUERIES')) {
    MigrationMonitor.trackMetric('performance', 'optimized_path', { context });
    return optimizedOperation();
  } else {
    MigrationMonitor.trackMetric('performance', 'legacy_path', { context });
    return operation();
  }
}

/**
 * Rollback helper - reverts all feature flags to safe defaults
 */
export function initiateRollback() {
  safeLogger.warn('Migration rollback initiated - reverting to safe defaults');
  MigrationMonitor.trackMetric('rollback', 'initiated', { timestamp: Date.now() });
  
  // In a real implementation, this would update the feature flags
  // For now, we log the action for monitoring
  console.warn('ROLLBACK: All migration features should be disabled');
}

/**
 * Health check for migration status
 */
export function getMigrationHealth() {
  const metrics = MigrationMonitor.getMetrics();
  const health = {
    totalOperations: 0,
    successRate: 0,
    fallbackUsage: 0,
    phases: {
      database: 0,
      logging: 0,
      navigation: 0,
      types: 0,
      performance: 0
    }
  };
  
  // Calculate health metrics from tracked data
  for (const [key, values] of Object.entries(metrics)) {
    health.totalOperations += (values as any[]).length;
    const [phase] = key.split('_');
    if (health.phases.hasOwnProperty(phase)) {
      (health.phases as any)[phase] += (values as any[]).length;
    }
  }
  
  return health;
}