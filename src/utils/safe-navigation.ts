/**
 * Safe navigation utilities to replace window.location.reload()
 * Provides React Router alternatives with fallback support
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { MigrationMonitor } from '@/lib/migration-utilities';
import { safeLogger } from '@/lib/safe-logger';

/**
 * Safe replacement for window.location.reload()
 */
export function safeReload(fallbackAction?: () => void) {
  if (isFeatureEnabled('REPLACE_WINDOW_RELOAD')) {
    MigrationMonitor.trackMetric('navigation', 'reload_replacement_used', {});
    safeLogger.info('Using React Router navigation instead of window.reload');
    
    if (fallbackAction) {
      fallbackAction();
    } else {
      // Default fallback - refresh current route
      const currentPath = window.location.pathname + window.location.search;
      window.history.replaceState({}, '', currentPath);
    }
  } else {
    MigrationMonitor.trackMetric('navigation', 'window_reload_fallback', {});
    window.location.reload();
  }
}

/**
 * Hook for safe navigation reload with React Router
 */
export function useSafeNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const safeRefresh = () => {
    if (isFeatureEnabled('REPLACE_WINDOW_RELOAD')) {
      MigrationMonitor.trackMetric('navigation', 'react_router_refresh', {});
      // Force re-render by navigating to same route
      navigate(0); // navigate(0) refreshes current route
    } else {
      safeReload();
    }
  };
  
  const safeNavigateWithReload = (path: string) => {
    // Validate path is same-origin to prevent open-redirect.
    // Only allow paths starting with "/" and not "//" (protocol-relative).
    const isSafeInternalPath =
      typeof path === 'string' &&
      path.startsWith('/') &&
      !path.startsWith('//');

    if (!isSafeInternalPath) {
      safeLogger.warn('safeNavigateWithReload: blocked unsafe path', { path });
      return;
    }

    if (isFeatureEnabled('REPLACE_WINDOW_RELOAD')) {
      MigrationMonitor.trackMetric('navigation', 'react_router_navigate', { path });
      navigate(path);
    } else {
      window.location.href = path;
    }
  };
  
  return {
    safeRefresh,
    safeNavigateWithReload,
    currentPath: location.pathname + location.search
  };
}

/**
 * Component wrapper for navigation fallbacks
 */
export function withSafeNavigation<P extends Record<string, any>>(
  Component: React.ComponentType<P>
): React.ComponentType<P> {
  return function SafeNavigationWrapper(props: P) {
    // This wrapper can add navigation error boundaries if needed
    return React.createElement(Component, props);
  };
}