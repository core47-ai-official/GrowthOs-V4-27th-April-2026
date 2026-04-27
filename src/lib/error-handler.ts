// Centralized error handling service
import { toast } from "@/hooks/use-toast";

export type ErrorContext = 
  | 'auth'
  | 'network'
  | 'validation'
  | 'database'
  | 'upload'
  | 'payment'
  | 'rate_limit'
  | 'permission'
  | 'processing'
  | 'integration'
  | 'general';

export interface UserError {
  message: string;
  action?: string;
  context: ErrorContext;
}

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<string, UserError> = {
  // Authentication errors
  'invalid_credentials': {
    message: 'Your email or password is incorrect.',
    action: 'Please check your credentials and try again.',
    context: 'auth'
  },
  'email_not_verified': {
    message: 'Please verify your email address.',
    action: 'Check your inbox for a verification link.',
    context: 'auth'
  },
  'session_expired': {
    message: 'Your session has expired.',
    action: 'Please sign in again.',
    context: 'auth'
  },
  'access_denied': {
    message: 'You don\'t have permission to access this resource.',
    action: 'Contact your administrator if you need access.',
    context: 'auth'
  },

  // Network errors
  'network_error': {
    message: 'Unable to connect to our servers.',
    action: 'Please check your internet connection and try again.',
    context: 'network'
  },
  'timeout': {
    message: 'The request took too long to complete.',
    action: 'Please try again in a moment.',
    context: 'network'
  },
  'server_error': {
    message: 'Our servers are experiencing issues.',
    action: 'Please try again in a few minutes.',
    context: 'network'
  },

  // Rate limit & permission errors
  'rate_limit_exceeded': {
    message: 'Daily limit reached. Your credits will reset at midnight UTC.',
    action: 'Please try again tomorrow or contact support for additional credits.',
    context: 'rate_limit'
  },
  'permission_denied': {
    message: 'You don\'t have permission to perform this action.',
    action: 'Contact your administrator if you need access.',
    context: 'permission'
  },
  'token_expired': {
    message: 'Your access token has expired.',
    action: 'Please reconnect your account to continue.',
    context: 'auth'
  },

  // Processing errors
  'operation_timeout': {
    message: 'This operation is taking longer than expected.',
    action: 'Please wait a moment and check back.',
    context: 'processing'
  },
  'processing_in_progress': {
    message: 'Your request is being processed.',
    action: 'This may take a few moments. You\'ll be notified when it\'s complete.',
    context: 'processing'
  },

  // Integration errors
  'integration_error': {
    message: 'Unable to connect to the integration service.',
    action: 'Please check your connection settings or try again later.',
    context: 'integration'
  },

  // Validation errors
  'required_field': {
    message: 'This field is required.',
    action: 'Please fill in all required fields.',
    context: 'validation'
  },
  'invalid_email': {
    message: 'Please enter a valid email address.',
    context: 'validation'
  },
  'password_weak': {
    message: 'Your password must be at least 8 characters long.',
    action: 'Include uppercase, lowercase, numbers, and special characters.',
    context: 'validation'
  },
  'file_too_large': {
    message: 'The file is too large.',
    action: 'Please choose a file smaller than 10MB.',
    context: 'upload'
  },

  // Database errors
  'record_not_found': {
    message: 'The requested item could not be found.',
    action: 'It may have been deleted or moved.',
    context: 'database'
  },
  'duplicate_entry': {
    message: 'This record already exists.',
    action: 'Please use different information.',
    context: 'database'
  },
  'database_error': {
    message: 'Unable to save your changes.',
    action: 'Please try again or contact support.',
    context: 'database'
  },

  // Payment errors
  'payment_failed': {
    message: 'Your payment could not be processed.',
    action: 'Please check your payment details and try again.',
    context: 'payment'
  },
  'insufficient_funds': {
    message: 'Insufficient funds for this transaction.',
    action: 'Please use a different payment method.',
    context: 'payment'
  },

  // General fallback
  'unknown_error': {
    message: 'Something went wrong.',
    action: 'Please try again or contact support if the problem persists.',
    context: 'general'
  }
};

class ErrorHandler {
  private parseStackTrace(stack: string): {
    file: string | null;
    line: number | null;
    column: number | null;
    function: string | null;
    component: string | null;
  } {
    if (!stack) return { file: null, line: null, column: null, function: null, component: null };

    // Parse the first relevant stack line (skip generic Error lines)
    const lines = stack.split('\n').filter(l => l.trim() && !l.includes('Error:'));
    
    for (const line of lines) {
      // Pattern: at ComponentName.functionName (file.tsx:line:column)
      // or: at file.tsx:line:column
      const match = line.match(/at\s+(?:(\w+)\.)?(\w+)?\s*\(?(.*?):(\d+):(\d+)\)?/);
      
      if (match) {
        const [, component, func, filePath, lineNum, colNum] = match;
        const fileName = filePath?.split('/').pop() || filePath;
        
        return {
          file: fileName || null,
          line: lineNum ? parseInt(lineNum, 10) : null,
          column: colNum ? parseInt(colNum, 10) : null,
          function: func || null,
          component: component || null
        };
      }
    }

    return { file: null, line: null, column: null, function: null, component: null };
  }

  private classifyError(error: any, context?: string): {
    type: string;
    category: string;
    classification: string;
  } {
    const message = error?.message?.toLowerCase() || '';
    const stack = error?.stack?.toLowerCase() || '';

    // Determine error type
    let errorType = 'unknown';
    let category = 'general';
    let classification = 'Unknown Error';

    // Frontend/UI Errors
    if (stack.includes('.tsx') || stack.includes('.jsx') || message.includes('component') || message.includes('render')) {
      errorType = 'ui';
      category = 'frontend';
      
      if (message.includes('undefined') || message.includes('null')) {
        classification = 'Undefined Variable';
      } else if (message.includes('not a function')) {
        classification = 'Type Error';
      } else if (message.includes('import') || message.includes('module')) {
        classification = 'Missing Import';
      } else {
        classification = 'Component Error';
      }
    }
    // Database Errors
    else if (context?.includes('database') || context?.includes('db') || message.includes('database') || 
             message.includes('query') || message.includes('rls') || message.includes('policy')) {
      errorType = 'database';
      category = 'backend';
      
      if (message.includes('policy') || message.includes('rls') || message.includes('permission')) {
        classification = 'Permission Error (RLS)';
      } else if (message.includes('duplicate') || message.includes('unique')) {
        classification = 'Duplicate Entry';
      } else if (message.includes('not found') || message.includes('no rows')) {
        classification = 'Record Not Found';
      } else {
        classification = 'Database Query Error';
      }
    }
    // API Errors
    else if (context?.includes('api') || message.includes('fetch') || message.includes('request')) {
      errorType = 'api';
      category = 'backend';
      classification = 'API Request Failed';
    }
    // Network Errors
    else if (context?.includes('network') || message.includes('network') || message.includes('timeout')) {
      errorType = 'network';
      category = 'backend';
      classification = 'Network Error';
    }
    // Validation Errors
    else if (context?.includes('validation') || message.includes('validation') || message.includes('invalid')) {
      errorType = 'validation';
      category = 'user_input';
      classification = 'Validation Error';
    }
    // Auth Errors
    else if (context?.includes('auth') || message.includes('auth') || message.includes('permission')) {
      errorType = 'auth';
      category = 'backend';
      classification = 'Authentication Error';
    }
    // Integration Errors
    else if (context?.includes('integration') || message.includes('integration')) {
      errorType = 'integration';
      category = 'integration';
      classification = 'Integration Error';
    }

    return { type: errorType, category, classification };
  }

  private async logError(error: any, context?: string): Promise<void> {
    // Log full error details for debugging (never shown to user)
    console.error('Error Details:', {
      error,
      context,
      timestamp: new Date().toISOString(),
      stack: error?.stack,
      message: error?.message,
      code: error?.code
    });

    // Log to database for monitoring
    try {
      const { supabase } = await import('@/integrations/supabase/client');
      
      // Get current user if available
      const { data: { user } } = await supabase.auth.getUser();
      
      // Parse stack trace for detailed location info
      const stackInfo = this.parseStackTrace(error?.stack);
      
      // Classify the error
      const { type: errorType, category, classification } = this.classifyError(error, context);

      // Determine severity
      let severity = 'error';
      if (error?.message?.toLowerCase().includes('critical')) severity = 'critical';
      else if (error?.message?.toLowerCase().includes('warn')) severity = 'warning';
      else if (error?.status === 500 || error?.statusCode === 500) severity = 'critical';
      else if (classification.includes('Permission') || classification.includes('RLS')) severity = 'critical';

      // Get user action context from URL
      const currentUrl = typeof window !== 'undefined' ? window.location.href : null;
      const urlPath = currentUrl ? new URL(currentUrl).pathname : null;

      await supabase.from('error_logs').insert({
        user_id: user?.id || null,
        error_type: errorType,
        error_code: error?.code || error?.status?.toString() || error?.statusCode?.toString() || null,
        error_message: error?.message || 'Unknown error',
        error_details: {
          context: context,
          error: error?.toString(),
          status: error?.status || error?.statusCode,
          category: category,
          classification: classification,
          file: stackInfo.file,
          line: stackInfo.line,
          column: stackInfo.column,
          function: stackInfo.function,
          component: stackInfo.component,
          url_path: urlPath,
          user_action: this.inferUserAction(context, urlPath)
        },
        stack_trace: error?.stack || null,
        url: currentUrl,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        severity: severity
      });
    } catch (logError) {
      // Don't throw if logging fails
      console.warn('Failed to log error to database:', logError);
    }
  }

  private inferUserAction(context?: string, urlPath?: string | null): string {
    if (context?.includes('form') || context?.includes('submit')) return 'Form Submission';
    if (context?.includes('button') || context?.includes('click')) return 'Button Click';
    if (context?.includes('upload')) return 'File Upload';
    if (context?.includes('delete')) return 'Delete Operation';
    if (context?.includes('update')) return 'Update Operation';
    if (context?.includes('create')) return 'Create Operation';
    if (urlPath?.includes('login')) return 'Login Attempt';
    if (urlPath?.includes('signup')) return 'Signup Attempt';
    return 'Unknown';
  }

  private identifyErrorType(error: any): string {
    // Check HTTP status codes first
    if (error?.status === 429 || error?.statusCode === 429) {
      return 'rate_limit_exceeded';
    }
    if (error?.status === 403 || error?.statusCode === 403) {
      return 'permission_denied';
    }
    if (error?.status === 401 || error?.statusCode === 401) {
      return error?.message?.toLowerCase().includes('token') ? 'token_expired' : 'invalid_credentials';
    }
    if (error?.status === 408 || error?.statusCode === 408) {
      return 'operation_timeout';
    }
    if (error?.status === 402 || error?.statusCode === 402) {
      return 'rate_limit_exceeded';
    }
    if (error?.status === 404) {
      return 'record_not_found';
    }
    if (error?.status >= 500) {
      return 'server_error';
    }

    // Check error message patterns
    const message = error?.message?.toLowerCase() || '';
    
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'rate_limit_exceeded';
    }
    if (message.includes('permission') || message.includes('forbidden')) {
      return 'permission_denied';
    }
    if (message.includes('processing') || message.includes('in progress')) {
      return 'processing_in_progress';
    }
    if (message.includes('token') && (message.includes('expired') || message.includes('invalid'))) {
      return 'token_expired';
    }
    if (message.includes('integration') || message.includes('connection')) {
      return 'integration_error';
    }

    // Network errors
    if (error?.name === 'NetworkError' || error?.code === 'NETWORK_ERROR') {
      return 'network_error';
    }
    if (error?.name === 'TimeoutError' || error?.code === 'TIMEOUT' || message.includes('timeout')) {
      return 'timeout';
    }

    // Authentication errors
    if (error?.code === 'invalid_credentials') {
      return 'invalid_credentials';
    }
    if (error?.code === 'email_not_verified') {
      return 'email_not_verified';
    }

    // Database errors
    if (error?.code === '23505' || message.includes('duplicate')) {
      return 'duplicate_entry';
    }
    if (error?.code?.startsWith('PGRST') || error?.hint) {
      return 'database_error';
    }

    // Validation errors
    if (error?.code === 'invalid_email') {
      return 'invalid_email';
    }
    if (error?.code === 'weak_password') {
      return 'password_weak';
    }

    // Payment errors
    if (error?.type === 'card_error') {
      return 'payment_failed';
    }

    return 'unknown_error';
  }

  private getUserMessage(errorType: string): UserError {
    return ERROR_MESSAGES[errorType] || ERROR_MESSAGES.unknown_error;
  }

  public handleError(error: any, context?: string, showToast = true): UserError {
    // Log technical details
    this.logError(error, context);

    // Get user-friendly message
    const errorType = this.identifyErrorType(error);
    const userError = this.getUserMessage(errorType);

    // Show toast notification if requested
    if (showToast) {
      this.showErrorToast(userError);
    }

    return userError;
  }

  public showErrorToast(userError: UserError): void {
    const description = userError.action 
      ? `${userError.message} ${userError.action}`
      : userError.message;

    toast({
      title: "Error",
      description,
      variant: "destructive",
    });
  }

  public handleAsyncError(promise: Promise<any>, context?: string): Promise<any> {
    return promise.catch((error) => {
      this.handleError(error, context);
      throw error; // Re-throw for component handling
    });
  }

  public createFieldError(message: string): UserError {
    return {
      message,
      context: 'validation'
    };
  }
}

// Global error handler for uncaught errors
export const setupGlobalErrorHandling = () => {
  window.addEventListener('error', (event) => {
    // Ignore errors from third-party scripts (e.g., Lovable preview, analytics)
    const stack = event.error?.stack || '';
    if (
      stack.includes('lovable.js') ||
      stack.includes('cdn.gpteng.co') ||
      (event.error?.message || '').includes('MutationRecord')
    ) {
      return;
    }
    errorHandler.handleError(event.error, 'global_error');
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const stack = reason?.stack || '';
    if (
      stack.includes('lovable.js') ||
      stack.includes('cdn.gpteng.co') ||
      (reason?.message || '').includes('MutationRecord')
    ) {
      event.preventDefault();
      return;
    }
    errorHandler.handleError(event.reason, 'unhandled_promise');
    event.preventDefault();
  });
};

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Utility functions for common error scenarios
export const handleApiError = (error: any, context = 'api') => {
  return errorHandler.handleError(error, context, false);
};

export const handleFormError = (error: any, setError?: (field: string, error: any) => void) => {
  const userError = errorHandler.handleError(error, 'form', false);
  
  if (setError && error?.field) {
    setError(error.field, { message: userError.message });
  }
  
  return userError;
};

export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  context?: string
): T => {
  return ((...args: any[]) => {
    return errorHandler.handleAsyncError(fn(...args), context);
  }) as T;
};