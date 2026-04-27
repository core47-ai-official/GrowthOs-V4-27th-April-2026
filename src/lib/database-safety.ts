// Database safety utilities to prevent crashes from .single() calls
import { PostgrestSingleResponse } from '@supabase/supabase-js';
import { logger } from './logger';
import { isFeatureEnabled } from './feature-flags';
import { MigrationMonitor } from './migration-utilities';

interface SafeQueryResult<T> {
  data: T | null;
  error: any;
  success: boolean;
}

/**
 * Safe wrapper for .single() queries that prevents crashes
 * Always use this instead of .single() to handle missing data gracefully
 */
export function safeQuery<T>(
  queryBuilder: any,
  context?: string
): Promise<SafeQueryResult<T>> {
  // Track migration usage
  if (isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
    MigrationMonitor.trackMetric('database', 'safe_query_used', { context });
  }
  
  const promise = queryBuilder as Promise<PostgrestSingleResponse<T>>;
  return promise
    .then(({ data, error }) => {
      if (error) {
        logger.error(`Database query failed: ${context}`, { error });
        if (isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
          MigrationMonitor.trackMetric('database', 'query_error', { context, error });
        }
        return { data: null, error, success: false };
      }
      
      if (!data) {
        logger.info(`No data found for query: ${context}`);
        if (isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
          MigrationMonitor.trackMetric('database', 'no_data_found', { context });
        }
        return { data: null, error: null, success: true };
      }
      
      if (isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
        MigrationMonitor.trackMetric('database', 'query_success', { context });
      }
      return { data, error: null, success: true };
    })
    .catch(error => {
      logger.error(`Database query exception: ${context}`, { error });
      if (isFeatureEnabled('MIGRATE_SINGLE_QUERIES')) {
        MigrationMonitor.trackMetric('database', 'query_exception', { context, error });
      }
      return { data: null, error, success: false };
    });
}

/**
 * Safe wrapper for .maybeSingle() queries with enhanced error handling
 */
export function safeMaybeSingle<T>(
  queryBuilder: any,
  context?: string
): Promise<SafeQueryResult<T>> {
  const promise = queryBuilder as Promise<PostgrestSingleResponse<T>>;
  return promise
    .then(({ data, error }) => {
      if (error) {
        logger.error(`Database maybeSingle query failed: ${context}`, { error });
        return { data: null, error, success: false };
      }
      
      return { data, error: null, success: true };
    })
    .catch(error => {
      logger.error(`Database maybeSingle query exception: ${context}`, { error });
      return { data: null, error, success: false };
    });
}

/**
 * Safe wrapper for multiple records queries
 */
export function safeSelect<T>(
  promise: Promise<{ data: T[] | null; error: any }>,
  context?: string
): Promise<{ data: T[]; error: any; success: boolean }> {
  return promise
    .then(({ data, error }) => {
      if (error) {
        logger.error(`Database select query failed: ${context}`, { error });
        return { data: [], error, success: false };
      }
      
      return { data: data || [], error: null, success: true };
    })
    .catch(error => {
      logger.error(`Database select query exception: ${context}`, { error });
      return { data: [], error, success: false };
    });
}

/**
 * Helper to check if a value exists before using it
 */
export function requireData<T>(data: T | null | undefined, fallback: T, context?: string): T {
  if (data === null || data === undefined) {
    logger.warn(`Missing required data, using fallback: ${context}`, { fallback });
    return fallback;
  }
  return data;
}

/**
 * Safe navigation utility for deeply nested objects
 */
export function safeGet<T>(obj: any, path: string, defaultValue: T): T {
  try {
    const result = path.split('.').reduce((current, key) => current?.[key], obj);
    return result !== undefined ? result : defaultValue;
  } catch (error) {
    logger.warn(`Safe navigation failed for path: ${path}`, { error });
    return defaultValue;
  }
}