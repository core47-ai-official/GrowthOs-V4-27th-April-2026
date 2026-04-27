// UI Constants configuration - now fully configurable via environment variables
import { ENV_CONFIG } from '@/lib/env-config';

export const UI_CONSTANTS = {
  // Animation Durations (in milliseconds)
  ANIMATION_FAST: ENV_CONFIG.ANIMATION_FAST_MS,
  ANIMATION_NORMAL: ENV_CONFIG.ANIMATION_NORMAL_MS,
  ANIMATION_SLOW: ENV_CONFIG.ANIMATION_SLOW_MS,
  ANIMATION_EXTRA_SLOW: ENV_CONFIG.ANIMATION_EXTRA_SLOW_MS,
  
  // Timeout Values
  DEFAULT_TIMEOUT: ENV_CONFIG.DEFAULT_TIMEOUT_MS,
  SHORT_TIMEOUT: ENV_CONFIG.SHORT_TIMEOUT_MS,
  LONG_TIMEOUT: ENV_CONFIG.LONG_TIMEOUT_MS,
  
  // Cache and Stale Times
  CACHE_TIME: ENV_CONFIG.CACHE_TIME_MS,
  STALE_TIME: ENV_CONFIG.STALE_TIME_MS,
  SETTINGS_STALE_TIME: ENV_CONFIG.SETTINGS_STALE_TIME_MS,
  
  // Debounce Delays
  SEARCH_DEBOUNCE: ENV_CONFIG.SEARCH_DEBOUNCE_MS,
  INPUT_DEBOUNCE: ENV_CONFIG.INPUT_DEBOUNCE_MS,
  RESIZE_DEBOUNCE: ENV_CONFIG.RESIZE_DEBOUNCE_MS,
  
  // Notification Display Times
  NOTIFICATION_DURATION: ENV_CONFIG.NOTIFICATION_DURATION_MS,
  SUCCESS_TOAST_DURATION: ENV_CONFIG.SUCCESS_TOAST_DURATION_MS,
  ERROR_TOAST_DURATION: ENV_CONFIG.ERROR_TOAST_DURATION_MS,
  
  // Pagination and Limits
  DEFAULT_PAGE_SIZE: ENV_CONFIG.DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE: ENV_CONFIG.MAX_PAGE_SIZE,
  INFINITE_SCROLL_THRESHOLD: ENV_CONFIG.INFINITE_SCROLL_THRESHOLD,
  
  // Progress and Scoring
  MILESTONE_THRESHOLDS: {
    BRONZE: ENV_CONFIG.MILESTONE_BRONZE,
    SILVER: ENV_CONFIG.MILESTONE_SILVER,
    GOLD: ENV_CONFIG.MILESTONE_GOLD,
    PLATINUM: ENV_CONFIG.MILESTONE_PLATINUM
  },
  
  // UI Breakpoints (matches Tailwind)
  BREAKPOINTS: {
    SM: 640,
    MD: 768,
    LG: 1024,
    XL: 1280,
    '2XL': 1536
  },
  
  // Common Sizes
  SIZES: {
    AVATAR_SM: 'h-8 w-8',
    AVATAR_MD: 'h-12 w-12',
    AVATAR_LG: 'h-16 w-16',
    BUTTON_SM: 'px-3 py-1.5 text-sm',
    BUTTON_MD: 'px-4 py-2',
    BUTTON_LG: 'px-6 py-3 text-lg',
    LOGO_SM: 'h-8 w-auto',
    LOGO_MD: 'h-12 w-auto',
    LOGO_LG: 'h-16 w-auto max-w-[240px]'
  },
  
  // Z-Index Layers
  Z_INDEX: {
    DROPDOWN: 50,
    MODAL: 100,
    TOOLTIP: 200,
    NOTIFICATION: 300
  }
} as const;

// Utility functions for UI constants
export const getAnimationClass = (speed: 'fast' | 'normal' | 'slow' | 'extra-slow') => {
  const durations = {
    fast: 'duration-200',
    normal: 'duration-300', 
    slow: 'duration-500',
    'extra-slow': 'duration-1000'
  };
  return durations[speed];
};

export const getTimeoutValue = (type: 'short' | 'default' | 'long') => {
  const timeouts = {
    short: UI_CONSTANTS.SHORT_TIMEOUT,
    default: UI_CONSTANTS.DEFAULT_TIMEOUT,
    long: UI_CONSTANTS.LONG_TIMEOUT
  };
  return timeouts[type];
};

export const getMilestoneLevel = (points: number) => {
  const { MILESTONE_THRESHOLDS } = UI_CONSTANTS;
  if (points >= MILESTONE_THRESHOLDS.PLATINUM) return 'PLATINUM';
  if (points >= MILESTONE_THRESHOLDS.GOLD) return 'GOLD';
  if (points >= MILESTONE_THRESHOLDS.SILVER) return 'SILVER';
  if (points >= MILESTONE_THRESHOLDS.BRONZE) return 'BRONZE';
  return 'BEGINNER';
};