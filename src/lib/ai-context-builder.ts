/**
 * AI Context Builder
 * Fetches and formats business context for the Success Partner AI
 */

import { supabase } from '@/integrations/supabase/client';
import { fetchShopifyMetrics, StudentIntegrations, fetchMetaAdsMetrics } from './student-integrations';
import type { BusinessContextFlags } from './ai-context-detector';
import { ENV_CONFIG } from './env-config';

// Cache system for context data
interface CacheEntry {
  data: ShopifyContext | MetaAdsContext;
  timestamp: number;
}

const contextCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 3 * 60 * 1000; // 3 minutes
const lastFetchTime = new Map<string, number>();
const THROTTLE_MS = 2000; // 2 seconds between fetches

export interface ShopifyContext {
  connected: boolean;
  dateRange?: string;
  metrics?: {
    totalSales: number;
    orderCount: number;
    averageOrderValue: number;
    topProducts?: Array<{ name: string; sales: number }>;
    salesTrend?: Array<{ date: string; sales: number }>;
    // Full product details with sales
    products?: Array<{ 
      id: number | string; 
      name: string; 
      sales: number; 
      revenue: number;
      orders?: number;
    }>;
  };
  error?: string;
}

export interface MetaAdsContext {
  connected: boolean;
  dateRange?: string;
  metrics?: {
    totalSpend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    roas: number;
    ctr: number;
    // Detailed campaign data
    campaigns?: Array<{
      id: string;
      name: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      cpm: number;
      roas?: number;
      performance?: string;
    }>;
    // Detailed adset data
    adSets?: Array<{
      id: string;
      name: string;
      campaignId: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      performance?: string;
    }>;
    // Detailed ad data
    ads?: Array<{
      id: string;
      name: string;
      adSetId: string;
      status: string;
      spend: number;
      impressions: number;
      clicks: number;
      conversions: number;
      ctr: number;
      cpc: number;
      performance?: string;
    }>;
  };
  error?: string;
}

export interface BusinessContext {
  shopify?: ShopifyContext;
  metaAds?: MetaAdsContext;
  dateRangeDays?: number;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

/**
 * Fetches Shopify context for a user
 */
async function getShopifyContext(userId: string, dateRangeDays: number = ENV_CONFIG.SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS): Promise<ShopifyContext> {
  // Check cache first
  const cacheKey = `shopify_${userId}_${dateRangeDays}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as ShopifyContext;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRangeDays);

    // Always call fetchShopifyMetrics - it will check connection internally
    const metrics = await fetchShopifyMetrics(userId, {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString()
    });

    // Check if connected based on the response
    if (!metrics || metrics.error || !metrics.connected) {
      return { connected: false };
    }

    const result: ShopifyContext = {
      connected: true,
      dateRange: `last ${dateRangeDays} days`,
      metrics: {
        totalSales: metrics.metrics?.gmv || 0,
        orderCount: metrics.metrics?.orders || 0,
        averageOrderValue: metrics.metrics?.aov || 0,
        topProducts: metrics.metrics?.topProducts || [],
        salesTrend: metrics.metrics?.salesTrend || [],
        // Include all products with their detailed sales data
        products: metrics.metrics?.products || metrics.metrics?.topProducts || []
      }
    };

    // Cache the result only if successful
    contextCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching Shopify context:', error);
    return { connected: false, error: 'Failed to fetch Shopify data' };
  }
}

/**
 * Fetches Meta Ads context for a user
 */
async function getMetaAdsContext(userId: string, dateRangeDays: number = ENV_CONFIG.SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS): Promise<MetaAdsContext> {
  // Check cache first
  const cacheKey = `meta_${userId}_${dateRangeDays}`;
  const cached = contextCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data as MetaAdsContext;
  }

  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRangeDays);

    // Always call fetchMetaAdsMetrics - it will check connection internally
    const metricsData = await fetchMetaAdsMetrics(userId, {
      dateFrom: startDate.toISOString(),
      dateTo: endDate.toISOString()
    });

    // Check if connected based on the response
    if (!metricsData || !metricsData.connected) {
      return { connected: false };
    }

    const result: MetaAdsContext = {
      connected: true,
      dateRange: `last ${dateRangeDays} days`,
      metrics: {
        totalSpend: metricsData.metrics?.totalSpend || 0,
        impressions: metricsData.metrics?.totalImpressions || 0,
        clicks: metricsData.metrics?.totalClicks || 0,
        conversions: metricsData.metrics?.totalConversions || 0,
        roas: metricsData.metrics?.averageROAS || 0,
        ctr: metricsData.metrics?.averageCTR || 0,
        // Include detailed campaign, adset, and ad data
        campaigns: metricsData.metrics?.campaigns || [],
        adSets: metricsData.metrics?.adSets || [],
        ads: metricsData.metrics?.ads || []
      }
    };

    // Cache the result only if successful
    contextCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.error('Error fetching Meta Ads context:', error);
    return { connected: false, error: 'Failed to fetch Meta Ads data' };
  }
}

/**
 * Builds business context based on detection flags
 * @param userId - User ID
 * @param flags - Context flags indicating what to fetch
 * @param timeout - Maximum time to wait for context (ms)
 * @param timeouts - Per-service timeout overrides (optional)
 * @param dateRangeDays - Number of days to fetch data for
 * @returns Business context object
 */
export async function buildBusinessContext(
  userId: string,
  flags: BusinessContextFlags,
  timeout: number = 5000,
  timeouts?: { shopify?: number; metaAds?: number },
  dateRangeDays: number = ENV_CONFIG.SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS
): Promise<BusinessContext | null> {
  if (!flags.includeShopify && !flags.includeMetaAds) {
    return null;
  }

  // Rate limiting: throttle requests
  const lastFetch = lastFetchTime.get(userId);
  if (lastFetch && Date.now() - lastFetch < THROTTLE_MS) {
    // Too soon, wait a bit
    await new Promise(resolve => setTimeout(resolve, THROTTLE_MS - (Date.now() - lastFetch)));
  }
  lastFetchTime.set(userId, Date.now());

  try {
    // Fetch contexts with per-service timeouts and return whatever is ready
    const racers: Array<Promise<any>> = [];

    const withTimeout = <T>(p: Promise<T>, ms: number) =>
      Promise.race([
        p,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
      ]);

    if (flags.includeShopify) {
      const shopifyTimeout = timeouts?.shopify ?? timeout;
      racers.push(
        withTimeout(getShopifyContext(userId, dateRangeDays), shopifyTimeout)
          .then((r) => ({ key: 'shopify', value: r }))
          .catch(() => ({ key: 'shopify', value: null }))
      );
    }
    if (flags.includeMetaAds) {
      const metaAdsTimeout = timeouts?.metaAds ?? timeout;
      racers.push(
        withTimeout(getMetaAdsContext(userId, dateRangeDays), metaAdsTimeout)
          .then((r) => ({ key: 'metaAds', value: r }))
          .catch(() => ({ key: 'metaAds', value: null }))
      );
    }

    const settled = await Promise.all(racers);

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - dateRangeDays);

    const context: BusinessContext = {
      dateRangeDays,
      dateRange: {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      }
    };
    
    for (const item of settled as any[]) {
      if (item.key === 'shopify' && item.value) context.shopify = item.value as ShopifyContext;
      if (item.key === 'metaAds' && item.value) context.metaAds = item.value as MetaAdsContext;
    }

    // Ensure requested services are always present in the response
    if (flags.includeShopify && !context.shopify) {
      context.shopify = { connected: false, error: 'timeout or fetch failed' };
    }
    if (flags.includeMetaAds && !context.metaAds) {
      context.metaAds = { connected: false, error: 'timeout or fetch failed' };
    }

    return context;
  } catch (error) {
    console.error('Error building business context:', error);
    // Even on error, return context with requested services marked as failed
    const context: BusinessContext = {};
    if (flags.includeShopify) {
      context.shopify = { connected: false, error: 'Error building context' };
    }
    if (flags.includeMetaAds) {
      context.metaAds = { connected: false, error: 'Error building context' };
    }
    return context;
  }
}
