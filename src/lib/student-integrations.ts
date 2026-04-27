import { supabase } from "@/integrations/supabase/client";
import { logger } from './logger';

export interface StudentIntegration {
  id: string;
  user_id: string;
  shopify_api_token?: string;
  shop_domain?: string;
  is_shopify_connected: boolean;
  meta_api_token?: string;
  is_meta_connected: boolean;
  created_at: string;
  updated_at: string;
}

// Client-side functions using existing users table for now
export const StudentIntegrations = {
  async get(userId: string): Promise<StudentIntegration | null> {
    const { data, error } = await supabase
      .from('users')
      .select('id, shopify_credentials, meta_ads_credentials')
      .eq('id', userId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) return null;

    // Map to expected format
    return {
      id: data.id,
      user_id: data.id,
      shopify_api_token: data.shopify_credentials,
      shop_domain: '', // Will be stored separately later
      is_shopify_connected: !!data.shopify_credentials,
      meta_api_token: data.meta_ads_credentials,
      is_meta_connected: !!data.meta_ads_credentials,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async upsert(integration: Partial<StudentIntegration> & { userId: string }) {
    const updates: any = {};
    
    if (integration.shopify_api_token !== undefined) {
      updates.shopify_credentials = integration.shopify_api_token;
    }
    if (integration.meta_api_token !== undefined) {
      updates.meta_ads_credentials = integration.meta_api_token;
    }

    const { data, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', integration.userId)
      .select()
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async disconnect(userId: string, service: 'shopify' | 'meta') {
    const updates = service === 'shopify' 
      ? { shopify_credentials: null }
      : { meta_ads_credentials: null };

    const { error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId);

    if (error) throw error;
  }
};

// Encryption helpers (call server functions)
export async function encryptToken(token: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke('encrypt-token', {
    body: { action: 'encrypt', data: token }
  });

  if (error) throw error;
  return data.encrypted;
}

export async function fetchShopifyMetrics(
  userId: string,
  opts?: { startDate?: string; endDate?: string; timezone?: string; timeBasis?: 'created' | 'processed' }
) {
  const { data, error } = await supabase.functions.invoke('shopify-metrics', {
    body: {
      userId,
      startDate: opts?.startDate,
      endDate: opts?.endDate,
      timezone: opts?.timezone,
      timeBasis: opts?.timeBasis,
    }
  });

  if (error) throw error;
  return data;
}

export async function fetchMetaAdsMetrics(
  userId: string,
  opts?: { dateFrom?: string; dateTo?: string }
) {
  const { data, error } = await supabase.functions.invoke('meta-ads-metrics', {
    body: {
      userId,
      dateFrom: opts?.dateFrom,
      dateTo: opts?.dateTo,
    }
  });

  if (error) throw error;
  return data;
}