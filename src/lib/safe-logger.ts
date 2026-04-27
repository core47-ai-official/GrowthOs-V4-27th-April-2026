/**
 * Safe logging system with feature flag control
 * Issue 3: Replace console.log statements with feature-flagged logger
 * Zero-breakage: Console logging OFF by default in production
 */

import { logger } from './logger';
import { isFeatureEnabled } from './feature-flags';

interface SafeLogData {
  [key: string]: any;
}

class SafeLogger {
  /**
   * Safe info logging - only enabled via feature flag
   */
  info(message: string, data?: SafeLogData): void {
    if (isFeatureEnabled('ENABLE_CONSOLE_LOGGING')) {
      logger.info(message, data);
    }
  }

  /**
   * Safe warning logging - always enabled for important warnings
   */
  warn(message: string, data?: SafeLogData): void {
    logger.warn(message, data);
  }

  /**
   * Safe error logging - always enabled for errors
   */
  error(message: string, error?: any, data?: SafeLogData): void {
    logger.error(message, error, data);
  }

  /**
   * Safe debug logging - only enabled via feature flag
   */
  debug(message: string, data?: SafeLogData): void {
    if (isFeatureEnabled('ENABLE_CONSOLE_LOGGING')) {
      logger.debug(message, data);
    }
  }

  /**
   * Safe performance logging - always enabled for monitoring
   */
  performance(operation: string, duration: number, data?: SafeLogData): void {
    logger.performance(operation, duration, data);
  }

  /**
   * Safe activity logging - always enabled for analytics
   */
  activity(action: string, data?: SafeLogData): void {
    logger.activity(action, data);
  }
}

export const safeLogger = new SafeLogger();

// Backward compatibility exports
export const safeLog = {
  info: safeLogger.info.bind(safeLogger),
  warn: safeLogger.warn.bind(safeLogger),
  error: safeLogger.error.bind(safeLogger),
  debug: safeLogger.debug.bind(safeLogger),
};