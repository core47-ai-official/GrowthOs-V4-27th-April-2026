import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { errorHandler } from '@/lib/error-handler';
import { safeMaybeSingle } from '@/lib/database-safety';

interface QueryOptions {
  enabled?: boolean;
  refetchInterval?: number;
  staleTime?: number;
  cacheTime?: number;
  refetchOnWindowFocus?: boolean;
  retry?: boolean | number;
}

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<void>;
  isStale: boolean;
}

// Simple in-memory cache
const queryCache = new Map<string, {
  data: any;
  timestamp: number;
  staleTime: number;
}>();

// Cleanup old cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > value.staleTime + 300000) { // 5 minutes buffer
      queryCache.delete(key);
    }
  }
}, 300000); // Run every 5 minutes

export function useOptimizedQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  options: QueryOptions = {}
): QueryResult<T> {
  const {
    enabled = true,
    refetchInterval,
    staleTime = 30000, // 30 seconds default
    cacheTime = 300000, // 5 minutes default
    refetchOnWindowFocus = true,
    retry = 3
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isFetching, setIsFetching] = useState(false);
  
  const retryCountRef = useRef(0);
  const cacheKey = queryKey.join('|');
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (force = false) => {
    if (!enabled) return;

    // Check cache first
    const cached = queryCache.get(cacheKey);
    const now = Date.now();
    
    if (!force && cached && (now - cached.timestamp) < cached.staleTime) {
      setData(cached.data);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsFetching(true);
    setError(null);

    try {
      const result = await queryFn();
      
      // Cache the result
      queryCache.set(cacheKey, {
        data: result,
        timestamp: now,
        staleTime
      });

      setData(result);
      setError(null);
      retryCountRef.current = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Query failed');
      
      // Use centralized error handling (suppress toast for background queries)
      errorHandler.handleError(error, 'data_fetch', false);
      
      // Retry logic
      const maxRetries = typeof retry === 'number' ? retry : (retry ? 3 : 0);
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        setTimeout(() => fetchData(force), Math.pow(2, retryCountRef.current) * 1000);
        return;
      }
      
      setError(error);
      retryCountRef.current = 0;
    } finally {
      setIsLoading(false);
      setIsFetching(false);
    }
  }, [enabled, queryFn, cacheKey, staleTime, retry]);

  const refetch = useCallback(() => fetchData(true), [fetchData]);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refetch interval
  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(() => fetchData(), refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetchData]);

  // Refetch on window focus
  useEffect(() => {
    if (!refetchOnWindowFocus || !enabled) return;

    const handleFocus = () => {
      const cached = queryCache.get(cacheKey);
      const isStale = !cached || (Date.now() - cached.timestamp) > staleTime / 2;
      
      if (isStale) {
        fetchData();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [refetchOnWindowFocus, enabled, fetchData, cacheKey, staleTime]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const cached = queryCache.get(cacheKey);
  const isStale = !cached || (Date.now() - cached.timestamp) > staleTime;

  return {
    data,
    error,
    isLoading,
    isFetching,
    refetch,
    isStale
  };
}

// Hook for optimized user data fetching
export function useOptimizedUserData(userId?: string) {
  return useOptimizedQuery(
    ['user', userId || ''],
    async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('users')
        .select('id, email, role, full_name, created_at, shopify_credentials, meta_ads_credentials')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        errorHandler.handleError(error, 'user_data_fetch', false);
        throw error;
      }
      return data;
    },
    {
      enabled: !!userId,
      staleTime: 60000, // 1 minute
      refetchOnWindowFocus: false
    }
  );
}

// Hook for optimized company settings
export function useOptimizedCompanySettings() {
  return useOptimizedQuery(
    ['company_settings'],
    async () => {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        errorHandler.handleError(error, 'company_settings_fetch', false);
        throw error;
      }
      return data;
    },
    {
      staleTime: 300000, // 5 minutes - settings don't change often
      refetchOnWindowFocus: false
    }
  );
}