import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { shopifyDomain, apiKey } = await req.json()
    
    if (!shopifyDomain || !apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing shopifyDomain or apiKey' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Handle custom domains - Admin API always uses myshopify.com format
    let adminDomain = shopifyDomain;
    if (!shopifyDomain.includes('myshopify.com')) {
      // For custom domains, we need to try the API endpoint directly
      // If it fails, we'll ask the user for their myshopify.com domain
      adminDomain = shopifyDomain;
    }

    // Try to validate using the provided domain first
    let shopifyApiUrl = `https://${adminDomain}/admin/api/2024-07/shop.json`;
    
    const response = await fetch(shopifyApiUrl, {
      headers: {
        'X-Shopify-Access-Token': apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ 
          error: `Shopify API returned status ${response.status}`,
          valid: false 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    const shopData = await response.json()
    
    return new Response(
      JSON.stringify({ 
        valid: true, 
        shopName: shopData.shop?.name || shopifyDomain 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Error validating Shopify:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to validate Shopify connection',
        valid: false 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})