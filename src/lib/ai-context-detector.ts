/**
 * AI Context Detector
 * Detects when students want to discuss their business metrics
 * by analyzing keywords in their messages
 */

export interface BusinessContextFlags {
  includeShopify: boolean;
  includeMetaAds: boolean;
}

const SHOPIFY_KEYWORDS = [
  'shopify',
  'sales',
  'store',
  'orders',
  'revenue',
  'products',
  'my business',
  'ecommerce',
  'customers',
  'conversions',
  'gmv',
  'aov',
  'average order',
  'top products',
  'best selling',
  'profit',
  'margin',
  'inventory',
  'bestseller',
  'cart',
  'my store',
  'my shop'
];

const META_ADS_KEYWORDS = [
  'meta',
  'ads',
  'facebook',
  'advertising',
  'campaigns',
  'roas',
  'spend',
  'ad performance',
  'impressions',
  'clicks',
  'ctr',
  'cost per',
  'ad budget',
  'instagram',
  'ig ads',
  'ad spend',
  'ad cost',
  'facebook ads',
  'meta pixel',
  'conversion rate'
];

const GENERAL_BUSINESS_KEYWORDS = [
  'analyze my',
  'study my',
  'review my',
  'check my',
  'show me my',
  'how is my',
  'how are my',
  "what's my",
  'my metrics',
  'my performance',
  'my data',
  'business performance'
];

/**
 * Check if message contains currency with numbers (e.g., "PKR 5000", "$100")
 */
function containsCurrencyWithNumber(message: string): boolean {
  const currencyPatterns = [
    /\$\s*\d+/i,           // $100 or $ 100
    /pkr\s*\d+/i,          // PKR 5000 or PKR5000
    /rs\.?\s*\d+/i,        // Rs. 5000 or Rs 5000
    /\d+\s*(?:pkr|rs)/i    // 5000 PKR or 5000 Rs
  ];
  
  return currencyPatterns.some(pattern => pattern.test(message));
}

/**
 * Detects if a message contains keywords related to business metrics
 * @param message - The user's message
 * @returns Flags indicating which contexts to include
 */
export function detectBusinessContext(message: string): BusinessContextFlags {
  const lowerMessage = message.toLowerCase().trim();
  
  // Ignore very short messages (like greetings)
  const wordCount = lowerMessage.split(/\s+/).length;
  if (wordCount < 3) {
    return { includeShopify: false, includeMetaAds: false };
  }
  
  // Check for currency mentions with numbers
  const hasCurrencyMention = containsCurrencyWithNumber(message);
  
  // Check for general business keywords that might indicate context is needed
  const hasGeneralKeywords = GENERAL_BUSINESS_KEYWORDS.some(keyword => 
    lowerMessage.includes(keyword)
  );
  
  // Check for Shopify-specific keywords
  const hasShopifyKeywords = SHOPIFY_KEYWORDS.some(keyword => {
    // Use word boundary matching to avoid false positives
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    return regex.test(lowerMessage);
  });
  
  // Check for Meta Ads-specific keywords
  const hasMetaAdsKeywords = META_ADS_KEYWORDS.some(keyword => {
    const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'i');
    return regex.test(lowerMessage);
  });
  
  // Determine flags based on keywords
  const shopifyFlag = hasShopifyKeywords || (hasGeneralKeywords && hasCurrencyMention);
  const metaFlag = hasMetaAdsKeywords || (hasGeneralKeywords && !hasCurrencyMention);
  
  if (import.meta.env.DEV) {
    console.log('[AI Context Detector]', {
      message: lowerMessage,
      wordCount,
      hasCurrencyMention,
      hasGeneralKeywords,
      hasShopifyKeywords,
      hasMetaAdsKeywords,
      flags: { includeShopify: shopifyFlag, includeMetaAds: metaFlag }
    });
  }
  
  return {
    includeShopify: shopifyFlag,
    includeMetaAds: metaFlag
  };
}

/**
 * Get a user-friendly description of what context will be fetched
 * @param flags - Context flags
 * @returns Human-readable description
 */
export function getContextDescription(flags: BusinessContextFlags): string {
  if (flags.includeShopify && flags.includeMetaAds) {
    return 'Analyzing your Shopify and Meta Ads data...';
  } else if (flags.includeShopify) {
    return 'Analyzing your Shopify data...';
  } else if (flags.includeMetaAds) {
    return 'Analyzing your Meta Ads data...';
  }
  return '';
}
