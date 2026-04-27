/**
 * Feature flags for safe rollout of fixes
 * Now fully configurable via environment variables
 */

import { ENV_CONFIG } from './env-config';

export const FEATURE_FLAGS = {
  // Issue 3: Production console logging (OFF by default for safety)
  ENABLE_CONSOLE_LOGGING: ENV_CONFIG.ENABLE_CONSOLE_LOGGING,
  
  // Issue 6: Enhanced error handling (ON by default, additive only)
  ENHANCED_ERROR_HANDLING: ENV_CONFIG.ENHANCED_ERROR_HANDLING,
  
  // Issue 4: Safe database queries (ON by default, replaces unsafe patterns)
  SAFE_DATABASE_QUERIES: ENV_CONFIG.SAFE_DATABASE_QUERIES,
  
  // Issue 2: Type safety improvements (ON by default, compile-time only)
  TYPE_SAFETY_IMPROVEMENTS: ENV_CONFIG.TYPE_SAFETY_IMPROVEMENTS,
  
  // Sequential unlock system (OFF by default, zero regression)
  LMS_SEQUENTIAL_UNLOCK: ENV_CONFIG.LMS_SEQUENTIAL_UNLOCK,
  
  // Phase 2: Database Safety Fixes (OFF by default, zero-breakage)
  MIGRATE_SINGLE_QUERIES: ENV_CONFIG.MIGRATE_SINGLE_QUERIES,
  ENABLE_DATABASE_ERROR_BOUNDARIES: ENV_CONFIG.ENABLE_DATABASE_ERROR_BOUNDARIES,
  SAFE_QUERY_FALLBACKS: ENV_CONFIG.SAFE_QUERY_FALLBACKS,
  
  // Phase 3: Console Logging Migration (OFF by default)
  MIGRATE_CONSOLE_LOGS: ENV_CONFIG.MIGRATE_CONSOLE_LOGS,
  PRESERVE_DEBUG_LOGS: ENV_CONFIG.PRESERVE_DEBUG_LOGS,
  
  // Phase 4: Navigation & Performance (OFF by default)
  REPLACE_WINDOW_RELOAD: ENV_CONFIG.REPLACE_WINDOW_RELOAD,
  ENABLE_REAL_RECOVERY_RATE: ENV_CONFIG.ENABLE_REAL_RECOVERY_RATE,
  OPTIMIZE_DATABASE_QUERIES: ENV_CONFIG.OPTIMIZE_DATABASE_QUERIES,
  ENHANCED_LOADING_STATES: ENV_CONFIG.ENHANCED_LOADING_STATES,
  
  // Phase 5: Type Safety (OFF by default)
  STRICT_TYPE_CHECKING: ENV_CONFIG.STRICT_TYPE_CHECKING,
  RUNTIME_TYPE_VALIDATION: ENV_CONFIG.RUNTIME_TYPE_VALIDATION,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}