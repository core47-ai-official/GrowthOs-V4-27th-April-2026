import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper to fetch and handle Graph API errors
async function fetchJson(url: string, context: string) {
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`${context} failed (${response.status}):`, JSON.stringify(data, null, 2));
      return { 
        ok: false, 
        status: response.status, 
        error: data.error || data,
        data: null 
      };
    }
    
    return { ok: true, status: response.status, error: null, data };
  } catch (err) {
    console.error(`${context} exception:`, err);
    return { ok: false, status: 0, error: { message: err.message }, data: null };
  }
}

async function decrypt(encryptedText: string): Promise<string> {
  try {
    const decoded = atob(encryptedText);
    if (decoded) return decoded;
  } catch (_) {}
  
  if (/^(EAA|CAA)/.test(encryptedText)) return encryptedText;
  
  try {
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/encrypt-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
      },
      body: JSON.stringify({ action: 'decrypt', data: encryptedText })
    });
    if (response.ok) {
      const result = await response.json();
      if (result?.decrypted) return result.decrypted;
    }
  } catch (_) {}
  
  return encryptedText;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    let dateFrom: string | null = null
    let dateTo: string | null = null
    let bodyUserId: string | null = null

    if (req.body) {
      try {
        const body = await req.json()
        dateFrom = body.dateFrom ?? null
        dateTo = body.dateTo ?? null
        bodyUserId = body.userId ?? null
      } catch (_e) {}
    }

    let effectiveUserId: string | null = null
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '')
        const { data: user } = await supabaseClient.auth.getUser(token)
        if (user?.user?.id) effectiveUserId = user.user.id
      } catch (_e) {}
    }
    if (!effectiveUserId && bodyUserId) {
      effectiveUserId = bodyUserId
    }

    if (!effectiveUserId) {
      return new Response(
        JSON.stringify({ connected: false, error: 'Unauthorized: missing user id' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: integ, error: integErr } = await supabaseClient
      .from('integrations')
      .select('access_token, external_id')
      .eq('user_id', effectiveUserId)
      .eq('source', 'meta_ads')
      .maybeSingle()

    if (integErr) throw integErr

    let accessToken: string | null = null;
    let externalId: string | null = null;

    if (integ?.access_token && integ.external_id) {
      accessToken = await decrypt(integ.access_token)
      externalId = String(integ.external_id)
    } else {
      const { data: userData, error: userErr } = await supabaseClient
        .from('users')
        .select('meta_ads_credentials')
        .eq('id', effectiveUserId)
        .maybeSingle()

      if (!userErr && userData?.meta_ads_credentials) {
        try {
          const rawCredential = userData.meta_ads_credentials.trim()
          const decryptedCreds = await decrypt(rawCredential)
          
          try {
            const creds = JSON.parse(decryptedCreds)
            if (creds.accessToken && creds.accountId) {
              accessToken = creds.accessToken
              externalId = String(creds.accountId)
            }
          } catch (jsonError) {
            if (decryptedCreds.startsWith('EAA') || decryptedCreds.startsWith('CAA')) {
              accessToken = decryptedCreds
            }
          }
        } catch (e) {
          console.error('Error processing legacy Meta Ads credentials:', e)
        }
      }
    }

    if (!accessToken) {
      return new Response(
        JSON.stringify({ connected: false, error: 'No Meta Ads token found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const warnings: string[] = [];
    const lastAttempt: any = { httpStatuses: {} };

    // Validate token with /me
    console.log('✓ Validating token with /me...');
    const meUrl = new URL('https://graph.facebook.com/v19.0/me');
    meUrl.searchParams.set('fields', 'id,name');
    meUrl.searchParams.set('access_token', accessToken);
    
    const meResult = await fetchJson(meUrl.toString(), 'Token validation (/me)');
    lastAttempt.httpStatuses.me = meResult.status;
    
    if (!meResult.ok) {
      const errCode = meResult.error?.code;
      if (errCode === 190 || errCode === 100) {
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: 'Invalid or expired access token. Please reconnect your Meta Ads account.',
            warnings: ['Token validation failed']
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      warnings.push('Could not validate token');
    } else {
      console.log(`✓ Token validated for user: ${meResult.data.name || meResult.data.id}`);
    }

    // Check account accessibility
    console.log('✓ Checking accessible ad accounts...');
    const accountsUrl = new URL('https://graph.facebook.com/v19.0/me/adaccounts');
    accountsUrl.searchParams.set('fields', 'id,name,account_status');
    accountsUrl.searchParams.set('limit', '100');
    accountsUrl.searchParams.set('access_token', accessToken);
    
    const accountsResult = await fetchJson(accountsUrl.toString(), 'Account enumeration (/me/adaccounts)');
    lastAttempt.httpStatuses.adaccounts = accountsResult.status;
    
    if (!accountsResult.ok) {
      const errCode = accountsResult.error?.code;
      if (errCode === 200 || errCode === 2635) {
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: 'Your token is missing the ads_read or ads_management permission. Please reconnect with proper permissions.',
            warnings: ['Missing required permissions']
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      warnings.push('Could not enumerate ad accounts');
    }

    const accessibleAccounts = accountsResult.data?.data || [];
    console.log(`✓ Found ${accessibleAccounts.length} accessible ad account(s)`);

    // Auto-detect or validate account ID
    if (!externalId && accessibleAccounts.length > 0) {
      const activeAccount = accessibleAccounts.find((acc: any) => acc.account_status === 1) || accessibleAccounts[0];
      externalId = activeAccount.id;
      console.log(`➡️ Auto-detected account ID: ${externalId} (${activeAccount.name || 'Unknown'})`);
    }

    if (externalId && accessibleAccounts.length > 0) {
      const normalizedId = externalId.startsWith('act_') ? externalId : `act_${externalId}`;
      const found = accessibleAccounts.find((acc: any) => 
        acc.id === normalizedId || acc.id === externalId
      );
      
      if (!found) {
        return new Response(
          JSON.stringify({ 
            connected: false, 
            error: `The token does not have access to ad account ${externalId}. It may belong to a different Business Manager.`,
            warnings: ['Account not accessible']
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (!externalId) {
      return new Response(
        JSON.stringify({ 
          connected: false, 
          error: 'No ad account found. Please reconnect and ensure you have access to at least one ad account.',
          warnings: ['No ad account available']
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const accountIdRaw = externalId;
    let accountId = accountIdRaw.startsWith('act_') ? accountIdRaw : `act_${accountIdRaw}`;
    console.log(`✓ Using Meta Ads account ID: ${accountId}`);

    // Fetch account currency
    let accountCurrency = 'USD';
    const currencyUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}`);
    currencyUrl.searchParams.set('fields', 'currency,name');
    currencyUrl.searchParams.set('access_token', accessToken);
    
    const currencyResult = await fetchJson(currencyUrl.toString(), 'Currency detection');
    lastAttempt.httpStatuses.account = currencyResult.status;
    
    if (currencyResult.ok && currencyResult.data.currency) {
      accountCurrency = currencyResult.data.currency;
      console.log(`✓ Account currency detected: ${accountCurrency}`);
    } else {
      warnings.push(`Could not detect account currency (status: ${currencyResult.status}), defaulting to USD`);
    }

    // Initialize metrics
    let metrics = {
      totalSpend: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalConversions: 0,
      totalConversionValue: 0,
      averageCTR: 0,
      averageCPC: 0,
      averageROAS: 0,
      campaigns: [] as any[],
      adSets: [] as any[],
      ads: [] as any[],
      currency: accountCurrency,
    };

    const categorizePerformance = (
      ctr: number, 
      cpc: number, 
      roas: number, 
      objective: string = 'UNKNOWN',
      spend: number = 0
    ): string => {
      let primaryScore = 0;
      let secondaryScore = 0;
      
      switch (objective.toUpperCase()) {
        case 'CONVERSIONS':
        case 'PURCHASE':
        case 'CATALOG_SALES':
          if (roas >= 4) primaryScore = 100;
          else if (roas >= 2.5) primaryScore = 80;
          else if (roas >= 1.5) primaryScore = 60;
          else if (roas >= 1.0) primaryScore = 40;
          else primaryScore = 20;
          
          if (ctr >= 1.5) secondaryScore = 20;
          else if (ctr >= 1.0) secondaryScore = 15;
          else if (ctr >= 0.5) secondaryScore = 10;
          else secondaryScore = 5;
          break;
          
        case 'TRAFFIC':
        case 'LINK_CLICKS':
          if (ctr >= 2.5) primaryScore = 100;
          else if (ctr >= 2.0) primaryScore = 80;
          else if (ctr >= 1.5) primaryScore = 60;
          else if (ctr >= 1.0) primaryScore = 40;
          else primaryScore = 20;
          
          const cpcThreshold = spend > 500 ? 2.0 : spend > 100 ? 1.5 : 1.0;
          if (cpc <= cpcThreshold * 0.5) secondaryScore = 20;
          else if (cpc <= cpcThreshold) secondaryScore = 15;
          else if (cpc <= cpcThreshold * 1.5) secondaryScore = 10;
          else secondaryScore = 5;
          break;
          
        default:
          const ctrScore = ctr >= 2.0 ? 50 : ctr >= 1.5 ? 40 : ctr >= 1.0 ? 30 : 20;
          const cpcScore = cpc <= 1.0 ? 30 : cpc <= 2.0 ? 25 : cpc <= 3.0 ? 20 : 10;
          const roasScore = roas >= 2 ? 20 : roas >= 1 ? 15 : roas >= 0.5 ? 10 : 5;
          primaryScore = ctrScore + cpcScore;
          secondaryScore = roasScore;
      }
      
      const totalScore = primaryScore + secondaryScore;
      
      if (totalScore >= 90) return 'excellent';
      if (totalScore >= 70) return 'good';
      if (totalScore >= 50) return 'average';
      return 'poor';
    };

    const INSIGHTS_FIELDS = 'spend,impressions,clicks,actions,action_values,cost_per_action_type,cpc,ctr,frequency,reach,cpm,purchase_roas';
    let dateParams: { [key: string]: string } = {};
    let datePreset = 'last_7d';
    
    if (dateFrom && dateTo) {
      const fromDate = new Date(dateFrom).toISOString().split('T')[0];
      const toDate = new Date(dateTo).toISOString().split('T')[0];
      dateParams = { time_range: JSON.stringify({ since: fromDate, until: toDate }) };
      datePreset = 'custom';
      console.log(`Using custom date range: ${fromDate} to ${toDate}`);
    } else {
      dateParams = { date_preset: datePreset };
      console.log(`Using default date preset: ${datePreset}`);
    }

    lastAttempt.presetUsed = datePreset;

    // Fetch campaigns with all statuses
    const campaignsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/campaigns`);
    campaignsUrl.searchParams.set('fields', `id,name,status,objective,effective_status,daily_budget,lifetime_budget,insights.date_preset(${datePreset}){${INSIGHTS_FIELDS}}`);
    campaignsUrl.searchParams.set('effective_status', '["ACTIVE","PAUSED","IN_PROCESS","WITH_ISSUES","ARCHIVED","DELETED"]');
    campaignsUrl.searchParams.set('limit', '200');
    campaignsUrl.searchParams.set('access_token', accessToken);
    Object.entries(dateParams).forEach(([k, v]) => campaignsUrl.searchParams.set(k, v));

    console.log('Fetching campaigns...');
    const campaignsResult = await fetchJson(campaignsUrl.toString(), 'Campaigns fetch');
    lastAttempt.httpStatuses.campaigns = campaignsResult.status;

    if (campaignsResult.ok && campaignsResult.data.data) {
      const campaignsData = campaignsResult.data.data;
      console.log(`✓ Fetched ${campaignsData.length} campaigns from edges`);

      for (const campaign of campaignsData) {
        const insightData = campaign.insights?.data?.[0] || {};
        const spend = parseFloat(insightData.spend || 0);
        const impressions = parseInt(insightData.impressions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);
        
        const actions = insightData.actions || [];
        const actionValues = insightData.action_values || [];
        
        const purchaseAction = actions.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
          || actions.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
          || actions.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
        const conversions = purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
        
        const purchaseValueAction = actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
          || actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
          || actionValues.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
        const conversionValue = purchaseValueAction ? parseFloat(purchaseValueAction.value || 0) : 0;
        
        // Handle multiple possible formats for purchase_roas
        let reportedROAS = 0;
        if (Array.isArray(insightData.purchase_roas) && insightData.purchase_roas.length > 0) {
          reportedROAS = parseFloat(insightData.purchase_roas[0]?.value || 0);
        } else if (typeof insightData.purchase_roas === 'object' && insightData.purchase_roas !== null) {
          reportedROAS = parseFloat(insightData.purchase_roas.value || 0);
        } else if (typeof insightData.purchase_roas === 'string' || typeof insightData.purchase_roas === 'number') {
          reportedROAS = parseFloat(insightData.purchase_roas);
        }
        console.log(`📊 Campaign ${campaign.name}: purchase_roas raw:`, JSON.stringify(insightData.purchase_roas), `parsed: ${reportedROAS}`);
        
        const calculatedROAS = spend > 0 ? (conversionValue / spend) : 0;
        console.log(`📊 Campaign ${campaign.name}: calculatedROAS: ${calculatedROAS}, using: ${reportedROAS || calculatedROAS}`);
        
        const performance = categorizePerformance(ctr, cpc, reportedROAS || calculatedROAS, campaign.objective, spend);

        metrics.campaigns.push({
          id: campaign.id,
          name: campaign.name,
          status: campaign.effective_status || campaign.status,
          objective: campaign.objective,
          spend,
          impressions,
          clicks,
          conversions,
          conversionValue,
          ctr,
          cpc,
          roas: reportedROAS || calculatedROAS,
          calculatedROAS,
          reportedROAS,
          reach: parseInt(insightData.reach || 0),
          frequency: parseFloat(insightData.frequency || 0),
          performance
        });

        metrics.totalSpend += spend;
        metrics.totalImpressions += impressions;
        metrics.totalClicks += clicks;
        metrics.totalConversions += conversions;
        metrics.totalConversionValue += conversionValue;
      }
    } else {
      console.warn(`⚠️ No campaigns from edge (status: ${campaignsResult.status}), trying insights level=campaign fallback`);
      warnings.push('Used insights fallback for campaigns');
      
      const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`);
      insightsUrl.searchParams.set('level', 'campaign');
      insightsUrl.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,cpc,ctr,frequency,reach,cpm,purchase_roas');
      insightsUrl.searchParams.set('limit', '200');
      
      // Explicitly set date parameters
      if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom).toISOString().split('T')[0];
        const toDate = new Date(dateTo).toISOString().split('T')[0];
        insightsUrl.searchParams.set('time_range', JSON.stringify({ since: fromDate, until: toDate }));
      } else {
        insightsUrl.searchParams.set('date_preset', datePreset);
      }
      
      insightsUrl.searchParams.set('access_token', accessToken);

      const insightsResult = await fetchJson(insightsUrl.toString(), 'Campaign-level insights');
      
      if (insightsResult.ok && insightsResult.data.data) {
        const insightsData = insightsResult.data.data;
        console.log(`✓ Fetched ${insightsData.length} campaigns from insights`);

        for (const row of insightsData) {
          const spend = parseFloat(row.spend || 0);
          const impressions = parseInt(row.impressions || 0);
          const clicks = parseInt(row.clicks || 0);
          const ctr = parseFloat(row.ctr || 0);
          const cpc = parseFloat(row.cpc || 0);
          
          const actions = row.actions || [];
          const actionValues = row.action_values || [];
          
          const purchaseAction = actions.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
            || actions.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
            || actions.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
          const conversions = purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
          
          const purchaseValueAction = actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
            || actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
            || actionValues.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
          const conversionValue = purchaseValueAction ? parseFloat(purchaseValueAction.value || 0) : 0;
          
          // Handle multiple possible formats for purchase_roas
          let reportedROAS = 0;
          if (Array.isArray(row.purchase_roas) && row.purchase_roas.length > 0) {
            reportedROAS = parseFloat(row.purchase_roas[0]?.value || 0);
          } else if (typeof row.purchase_roas === 'object' && row.purchase_roas !== null) {
            reportedROAS = parseFloat(row.purchase_roas.value || 0);
          } else if (typeof row.purchase_roas === 'string' || typeof row.purchase_roas === 'number') {
            reportedROAS = parseFloat(row.purchase_roas);
          }
          console.log(`📊 Insights Campaign ${row.campaign_name}: purchase_roas raw:`, JSON.stringify(row.purchase_roas), `parsed: ${reportedROAS}`);
          
          const calculatedROAS = spend > 0 ? (conversionValue / spend) : 0;
          console.log(`📊 Insights Campaign ${row.campaign_name}: calculatedROAS: ${calculatedROAS}, using: ${reportedROAS || calculatedROAS}`);
          
          const performance = categorizePerformance(ctr, cpc, reportedROAS || calculatedROAS, 'UNKNOWN', spend);

          metrics.campaigns.push({
            id: row.campaign_id,
            name: row.campaign_name || 'Unknown Campaign',
            status: 'ARCHIVED/PAUSED',
            objective: 'UNKNOWN',
            spend,
            impressions,
            clicks,
            conversions,
            conversionValue,
            ctr,
            cpc,
            roas: reportedROAS || calculatedROAS,
            calculatedROAS,
            reportedROAS,
            reach: parseInt(row.reach || 0),
            frequency: parseFloat(row.frequency || 0),
            performance
          });

          metrics.totalSpend += spend;
          metrics.totalImpressions += impressions;
          metrics.totalClicks += clicks;
          metrics.totalConversions += conversions;
          metrics.totalConversionValue += conversionValue;
        }
      }
    }

    // Fetch ads with all statuses
    const adsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/ads`);
    adsUrl.searchParams.set('fields', `id,name,status,effective_status,adset_id,campaign_id,insights.date_preset(${datePreset}){${INSIGHTS_FIELDS}}`);
    adsUrl.searchParams.set('effective_status', '["ACTIVE","PAUSED","IN_PROCESS","WITH_ISSUES","ARCHIVED","DELETED"]');
    adsUrl.searchParams.set('limit', '200');
    adsUrl.searchParams.set('access_token', accessToken);
    Object.entries(dateParams).forEach(([k, v]) => adsUrl.searchParams.set(k, v));

    console.log('Fetching ads...');
    const adsResult = await fetchJson(adsUrl.toString(), 'Ads fetch');
    lastAttempt.httpStatuses.ads = adsResult.status;

    if (adsResult.ok && adsResult.data.data) {
      const adsData = adsResult.data.data;
      console.log(`✓ Fetched ${adsData.length} ads from edges`);

      for (const ad of adsData) {
        const insightData = ad.insights?.data?.[0] || {};
        const spend = parseFloat(insightData.spend || 0);
        const impressions = parseInt(insightData.impressions || 0);
        const clicks = parseInt(insightData.clicks || 0);
        
        if (spend === 0 && impressions === 0 && clicks === 0) continue;
        
        const ctr = parseFloat(insightData.ctr || 0);
        const cpc = parseFloat(insightData.cpc || 0);
        
        const actions = insightData.actions || [];
        const actionValues = insightData.action_values || [];
        
        const purchaseAction = actions.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
          || actions.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
          || actions.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
        const conversions = purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
        
        const purchaseValueAction = actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
          || actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
          || actionValues.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
        const conversionValue = purchaseValueAction ? parseFloat(purchaseValueAction.value || 0) : 0;
        
        // Handle multiple possible formats for purchase_roas
        let reportedROAS = 0;
        if (Array.isArray(insightData.purchase_roas) && insightData.purchase_roas.length > 0) {
          reportedROAS = parseFloat(insightData.purchase_roas[0]?.value || 0);
        } else if (typeof insightData.purchase_roas === 'object' && insightData.purchase_roas !== null) {
          reportedROAS = parseFloat(insightData.purchase_roas.value || 0);
        } else if (typeof insightData.purchase_roas === 'string' || typeof insightData.purchase_roas === 'number') {
          reportedROAS = parseFloat(insightData.purchase_roas);
        }
        console.log(`📊 Ad ${insightData.ad_name || ad.name}: purchase_roas raw:`, JSON.stringify(insightData.purchase_roas), `parsed: ${reportedROAS}`);
        
        const calculatedROAS = spend > 0 ? (conversionValue / spend) : 0;
        console.log(`📊 Ad ${insightData.ad_name || ad.name}: calculatedROAS: ${calculatedROAS}, using: ${reportedROAS || calculatedROAS}`);
        
        const performance = categorizePerformance(ctr, cpc, reportedROAS || calculatedROAS, 'UNKNOWN', spend);

        metrics.ads.push({
          id: ad.id,
          name: ad.name,
          status: ad.effective_status || ad.status,
          spend,
          impressions,
          clicks,
          conversions,
          conversionValue,
          ctr,
          cpc,
          roas: reportedROAS || calculatedROAS,
          calculatedROAS,
          reportedROAS,
          reach: parseInt(insightData.reach || 0),
          frequency: parseFloat(insightData.frequency || 0),
          performance,
          adsetId: ad.adset_id,
          campaignId: ad.campaign_id
        });
      }
    } else {
      console.warn(`⚠️ No ads from edge (status: ${adsResult.status}), trying insights level=ad fallback`);
      warnings.push('Used insights fallback for ads');
      
      const adsInsightsUrl = new URL(`https://graph.facebook.com/v19.0/${accountId}/insights`);
      adsInsightsUrl.searchParams.set('level', 'ad');
      adsInsightsUrl.searchParams.set('fields', 'ad_id,ad_name,spend,impressions,clicks,actions,action_values,cpc,ctr,frequency,reach,campaign_name,adset_name,cpm,purchase_roas');
      adsInsightsUrl.searchParams.set('limit', '200');
      
      // Explicitly set date parameters
      if (dateFrom && dateTo) {
        const fromDate = new Date(dateFrom).toISOString().split('T')[0];
        const toDate = new Date(dateTo).toISOString().split('T')[0];
        adsInsightsUrl.searchParams.set('time_range', JSON.stringify({ since: fromDate, until: toDate }));
      } else {
        adsInsightsUrl.searchParams.set('date_preset', datePreset);
      }
      
      adsInsightsUrl.searchParams.set('access_token', accessToken);

      const adsInsightsResult = await fetchJson(adsInsightsUrl.toString(), 'Ad-level insights');
      
      if (adsInsightsResult.ok && adsInsightsResult.data.data) {
        const insightsData = adsInsightsResult.data.data;
        console.log(`✓ Fetched ${insightsData.length} ads from insights`);

        for (const row of insightsData) {
          const spend = parseFloat(row.spend || 0);
          const impressions = parseInt(row.impressions || 0);
          const clicks = parseInt(row.clicks || 0);
          
          if (spend === 0 && impressions === 0 && clicks === 0) continue;
          
          const ctr = parseFloat(row.ctr || 0);
          const cpc = parseFloat(row.cpc || 0);
          
          const actions = row.actions || [];
          const actionValues = row.action_values || [];
          
          const conversions = actions
            .filter((a: any) => a.action_type.toLowerCase().includes('purchase'))
            .reduce((sum: number, a: any) => sum + parseFloat(a.value || 0), 0);
          
          const conversionValue = actionValues
            .filter((a: any) => a.action_type.toLowerCase().includes('purchase'))
            .reduce((sum: number, a: any) => sum + parseFloat(a.value || 0), 0);
          
          const roas = spend > 0 ? (conversionValue / spend) : 0;
          const performance = categorizePerformance(ctr, cpc, roas, 'UNKNOWN', spend);

          metrics.ads.push({
            id: row.ad_id,
            name: row.ad_name || 'Unknown Ad',
            status: 'ARCHIVED/PAUSED',
            spend,
            impressions,
            clicks,
            conversions,
            conversionValue,
            ctr,
            cpc,
            roas,
            reach: parseInt(row.reach || 0),
            frequency: parseFloat(row.frequency || 0),
            performance,
            campaignName: row.campaign_name,
            adsetName: row.adset_name
          });
        }
      }
    }

    // If all metrics are zero and we used last_7d, retry with last_30d
    const allZero = metrics.totalSpend === 0 && 
                    metrics.totalImpressions === 0 && 
                    metrics.totalClicks === 0 &&
                    metrics.campaigns.length === 0 &&
                    metrics.ads.length === 0;

    if (allZero && datePreset === 'last_7d') {
      console.log('⚠️ All metrics zero with last_7d, retrying with last_30d...');
      warnings.push('No data in last 7 days, automatically retried with last 30 days');
      lastAttempt.presetUsed = 'last_30d';
      
      // Reset metrics
      metrics = {
        totalSpend: 0,
        totalImpressions: 0,
        totalClicks: 0,
        totalConversions: 0,
        totalConversionValue: 0,
        averageCTR: 0,
        averageCPC: 0,
        averageROAS: 0,
        campaigns: [],
        adSets: [],
        ads: [],
        currency: accountCurrency,
      };

      // Retry with last_30d
      const campaignsUrl30 = new URL(`https://graph.facebook.com/v19.0/${accountId}/campaigns`);
      campaignsUrl30.searchParams.set('fields', `id,name,status,objective,effective_status,daily_budget,lifetime_budget,insights.date_preset(last_30d){${INSIGHTS_FIELDS}}`);
      campaignsUrl30.searchParams.set('effective_status', '["ACTIVE","PAUSED","IN_PROCESS","WITH_ISSUES","ARCHIVED","DELETED"]');
      campaignsUrl30.searchParams.set('limit', '200');
      campaignsUrl30.searchParams.set('access_token', accessToken);
      campaignsUrl30.searchParams.set('date_preset', 'last_30d');

      const campaigns30Result = await fetchJson(campaignsUrl30.toString(), 'Campaigns fetch (30d)');

      if (campaigns30Result.ok && campaigns30Result.data.data) {
        const campaignsData = campaigns30Result.data.data;
        console.log(`✓ Fetched ${campaignsData.length} campaigns from last_30d`);

        for (const campaign of campaignsData) {
          const insightData = campaign.insights?.data?.[0] || {};
          const spend = parseFloat(insightData.spend || 0);
          const impressions = parseInt(insightData.impressions || 0);
          const clicks = parseInt(insightData.clicks || 0);
          const ctr = parseFloat(insightData.ctr || 0);
          const cpc = parseFloat(insightData.cpc || 0);
          
          const actions = insightData.actions || [];
          const actionValues = insightData.action_values || [];
          
          const purchaseAction = actions.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
            || actions.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
            || actions.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
          const conversions = purchaseAction ? parseFloat(purchaseAction.value || 0) : 0;
          
          const purchaseValueAction = actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'omni_purchase') 
            || actionValues.find((a: any) => (a.action_type || '').toLowerCase() === 'purchase') 
            || actionValues.find((a: any) => (a.action_type || '').toLowerCase().includes('purchase'));
          const conversionValue = purchaseValueAction ? parseFloat(purchaseValueAction.value || 0) : 0;
          
          // Official ROAS as reported by Meta (purchase_roas)
          let reportedROAS = 0;
          if (Array.isArray(insightData.purchase_roas) && insightData.purchase_roas.length > 0) {
            reportedROAS = parseFloat(insightData.purchase_roas[0]?.value || 0);
          } else if (typeof insightData.purchase_roas === 'object' && insightData.purchase_roas !== null) {
            reportedROAS = parseFloat(insightData.purchase_roas.value || 0);
          } else if (typeof insightData.purchase_roas === 'string' || typeof insightData.purchase_roas === 'number') {
            reportedROAS = parseFloat(insightData.purchase_roas);
          }
          console.log(`📊 Campaign ${campaign.name} (30d fallback): purchase_roas raw:`, JSON.stringify(insightData.purchase_roas), `parsed: ${reportedROAS}`);
          const calculatedROAS = spend > 0 ? (conversionValue / spend) : 0;
          console.log(`📊 Campaign ${campaign.name} (30d fallback): calculatedROAS: ${calculatedROAS}, using: ${reportedROAS || calculatedROAS}`);
          const roasToUse = reportedROAS || calculatedROAS;
          const performance = categorizePerformance(ctr, cpc, roasToUse, campaign.objective, spend);

          metrics.campaigns.push({
            id: campaign.id,
            name: campaign.name,
            status: campaign.effective_status || campaign.status,
            objective: campaign.objective,
            spend,
            impressions,
            clicks,
            conversions,
            conversionValue,
            ctr,
            cpc,
            roas: roasToUse,
            calculatedROAS,
            reportedROAS,
            reach: parseInt(insightData.reach || 0),
            frequency: parseFloat(insightData.frequency || 0),
            performance
          });

          metrics.totalSpend += spend;
          metrics.totalImpressions += impressions;
          metrics.totalClicks += clicks;
          metrics.totalConversions += conversions;
          metrics.totalConversionValue += conversionValue;
        }
      }
    }

    // Calculate averages
    if (metrics.totalImpressions > 0) {
      metrics.averageCTR = (metrics.totalClicks / metrics.totalImpressions) * 100;
    }
    if (metrics.totalClicks > 0) {
      metrics.averageCPC = metrics.totalSpend / metrics.totalClicks;
    }
    if (metrics.totalSpend > 0 && metrics.totalConversionValue > 0) {
      metrics.averageROAS = (metrics.totalConversionValue / metrics.totalSpend);
    }

    console.log(`✓ Final result: ${metrics.campaigns.length} campaigns, ${metrics.ads.length} ads`);

    return new Response(
      JSON.stringify({
        connected: true,
        metrics,
        warnings: warnings.length > 0 ? warnings : undefined,
        lastAttempt
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Fatal error:', error)
    return new Response(
      JSON.stringify({ 
        connected: false, 
        error: error.message || 'An unexpected error occurred',
        warnings: ['Server error occurred']
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
