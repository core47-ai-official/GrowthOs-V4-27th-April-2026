// Performance monitoring and optimization utilities
import { safeLogger } from '@/lib/safe-logger';

// Debounce function for search inputs and rapid events
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  
  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };
    
    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Throttle function for scroll handlers and frequent events
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Intersection Observer for lazy loading and infinite scroll
export function createIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit = {}
): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: '100px',
    threshold: 0.1,
    ...options
  };

  return new IntersectionObserver(callback, defaultOptions);
}

// Virtual scrolling for large lists
export function calculateVirtualizedItems(
  scrollTop: number,
  containerHeight: number,
  itemHeight: number,
  totalItems: number,
  overscan = 3
) {
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(
    startIndex + Math.ceil(containerHeight / itemHeight),
    totalItems - 1
  );

  return {
    startIndex: Math.max(0, startIndex - overscan),
    endIndex: Math.min(totalItems - 1, endIndex + overscan),
    offsetY: startIndex * itemHeight
  };
}

// Performance timing utilities
export class PerformanceTracker {
  private static marks: Map<string, number> = new Map();
  
  static mark(name: string): void {
    this.marks.set(name, performance.now());
  }
  
  static measure(name: string, startMark: string): number {
    const start = this.marks.get(startMark);
    if (!start) {
      console.warn(`Start mark '${startMark}' not found`);
      return 0;
    }
    
    const duration = performance.now() - start;
    safeLogger.performance(name, duration);
    return duration;
  }
  
  static clear(): void {
    this.marks.clear();
  }
}

// Component render optimization
export function shouldComponentUpdate(
  prevProps: Record<string, any>,
  nextProps: Record<string, any>,
  shallowCompare = true
): boolean {
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  
  if (prevKeys.length !== nextKeys.length) return true;
  
  for (const key of prevKeys) {
    if (shallowCompare) {
      if (prevProps[key] !== nextProps[key]) return true;
    } else {
      if (JSON.stringify(prevProps[key]) !== JSON.stringify(nextProps[key])) return true;
    }
  }
  
  return false;
}

// Memory cleanup utilities
export function cleanupResources() {
  // Clear any intervals or timeouts that might be running
  const highestTimeoutId = setTimeout(() => {}, 0) as any;
  for (let i = 0; i < Number(highestTimeoutId); i++) {
    clearTimeout(i);
  }
  
  const highestIntervalId = setInterval(() => {}, 999999) as any;
  for (let i = 0; i < Number(highestIntervalId); i++) {
    clearInterval(i);
  }
}

// Bundle size optimization - dynamic imports helper
export function createLazyImport<T>(
  importFn: () => Promise<{ default: T }>
): () => Promise<{ default: T }> {
  return importFn;
}

// Image optimization utilities
export function optimizeImageLoading(img: HTMLImageElement): void {
  // Add loading="lazy" if not set
  if (!img.hasAttribute('loading')) {
    img.loading = 'lazy';
  }
  
  // Add decoding="async" for better performance
  if (!img.hasAttribute('decoding')) {
    img.decoding = 'async';
  }
}

// Network request optimization
export class RequestBatcher {
  private batches: Map<string, any[]> = new Map();
  private timeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private readonly batchDelay: number;
  
  constructor(batchDelay = 100) {
    this.batchDelay = batchDelay;
  }
  
  add<T>(key: string, request: T, executor: (requests: T[]) => Promise<void>): void {
    if (!this.batches.has(key)) {
      this.batches.set(key, []);
    }
    
    this.batches.get(key)!.push(request);
    
    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    
    // Set new timeout to execute batch
    const timeout = setTimeout(async () => {
      const requests = this.batches.get(key) || [];
      this.batches.delete(key);
      this.timeouts.delete(key);
      
      if (requests.length > 0) {
        await executor(requests);
      }
    }, this.batchDelay);
    
    this.timeouts.set(key, timeout);
  }
  
  flush(key?: string): void {
    if (key) {
      const timeout = this.timeouts.get(key);
      if (timeout) {
        clearTimeout(timeout);
        this.timeouts.delete(key);
      }
      this.batches.delete(key);
    } else {
      this.timeouts.forEach(timeout => clearTimeout(timeout));
      this.timeouts.clear();
      this.batches.clear();
    }
  }
}

// Create a global request batcher instance
export const globalRequestBatcher = new RequestBatcher(150);