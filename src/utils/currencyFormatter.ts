import { ENV_CONFIG } from '@/lib/env-config';

/**
 * Currency formatting utility
 * Supports configurable currency via environment variables
 */

export interface CurrencyConfig {
  code: string;
  symbol: string;
  position: 'before' | 'after';
  decimals: number;
  thousandsSeparator: string;
  decimalSeparator: string;
}

const CURRENCY_CONFIGS: Record<string, CurrencyConfig> = {
  PKR: {
    code: 'PKR',
    symbol: 'Rs',
    position: 'before',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  USD: {
    code: 'USD',
    symbol: '$',
    position: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  EUR: {
    code: 'EUR',
    symbol: '€',
    position: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  GBP: {
    code: 'GBP',
    symbol: '£',
    position: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  INR: {
    code: 'INR',
    symbol: '₹',
    position: 'before',
    decimals: 0,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  CAD: {
    code: 'CAD',
    symbol: 'C$',
    position: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
  AUD: {
    code: 'AUD',
    symbol: 'A$',
    position: 'before',
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  },
};

/**
 * Get currency configuration from environment or defaults
 */
export function getCurrencyConfig(currencyCode?: string): CurrencyConfig {
  const code = currencyCode || ENV_CONFIG.DEFAULT_CURRENCY;
  
  // If we have a predefined config, use it
  if (CURRENCY_CONFIGS[code]) {
    return CURRENCY_CONFIGS[code];
  }
  
  // Otherwise, create a custom config based on env variables
  return {
    code,
    symbol: ENV_CONFIG.CURRENCY_SYMBOL,
    position: 'before',
    decimals: code === 'PKR' || code === 'INR' ? 0 : 2,
    thousandsSeparator: ',',
    decimalSeparator: '.',
  };
}

/**
 * Format number with thousands separators
 */
function formatNumber(
  value: number,
  decimals: number,
  thousandsSeparator: string,
  decimalSeparator: string
): string {
  const fixedValue = value.toFixed(decimals);
  const [integerPart, decimalPart] = fixedValue.split('.');
  
  // Add thousands separator
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
  
  // Return with decimal part if needed
  if (decimals > 0 && decimalPart) {
    return `${formattedInteger}${decimalSeparator}${decimalPart}`;
  }
  
  return formattedInteger;
}

/**
 * Format currency value
 */
export function formatCurrency(
  amount: number | string | null | undefined,
  currencyCode?: string,
  options?: {
    showSymbol?: boolean;
    showCode?: boolean;
  }
): string {
  const { showSymbol = true, showCode = false } = options || {};
  
  // Handle null/undefined
  if (amount === null || amount === undefined) {
    return showSymbol ? `${getCurrencyConfig(currencyCode).symbol}0` : '0';
  }
  
  // Convert to number
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // Handle invalid numbers
  if (isNaN(numericAmount)) {
    return showSymbol ? `${getCurrencyConfig(currencyCode).symbol}0` : '0';
  }
  
  const config = getCurrencyConfig(currencyCode);
  const formattedNumber = formatNumber(
    numericAmount,
    config.decimals,
    config.thousandsSeparator,
    config.decimalSeparator
  );
  
  // Build the final string
  let result = formattedNumber;
  
  if (showSymbol) {
    result = config.position === 'before'
      ? `${config.symbol} ${formattedNumber}`
      : `${formattedNumber} ${config.symbol}`;
  }
  
  if (showCode) {
    result = `${result} ${config.code}`;
  }
  
  return result;
}

/**
 * Get currency symbol only
 */
export function getCurrencySymbol(currencyCode?: string): string {
  return getCurrencyConfig(currencyCode).symbol;
}

/**
 * Extract currency from business context or fall back to default
 */
export function getContextCurrency(businessContext?: any): string {
  // Try Meta Ads currency first
  if (businessContext?.metaAds?.metrics?.currency) {
    return businessContext.metaAds.metrics.currency;
  }
  
  // Try Shopify currency (if we add it in the future)
  if (businessContext?.shopify?.metrics?.currency) {
    return businessContext.shopify.metrics.currency;
  }
  
  // Fall back to app default
  return ENV_CONFIG.DEFAULT_CURRENCY;
}

/**
 * Parse currency string to number
 */
export function parseCurrency(value: string): number {
  // Remove all non-numeric characters except decimal point
  const cleaned = value.replace(/[^\d.]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Format for input fields (no symbol, for editing)
 */
export function formatCurrencyInput(
  amount: number | string | null | undefined,
  currencyCode?: string
): string {
  return formatCurrency(amount, currencyCode, { showSymbol: false });
}
