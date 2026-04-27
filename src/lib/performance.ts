// Performance monitoring utilities
import { safeLogger } from './safe-logger';
export const measurePageLoad = () => {
  if (typeof window !== 'undefined' && window.performance) {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    
    const metrics = {
      dns: navigation.domainLookupEnd - navigation.domainLookupStart,
      tcp: navigation.connectEnd - navigation.connectStart,
      request: navigation.responseStart - navigation.requestStart,
      response: navigation.responseEnd - navigation.responseStart,
      dom: navigation.domContentLoadedEventEnd - navigation.fetchStart,
      load: navigation.loadEventEnd - navigation.fetchStart,
    };
    
    safeLogger.performance('Performance Metrics', 0, metrics);
    return metrics;
  }
  return null;
};

export const measureLCP = () => {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        safeLogger.performance('Largest Contentful Paint', lastEntry.startTime);
      });
      
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
      
      // Disconnect after 10 seconds to prevent memory leaks
      setTimeout(() => observer.disconnect(), 10000);
    } catch (error) {
      console.warn('LCP measurement not supported:', error);
    }
  }
};

export const measureFID = () => {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (entry.processingStart && entry.startTime) {
            safeLogger.performance('First Input Delay', entry.processingStart - entry.startTime);
          }
        });
      });
      
      observer.observe({ type: 'first-input', buffered: true });
      
      // Disconnect after 10 seconds
      setTimeout(() => observer.disconnect(), 10000);
    } catch (error) {
      console.warn('FID measurement not supported:', error);
    }
  }
};

export const measureCLS = () => {
  if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
    try {
      let clsValue = 0;
      
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
          }
        });
        safeLogger.performance('Cumulative Layout Shift', clsValue);
      });
      
      observer.observe({ type: 'layout-shift', buffered: true });
      
      // Disconnect after 10 seconds
      setTimeout(() => observer.disconnect(), 10000);
    } catch (error) {
      console.warn('CLS measurement not supported:', error);
    }
  }
};

// Initialize all performance measurements
export const initPerformanceMonitoring = () => {
  if (import.meta.env.PROD) {
    measurePageLoad();
    measureLCP();
    measureFID();
    measureCLS();
  }
};