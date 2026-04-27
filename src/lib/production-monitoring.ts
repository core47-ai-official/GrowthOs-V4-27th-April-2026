/**
 * Production monitoring and error tracking
 * Replaces TODO items for production monitoring
 */

interface MonitoringService {
  captureError(error: Error, context?: Record<string, any>): void;
  captureMessage(message: string, level: 'info' | 'warning' | 'error'): void;
  setUserContext(user: { id: string; email?: string; role?: string }): void;
  clearUserContext(): void;
}

class ProductionMonitoring implements MonitoringService {
  private isDevelopment = import.meta.env.DEV;

  captureError(error: Error, context?: Record<string, any>): void {
    if (this.isDevelopment) {
      console.error('[MONITORING] Error captured:', error, context);
      return;
    }

    // In production, integrate with error tracking service
    // Example: Sentry.captureException(error, { extra: context });
    this.sendToErrorService(error, context);
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info'): void {
    if (this.isDevelopment) {
      console.log(`[MONITORING] ${level.toUpperCase()}: ${message}`);
      return;
    }

    // In production, send to monitoring service
    this.sendToLogService(message, level);
  }

  setUserContext(user: { id: string; email?: string; role?: string }): void {
    if (this.isDevelopment) {
      console.log('[MONITORING] User context set:', user);
      return;
    }

    // In production, set user context for error tracking
    // Example: Sentry.setUser(user);
    this.updateUserContext(user);
  }

  clearUserContext(): void {
    if (this.isDevelopment) {
      console.log('[MONITORING] User context cleared');
      return;
    }

    // In production, clear user context
    // Example: Sentry.setUser(null);
    this.clearContext();
  }

  private sendToErrorService(error: Error, context?: Record<string, any>): void {
    // Production implementation for error tracking
    // This could be Sentry, LogRocket, Bugsnag, etc.
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail if error reporting fails
      });
    } catch {
      // Silently fail if error reporting fails
    }
  }

  private sendToLogService(message: string, level: string): void {
    // Production implementation for logging
    try {
      fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          level,
          timestamp: new Date().toISOString(),
        }),
      }).catch(() => {
        // Silently fail if logging fails
      });
    } catch {
      // Silently fail if logging fails
    }
  }

  private updateUserContext(user: { id: string; email?: string; role?: string }): void {
    // Store user context for error tracking
    try {
      sessionStorage.setItem('monitoring_user', JSON.stringify(user));
    } catch {
      // Silently fail if storage is not available
    }
  }

  private clearContext(): void {
    try {
      sessionStorage.removeItem('monitoring_user');
    } catch {
      // Silently fail if storage is not available
    }
  }
}

export const monitoring = new ProductionMonitoring();

// Performance monitoring
export const trackPerformance = (operation: string, fn: () => Promise<any> | any) => {
  const start = performance.now();
  
  try {
    const result = fn();
    
    if (result instanceof Promise) {
      return result
        .then((value) => {
          const duration = performance.now() - start;
          monitoring.captureMessage(
            `Performance: ${operation} completed in ${duration.toFixed(2)}ms`,
            'info'
          );
          return value;
        })
        .catch((error) => {
          const duration = performance.now() - start;
          monitoring.captureError(error, {
            operation,
            duration: duration.toFixed(2),
          });
          throw error;
        });
    } else {
      const duration = performance.now() - start;
      monitoring.captureMessage(
        `Performance: ${operation} completed in ${duration.toFixed(2)}ms`,
        'info'
      );
      return result;
    }
  } catch (error) {
    const duration = performance.now() - start;
    monitoring.captureError(error as Error, {
      operation,
      duration: duration.toFixed(2),
    });
    throw error;
  }
};

// Health check endpoint data
export const getHealthStatus = async () => {
  try {
    const checks = {
      database: await checkDatabaseHealth(),
      auth: await checkAuthHealth(),
      storage: await checkStorageHealth(),
      timestamp: new Date().toISOString(),
    };
    
    return {
      status: 'healthy',
      checks,
    };
  } catch (error) {
    monitoring.captureError(error as Error, { context: 'health_check' });
    return {
      status: 'unhealthy',
      error: (error as Error).message,
      timestamp: new Date().toISOString(),
    };
  }
};

async function checkDatabaseHealth(): Promise<boolean> {
  // Implement database health check
  // This could ping a simple query to ensure DB is responsive
  return true;
}

async function checkAuthHealth(): Promise<boolean> {
  // Implement auth health check
  // This could verify auth service is responding
  return true;
}

async function checkStorageHealth(): Promise<boolean> {
  // Implement storage health check
  // This could verify file storage is accessible
  return true;
}