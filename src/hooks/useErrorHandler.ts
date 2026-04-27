import { useState, useCallback } from 'react';
import { errorHandler, UserError } from '@/lib/error-handler';

interface UseErrorHandlerReturn {
  error: UserError | null;
  setError: (error: UserError | string | null) => void;
  clearError: () => void;
  handleError: (error: any, context?: string, showToast?: boolean) => UserError;
  hasError: boolean;
}

export const useErrorHandler = (): UseErrorHandlerReturn => {
  const [error, setErrorState] = useState<UserError | null>(null);

  const setError = useCallback((error: UserError | string | null) => {
    if (!error) {
      setErrorState(null);
    } else if (typeof error === 'string') {
      setErrorState({
        message: error,
        context: 'general'
      });
    } else {
      setErrorState(error);
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  const handleError = useCallback((error: any, context?: string, showToast = false) => {
    const userError = errorHandler.handleError(error, context, showToast);
    setErrorState(userError);
    return userError;
  }, []);

  return {
    error,
    setError,
    clearError,
    handleError,
    hasError: !!error
  };
};