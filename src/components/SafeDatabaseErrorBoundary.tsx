/**
 * Database Error Boundary for safe migration
 * Catches database-related errors and provides fallback UI
 */

import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { MigrationMonitor } from '@/lib/migration-utilities';
import { safeLogger } from '@/lib/safe-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: any;
}

export class SafeDatabaseErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    const { context = 'unknown' } = this.props;
    
    // Track error for migration monitoring
    if (isFeatureEnabled('ENABLE_DATABASE_ERROR_BOUNDARIES')) {
      MigrationMonitor.trackMetric('database', 'error_boundary_caught', { 
        context, 
        error: error.message 
      });
    }
    
    // Log error safely
    safeLogger.error(`Database error boundary caught error in ${context}`, error, {
      errorInfo,
      componentStack: errorInfo.componentStack
    });

    this.setState({
      error,
      errorInfo
    });
  }

  handleRetry = () => {
    const { context = 'unknown' } = this.props;
    
    if (isFeatureEnabled('ENABLE_DATABASE_ERROR_BOUNDARIES')) {
      MigrationMonitor.trackMetric('database', 'error_boundary_retry', { context });
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    // If error boundaries are disabled, throw the error to parent
    if (!isFeatureEnabled('ENABLE_DATABASE_ERROR_BOUNDARIES')) {
      throw this.state.error;
    }

    // Use custom fallback if provided
    if (this.props.fallback) {
      return this.props.fallback;
    }

    // Default error boundary UI
    return (
      <div className="p-4 space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Database Connection Issue</AlertTitle>
          <AlertDescription>
            We're having trouble loading this data. This might be a temporary issue.
          </AlertDescription>
        </Alert>
        
        <div className="flex gap-2">
          <Button onClick={this.handleRetry} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
          
          {import.meta.env.DEV && (
            <details className="text-xs text-muted-foreground">
              <summary>Error Details (Development)</summary>
              <pre className="mt-2 whitespace-pre-wrap">
                {this.state.error?.message}
              </pre>
            </details>
          )}
        </div>
      </div>
    );
  }
}

/**
 * HOC for wrapping components with database error boundary
 */
export function withDatabaseErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: string,
  fallback?: ReactNode
) {
  return function DatabaseErrorBoundaryWrapper(props: P) {
    return (
      <SafeDatabaseErrorBoundary context={context} fallback={fallback}>
        <Component {...props} />
      </SafeDatabaseErrorBoundary>
    );
  };
}