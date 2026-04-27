/**
 * Production-ready error handling utilities
 * Replaces console.error with proper logging and user notifications
 */

import { safeLogger } from '@/lib/safe-logger';
import { errorHandler } from '@/lib/error-handler';

/**
 * Handle errors with proper logging and user feedback
 * Use this instead of console.error throughout the application
 */
export function handleApplicationError(
  error: any, 
  context: string, 
  showToast = true
): void {
  // Log the error using our safe logger
  safeLogger.error(`Error in ${context}:`, error);
  
  // Handle the error with proper user feedback
  errorHandler.handleError(error, context, showToast);
}

/**
 * Handle async operation errors
 * Use this for promises and async functions
 */
export function handleAsyncError(
  error: any,
  context: string,
  showToast = true
): void {
  // Use the error handler's async error handling
  errorHandler.handleAsyncError(Promise.reject(error), context);
  
  if (showToast) {
    handleApplicationError(error, context, true);
  }
}

/**
 * Handle form validation errors
 * Use this for form submission errors
 */
export function handleFormError(
  error: any,
  context: string,
  setError?: (field: string, error: any) => void
): void {
  safeLogger.error(`Form error in ${context}:`, error);
  
  // Use the error handler for form errors
  errorHandler.handleError(error, context, false);
}

/**
 * Safe error wrapper for development vs production
 * Provides detailed errors in development, user-friendly in production
 */
export function createSafeError(message: string, originalError?: any): Error {
  const isDevelopment = import.meta.env.DEV;
  
  if (isDevelopment && originalError) {
    return new Error(`${message}: ${originalError.message || originalError}`);
  }
  
  return new Error(message);
}