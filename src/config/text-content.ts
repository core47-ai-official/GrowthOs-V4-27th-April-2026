import { ENV_CONFIG } from '@/lib/env-config';

// Text content configuration
export const TEXT_CONTENT = {
  // Authentication & Welcome
  WELCOME_MESSAGE: ENV_CONFIG.APP_WELCOME_MESSAGE,
  SIGN_IN_BUTTON: ENV_CONFIG.SIGN_IN_BUTTON_TEXT,
  
  // Status Messages
  LOADING: "Loading...",
  SAVING: "Saving...",
  SUBMITTING: "Submitting...",
  PROCESSING: "Processing...",
  
  // Success Messages
  SUCCESS_GENERIC: ENV_CONFIG.SUCCESS_MESSAGE,
  SUCCESS_SAVED: "Settings saved successfully",
  SUCCESS_CONNECTED: "Account connected successfully",
  SUCCESS_DISCONNECTED: "Account disconnected successfully",
  SUCCESS_SUBMITTED: "Submission completed successfully",
  
  // Error Messages
  ERROR_GENERIC: ENV_CONFIG.GENERIC_ERROR_MESSAGE,
  ERROR_CONNECTION: ENV_CONFIG.CONNECTION_ERROR_MESSAGE,
  ERROR_UNAUTHORIZED: "You are not authorized to perform this action",
  ERROR_VALIDATION: "Please check your input and try again",
  ERROR_TIMEOUT: "Request timed out. Please try again.",
  ERROR_NETWORK: "Network error. Please check your connection.",
  
  // Form Placeholders
  PLACEHOLDER_EMAIL: "Enter your email address",
  PLACEHOLDER_PASSWORD: "Enter your password",
  PLACEHOLDER_SHOPIFY_DOMAIN: ENV_CONFIG.SHOPIFY_PLACEHOLDER,
  PLACEHOLDER_COMPANY_NAME: "Enter company name",
  PLACEHOLDER_PHONE: "Enter phone number",
  
  // Action Buttons
  BUTTON_SAVE: "Save",
  BUTTON_CANCEL: "Cancel",
  BUTTON_SUBMIT: "Submit",
  BUTTON_CONNECT: "Connect",
  BUTTON_DISCONNECT: "Disconnect",
  BUTTON_RETRY: "Retry",
  BUTTON_CONTINUE: "Continue",
  
  // Navigation & Status
  STATUS_COMPLETED: "Completed",
  STATUS_PENDING: "Pending",
  STATUS_APPROVED: "Approved",
  STATUS_REJECTED: "Rejected",
  STATUS_LOCKED: "Locked",
  
  // Video/Learning Content
  WATCH_NOW: "Watch Now",
  WATCH_AGAIN: "Watch Again",
  LESSON_LOCKED: "Locked",
  LESSON_COMPLETED: "Completed",
  
  // Validation Messages
  REQUIRED_FIELD: "This field is required",
  INVALID_EMAIL: "Please enter a valid email address",
  INVALID_DOMAIN: "Please enter a valid domain",
  TOKEN_REQUIRED: "Access token is required",
} as const;

// Domain patterns configuration
export const DOMAIN_CONFIG = {
  SHOPIFY_SUFFIX: ENV_CONFIG.SHOPIFY_DOMAIN_SUFFIX,
  SHOPIFY_PATTERN: new RegExp(ENV_CONFIG.SHOPIFY_DOMAIN_PATTERN),
  BLOCKED_DOMAINS: ENV_CONFIG.BLOCKED_DOMAINS.split(','),
  
  // Helper functions
  isBlockedDomain: (url: string) => {
    return DOMAIN_CONFIG.BLOCKED_DOMAINS.some(domain => url.includes(domain.trim()));
  },
  
  isValidShopifyDomain: (domain: string) => {
    return DOMAIN_CONFIG.SHOPIFY_PATTERN.test(domain);
  },
  
  normalizeShopifyDomain: (domain: string) => {
    let normalized = domain.toLowerCase().trim();
    if (!normalized.includes('.')) {
      normalized += DOMAIN_CONFIG.SHOPIFY_SUFFIX;
    }
    return normalized;
  }
} as const;

// Test data configuration (only used in development)
export const TEST_DATA = {
  ADMIN_EMAIL: ENV_CONFIG.TEST_ADMIN_EMAIL,
  MENTOR_EMAIL: ENV_CONFIG.TEST_MENTOR_EMAIL,
  STUDENT_EMAIL: ENV_CONFIG.TEST_STUDENT_EMAIL,
  PASSWORD: ENV_CONFIG.TEST_PASSWORD,
  
  // Sample users for development
  SAMPLE_USERS: [
    {
      email: ENV_CONFIG.TEST_ADMIN_EMAIL,
      password: ENV_CONFIG.TEST_PASSWORD,
      role: 'superadmin',
      name: 'Test Admin'
    },
    {
      email: ENV_CONFIG.TEST_MENTOR_EMAIL,
      password: ENV_CONFIG.TEST_PASSWORD,
      role: 'mentor',
      name: 'Test Mentor'
    },
    {
      email: ENV_CONFIG.TEST_STUDENT_EMAIL,
      password: ENV_CONFIG.TEST_PASSWORD,
      role: 'student',
      name: 'Test Student'
    }
  ]
} as const;