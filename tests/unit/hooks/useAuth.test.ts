/**
 * Unit tests for useAuth hook
 * Tests authentication flow, user profile fetching, and error handling
 */

import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// Mock external dependencies
vi.mock('@/integrations/supabase/client');
vi.mock('@/lib/logger');

const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signOut: vi.fn()
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn()
      }))
    })),
    update: vi.fn(() => ({
      eq: vi.fn()
    }))
  }))
};

(supabase as any) = mockSupabase;

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful session response
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    });
    
    // Mock auth state change subscription
    mockSupabase.auth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBe(null);
  });

  it('should handle no session case', async () => {
    const { result } = renderHook(() => useAuth());
    
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    
    expect(result.current.user).toBe(null);
  });

  it('should fetch user profile when session exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'student',
      full_name: 'Test User'
    };

    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' }
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
      data: mockUser,
      error: null
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
  });

  it('should handle database errors gracefully', async () => {
    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' }
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'Database error' }
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should create fallback user from session data
    expect(result.current.user).toEqual({
      id: 'user-123',
      email: 'test@example.com',
      role: 'student',
      full_name: 'test@example.com'
    });

    expect(logger.error).toHaveBeenCalledWith(
      'fetchUserProfile: Database error',
      { message: 'Database error' }
    );
  });

  it('should handle auth state changes', async () => {
    let authCallback: Function;
    
    mockSupabase.auth.onAuthStateChange.mockImplementation((callback) => {
      authCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    const { result } = renderHook(() => useAuth());

    // Simulate sign out
    authCallback('SIGNED_OUT', null);

    await waitFor(() => {
      expect(result.current.user).toBe(null);
      expect(result.current.loading).toBe(false);
    });
  });

  it('should debounce duplicate profile fetch calls', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'student'
    };

    const mockSession = {
      user: { id: 'user-123', email: 'test@example.com' }
    };

    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: mockSession },
      error: null
    });

    mockSupabase.from().select().eq().maybeSingle.mockResolvedValue({
      data: mockUser,
      error: null
    });

    const { result } = renderHook(() => useAuth());

    // Call refreshUser multiple times quickly
    result.current.refreshUser?.();
    result.current.refreshUser?.();
    result.current.refreshUser?.();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Should only make one database call due to debouncing
    expect(mockSupabase.from().select().eq().maybeSingle).toHaveBeenCalledTimes(1);
  });

  it('should provide role checking utilities', () => {
    const { result } = renderHook(() => useAuth());

    // Test hasRole function with no user
    expect(result.current.hasRole('admin')).toBe(false);
    expect(result.current.hasRole(['admin', 'mentor'])).toBe(false);

    // Test canAccessLMS with no user
    expect(result.current.canAccessLMS()).toBe(false);
  });

  it('should handle sign out', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({});

    const { result } = renderHook(() => useAuth());

    await result.current.signOut();

    expect(mockSupabase.auth.signOut).toHaveBeenCalled();
    expect(result.current.user).toBe(null);
  });

  it('should track user activity when user exists', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      role: 'student'
    };

    // Mock successful update
    mockSupabase.from().update().eq.mockResolvedValue({
      data: null,
      error: null
    });

    const { result, rerender } = renderHook(() => useAuth());

    // Simulate user being set
    (result.current as any).setUser = vi.fn();
    
    // Manually trigger the effect by changing user
    Object.defineProperty(result.current, 'user', {
      value: mockUser,
      writable: true
    });

    rerender();

    // Wait for activity tracking to be set up
    await waitFor(() => {
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
    });
  });
});