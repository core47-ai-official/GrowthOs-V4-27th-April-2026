/**
 * Migrated console utilities with feature flag support
 * Gradually replace console.log statements with safe logging
 */

import { safeLogger } from '@/lib/safe-logger';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { MigrationMonitor } from '@/lib/migration-utilities';

/**
 * Safe replacement for console.log with migration tracking
 */
export function migratedLog(message: string, ...args: any[]) {
  if (isFeatureEnabled('MIGRATE_CONSOLE_LOGS')) {
    safeLogger.info(message, { args });
    MigrationMonitor.trackMetric('logging', 'console_log_migrated', { message });
  } else {
    console.log(message, ...args);
  }
}

/**
 * Safe replacement for console.error with migration tracking
 */
export function migratedError(message: string, error?: any, ...args: any[]) {
  if (isFeatureEnabled('MIGRATE_CONSOLE_LOGS')) {
    safeLogger.error(message, error, { args });
    MigrationMonitor.trackMetric('logging', 'console_error_migrated', { message });
  } else {
    console.error(message, error, ...args);
  }
}

/**
 * Safe replacement for console.warn with migration tracking
 */
export function migratedWarn(message: string, ...args: any[]) {
  if (isFeatureEnabled('MIGRATE_CONSOLE_LOGS')) {
    safeLogger.warn(message, { args });
    MigrationMonitor.trackMetric('logging', 'console_warn_migrated', { message });
  } else {
    console.warn(message, ...args);
  }
}

/**
 * Safe replacement for console.debug with migration tracking
 */
export function migratedDebug(message: string, ...args: any[]) {
  if (isFeatureEnabled('MIGRATE_CONSOLE_LOGS')) {
    safeLogger.debug(message, { args });
    MigrationMonitor.trackMetric('logging', 'console_debug_migrated', { message });
  } else {
    console.debug(message, ...args);
  }
}

/**
 * Batch console replacement utility
 */
export const migratedConsole = {
  log: migratedLog,
  error: migratedError,
  warn: migratedWarn,
  debug: migratedDebug,
};