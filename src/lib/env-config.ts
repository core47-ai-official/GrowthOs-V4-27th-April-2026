// Environment configuration with fallbacks
export const ENV_CONFIG = {
  // Supabase Configuration - REQUIRED (no fallbacks for security)
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  SUPABASE_PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,

  // Application Branding
  APP_TITLE: import.meta.env.VITE_APP_TITLE || "Growth OS - AI-Powered Learning Platform",
  APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION || "Growth OS by IDM Pakistan - AI-powered LMS for e-commerce success",
  APP_AUTHOR: import.meta.env.VITE_APP_AUTHOR || "IDM Pakistan",
  COMPANY_NAME: import.meta.env.VITE_COMPANY_NAME || "IDM Pakistan",
  TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE || "@core47ai",
  FAVICON_PATH: import.meta.env.VITE_FAVICON_PATH || "/favicon.ico",

  // Site Configuration
  SITE_URL: import.meta.env.VITE_SITE_URL || "https://majqoqagohicjigmsilu.lovable.app",

  // Company Defaults
  DEFAULT_COMPANY_NAME: import.meta.env.VITE_DEFAULT_COMPANY_NAME || "Your Company",
  DEFAULT_CURRENCY: import.meta.env.VITE_DEFAULT_CURRENCY || "PKR",
  CURRENCY_SYMBOL: import.meta.env.VITE_CURRENCY_SYMBOL || "Rs",
  DEFAULT_FEE_AMOUNT: parseFloat(import.meta.env.VITE_DEFAULT_FEE_AMOUNT || "3000"),
  DEFAULT_MAX_INSTALLMENTS: parseInt(import.meta.env.VITE_DEFAULT_MAX_INSTALLMENTS || "3"),
  DEFAULT_LMS_URL: import.meta.env.VITE_DEFAULT_LMS_URL || "https://growthos.core47.ai",
  DEFAULT_INVOICE_OVERDUE_DAYS: parseInt(import.meta.env.VITE_DEFAULT_INVOICE_OVERDUE_DAYS || "30"),
  DEFAULT_INVOICE_SEND_GAP_DAYS: parseInt(import.meta.env.VITE_DEFAULT_INVOICE_SEND_GAP_DAYS || "7"),
  DEFAULT_RECOVERY_RATE: parseFloat(import.meta.env.VITE_DEFAULT_RECOVERY_RATE || "85"),

  // Development Server Configuration
  DEV_PORT: parseInt(import.meta.env.VITE_DEV_PORT || "8080"),
  DEV_HOST: import.meta.env.VITE_DEV_HOST || "::",

  // Success Partner Configuration
  SUCCESS_PARTNER_DAILY_LIMIT: parseInt(import.meta.env.VITE_SUCCESS_PARTNER_DAILY_LIMIT || "10"),
  SUCCESS_PARTNER_WEBHOOK_URL: import.meta.env.VITE_SUCCESS_PARTNER_WEBHOOK_URL || "https://n8n.core47.ai/webhook/SuccessPartner",
  SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS: parseInt(import.meta.env.VITE_SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS || "7"),
  META_ADS_MAX_DATE_RANGE_DAYS: parseInt(import.meta.env.VITE_META_ADS_MAX_DATE_RANGE_DAYS || "90"),
  SHOPIFY_MAX_DATE_RANGE_DAYS: parseInt(import.meta.env.VITE_SHOPIFY_MAX_DATE_RANGE_DAYS || "90"),

  // Support Contact Information
  SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || "support@growthos.core47.ai",
  SUPPORT_PHONE: import.meta.env.VITE_SUPPORT_PHONE || "+92 300 1234567",
  SUPPORT_WHATSAPP: import.meta.env.VITE_SUPPORT_WHATSAPP || "+923001234567",
  SUPPORT_ADDRESS: import.meta.env.VITE_SUPPORT_ADDRESS || "Islamabad, Pakistan",

  // External Service URLs
  WHATSAPP_API_URL: import.meta.env.VITE_WHATSAPP_API_URL || "https://api.whatsapp.com",
  N8N_WEBHOOK_BASE: import.meta.env.VITE_N8N_WEBHOOK_BASE || "https://n8n.core47.ai/webhook",
  SHOPIFY_APP_URL: import.meta.env.VITE_SHOPIFY_APP_URL || "https://shopify.core47.ai",
  
  // Email Configuration
  FROM_EMAIL: import.meta.env.VITE_FROM_EMAIL || "noreply@growthos.core47.ai",
  FROM_NAME: import.meta.env.VITE_FROM_NAME || "Growth OS",
  REPLY_TO_EMAIL: import.meta.env.VITE_REPLY_TO_EMAIL || "support@growthos.core47.ai",

  // Business Rules
  DEFAULT_ASSIGNMENT_DEADLINE_DAYS: parseInt(import.meta.env.VITE_DEFAULT_ASSIGNMENT_DEADLINE_DAYS || "7"),
  DEFAULT_SESSION_DURATION_MINUTES: parseInt(import.meta.env.VITE_DEFAULT_SESSION_DURATION_MINUTES || "60"),
  MINIMUM_PASSWORD_LENGTH: parseInt(import.meta.env.VITE_MINIMUM_PASSWORD_LENGTH || "8"),
  
  // Notification Defaults
  INACTIVE_STUDENT_THRESHOLD_DAYS: parseInt(import.meta.env.VITE_INACTIVE_STUDENT_THRESHOLD_DAYS || "3"),
  PAYMENT_REMINDER_DAYS_BEFORE: parseInt(import.meta.env.VITE_PAYMENT_REMINDER_DAYS_BEFORE || "3"),

  // Domain & URL Patterns
  SHOPIFY_DOMAIN_SUFFIX: import.meta.env.VITE_SHOPIFY_DOMAIN_SUFFIX || ".myshopify.com",
  SHOPIFY_DOMAIN_PATTERN: import.meta.env.VITE_SHOPIFY_DOMAIN_PATTERN || "^[a-z0-9-]+\\.myshopify\\.com$",
  BLOCKED_DOMAINS: import.meta.env.VITE_BLOCKED_DOMAINS || "growthos.core47.ai,core47.ai",
  
  // Test Data Configuration
  TEST_ADMIN_EMAIL: import.meta.env.VITE_TEST_ADMIN_EMAIL || "admin@testcompany.com",
  TEST_MENTOR_EMAIL: import.meta.env.VITE_TEST_MENTOR_EMAIL || "mentor@testcompany.com", 
  TEST_STUDENT_EMAIL: import.meta.env.VITE_TEST_STUDENT_EMAIL || "student@testcompany.com",
  TEST_PASSWORD: import.meta.env.VITE_TEST_PASSWORD || "testpassword123",
  
  // UI Text Content
  APP_WELCOME_MESSAGE: import.meta.env.VITE_APP_WELCOME_MESSAGE || "Welcome to Growth OS",
  SIGN_IN_BUTTON_TEXT: import.meta.env.VITE_SIGN_IN_BUTTON_TEXT || "Sign In to Growth OS",
  SHOPIFY_PLACEHOLDER: import.meta.env.VITE_SHOPIFY_PLACEHOLDER || "yourstore.myshopify.com",
  
  // Error Messages
  GENERIC_ERROR_MESSAGE: import.meta.env.VITE_GENERIC_ERROR_MESSAGE || "An error occurred. Please try again.",
  CONNECTION_ERROR_MESSAGE: import.meta.env.VITE_CONNECTION_ERROR_MESSAGE || "Connection failed. Please check your details and try again.",
  SUCCESS_MESSAGE: import.meta.env.VITE_SUCCESS_MESSAGE || "Operation completed successfully",

  // Feature Flags
  ENABLE_CONSOLE_LOGGING: import.meta.env.VITE_ENABLE_CONSOLE_LOGGING === 'true' || import.meta.env.MODE === 'development',
  ENHANCED_ERROR_HANDLING: import.meta.env.VITE_ENHANCED_ERROR_HANDLING !== 'false',
  SAFE_DATABASE_QUERIES: import.meta.env.VITE_SAFE_DATABASE_QUERIES !== 'false',
  TYPE_SAFETY_IMPROVEMENTS: import.meta.env.VITE_TYPE_SAFETY_IMPROVEMENTS !== 'false',
  LMS_SEQUENTIAL_UNLOCK: import.meta.env.VITE_LMS_SEQUENTIAL_UNLOCK === 'true',
  MIGRATE_SINGLE_QUERIES: import.meta.env.VITE_MIGRATE_SINGLE_QUERIES === 'true',
  ENABLE_DATABASE_ERROR_BOUNDARIES: import.meta.env.VITE_ENABLE_DATABASE_ERROR_BOUNDARIES === 'true',
  SAFE_QUERY_FALLBACKS: import.meta.env.VITE_SAFE_QUERY_FALLBACKS === 'true',
  MIGRATE_CONSOLE_LOGS: import.meta.env.VITE_MIGRATE_CONSOLE_LOGS === 'true',
  PRESERVE_DEBUG_LOGS: import.meta.env.VITE_PRESERVE_DEBUG_LOGS !== 'false',
  REPLACE_WINDOW_RELOAD: import.meta.env.VITE_REPLACE_WINDOW_RELOAD === 'true',
  ENABLE_REAL_RECOVERY_RATE: import.meta.env.VITE_ENABLE_REAL_RECOVERY_RATE === 'true',
  OPTIMIZE_DATABASE_QUERIES: import.meta.env.VITE_OPTIMIZE_DATABASE_QUERIES === 'true',
  ENHANCED_LOADING_STATES: import.meta.env.VITE_ENHANCED_LOADING_STATES === 'true',
  STRICT_TYPE_CHECKING: import.meta.env.VITE_STRICT_TYPE_CHECKING === 'true',
  RUNTIME_TYPE_VALIDATION: import.meta.env.VITE_RUNTIME_TYPE_VALIDATION === 'true',

  // Performance & UI Thresholds
  STUDENT_SCORE_THRESHOLD: parseFloat(import.meta.env.VITE_STUDENT_SCORE_THRESHOLD || "85"),
  SEARCH_DEBOUNCE_MS: parseInt(import.meta.env.VITE_SEARCH_DEBOUNCE_MS || "300"),
  INPUT_DEBOUNCE_MS: parseInt(import.meta.env.VITE_INPUT_DEBOUNCE_MS || "500"),
  RESIZE_DEBOUNCE_MS: parseInt(import.meta.env.VITE_RESIZE_DEBOUNCE_MS || "150"),
  NOTIFICATION_DURATION_MS: parseInt(import.meta.env.VITE_NOTIFICATION_DURATION_MS || "5000"),
  SUCCESS_TOAST_DURATION_MS: parseInt(import.meta.env.VITE_SUCCESS_TOAST_DURATION_MS || "3000"),
  ERROR_TOAST_DURATION_MS: parseInt(import.meta.env.VITE_ERROR_TOAST_DURATION_MS || "5000"),
  ANIMATION_FAST_MS: parseInt(import.meta.env.VITE_ANIMATION_FAST_MS || "200"),
  ANIMATION_NORMAL_MS: parseInt(import.meta.env.VITE_ANIMATION_NORMAL_MS || "300"),
  ANIMATION_SLOW_MS: parseInt(import.meta.env.VITE_ANIMATION_SLOW_MS || "500"),
  ANIMATION_EXTRA_SLOW_MS: parseInt(import.meta.env.VITE_ANIMATION_EXTRA_SLOW_MS || "1000"),
  
  // Pagination & Limits
  DEFAULT_PAGE_SIZE: parseInt(import.meta.env.VITE_DEFAULT_PAGE_SIZE || "10"),
  MAX_PAGE_SIZE: parseInt(import.meta.env.VITE_MAX_PAGE_SIZE || "100"),
  INFINITE_SCROLL_THRESHOLD: parseInt(import.meta.env.VITE_INFINITE_SCROLL_THRESHOLD || "2"),
  
  // Cache & Timeout Values
  CACHE_TIME_MS: parseInt(import.meta.env.VITE_CACHE_TIME_MS || "300000"), // 5 minutes
  STALE_TIME_MS: parseInt(import.meta.env.VITE_STALE_TIME_MS || "30000"), // 30 seconds
  SETTINGS_STALE_TIME_MS: parseInt(import.meta.env.VITE_SETTINGS_STALE_TIME_MS || "300000"), // 5 minutes
  DEFAULT_TIMEOUT_MS: parseInt(import.meta.env.VITE_DEFAULT_TIMEOUT_MS || "30000"), // 30 seconds
  SHORT_TIMEOUT_MS: parseInt(import.meta.env.VITE_SHORT_TIMEOUT_MS || "5000"), // 5 seconds
  LONG_TIMEOUT_MS: parseInt(import.meta.env.VITE_LONG_TIMEOUT_MS || "60000"), // 60 seconds
  
  // Milestone Thresholds
  MILESTONE_BRONZE: parseInt(import.meta.env.VITE_MILESTONE_BRONZE || "500"),
  MILESTONE_SILVER: parseInt(import.meta.env.VITE_MILESTONE_SILVER || "1000"),
  MILESTONE_GOLD: parseInt(import.meta.env.VITE_MILESTONE_GOLD || "1500"),
  MILESTONE_PLATINUM: parseInt(import.meta.env.VITE_MILESTONE_PLATINUM || "2000"),

  // Validation & Security
  SESSION_TIMEOUT_MINUTES: parseInt(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES || "30"),
  MAX_LOGIN_ATTEMPTS: parseInt(import.meta.env.VITE_MAX_LOGIN_ATTEMPTS || "5"),
  PASSWORD_RESET_TIMEOUT_HOURS: parseInt(import.meta.env.VITE_PASSWORD_RESET_TIMEOUT_HOURS || "24"),
} as const;

// Validation function - Throws error if required env vars missing
export function validateEnvironment(): boolean {
  const required = [
    { key: 'SUPABASE_URL', envVar: 'VITE_SUPABASE_URL' },
    { key: 'SUPABASE_ANON_KEY', envVar: 'VITE_SUPABASE_PUBLISHABLE_KEY' },
    { key: 'SUPABASE_PROJECT_ID', envVar: 'VITE_SUPABASE_PROJECT_ID' }
  ] as const;

  const missing = required.filter(({ key }) => !ENV_CONFIG[key]);
  
  if (missing.length > 0) {
    const errorMsg = `❌ CRITICAL: Missing required environment variables: ${missing.map(m => m.key).join(', ')}\n\n` +
      `Please create a .env file with these variables. See .env.example for reference.\n\n` +
      `Required variables:\n${missing.map(m => `  - ${m.envVar}`).join('\n')}`;
    
    throw new Error(errorMsg);
  }

  return true;
}