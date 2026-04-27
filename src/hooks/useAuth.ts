import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@/types/common';
import { logger } from '@/lib/logger';

// Module-level throttle to prevent duplicate activity updates when `useAuth`
// is mounted in multiple places (or when events fire rapidly).
const lastActiveSentAtByUser = new Map<string, number>();
const lastActiveInFlightByUser = new Map<string, boolean>();
const LAST_ACTIVE_THROTTLE_MS = 10_000; // 10s: enough to avoid bursts; still keeps activity fresh.

// Re-export User type for backwards compatibility
export type { User };

interface AuthSession {
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  access_token?: string;
  refresh_token?: string;
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<AuthSession | null>(null);
  const sessionRef = useRef<AuthSession | null>(null);

  // Keep sessionRef in sync
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // Update user activity timestamp
  const updateLastActive = async (userId: string) => {
    try {
      const now = Date.now();
      const lastSentAt = lastActiveSentAtByUser.get(userId) ?? 0;
      const inFlight = lastActiveInFlightByUser.get(userId) ?? false;

      // Avoid duplicate PATCH bursts across multiple hook instances.
      if (inFlight || now - lastSentAt < LAST_ACTIVE_THROTTLE_MS) return;

      lastActiveInFlightByUser.set(userId, true);
      await supabase
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', userId);

      lastActiveSentAtByUser.set(userId, now);
    } catch (error) {
      // Log technical details only - don't show user error for activity updates
      logger.error('Error updating last active', error);
    } finally {
      lastActiveInFlightByUser.set(userId, false);
    }
  };

// Set up activity tracking (with throttling + visibility-aware)
useEffect(() => {
  if (!user?.id) return;

  const lastActivityRef = { current: 0 } as { current: number };
  const touch = () => { lastActivityRef.current = Date.now(); };

  // Update activity immediately if visible
  if (document.visibilityState === 'visible') {
    updateLastActive(user.id);
    touch();
  }

  let activityInterval: ReturnType<typeof setInterval> | null = null;
  const startInterval = () => {
    if (activityInterval) return;
    activityInterval = setInterval(() => {
      if (document.visibilityState !== 'visible') return; // skip when hidden
      updateLastActive(user.id);
      touch();
    }, 2 * 60 * 1000); // 2 minutes
  };
  const stopInterval = () => {
    if (activityInterval) {
      clearInterval(activityInterval);
      activityInterval = null;
    }
  };
  startInterval();

  // Update activity on user interactions (throttled to 60s)
  const handleUserActivity = () => {
    const now = Date.now();
    if (now - lastActivityRef.current > 60 * 1000) {
      updateLastActive(user.id);
      touch();
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      updateLastActive(user.id);
      touch();
      startInterval();
    } else {
      stopInterval();
    }
  };

  // Listen for user activity
  document.addEventListener('mousedown', handleUserActivity);
  document.addEventListener('keydown', handleUserActivity);
  document.addEventListener('scroll', handleUserActivity);
  document.addEventListener('touchstart', handleUserActivity);
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    stopInterval();
    document.removeEventListener('mousedown', handleUserActivity);
    document.removeEventListener('keydown', handleUserActivity);
    document.removeEventListener('scroll', handleUserActivity);
    document.removeEventListener('touchstart', handleUserActivity);
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [user?.id]);

  useEffect(() => {
    logger.debug('useAuth: Starting authentication check');
    setLoading(true);
    
    // Get initial session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      logger.debug('useAuth: Initial session check', { session: !!session, error });
      
      // Handle auth errors gracefully
      if (error) {
        logger.warn('useAuth: Session error, clearing state', error);
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session as AuthSession);
      if (session?.user) {
        fetchUserProfile(session.user.id);
      } else {
        logger.debug('useAuth: No session found, setting loading to false');
        setLoading(false);
      }
    }).catch(err => {
      logger.error('useAuth: Error getting initial session', err);
      // Clear state on initialization errors
      setSession(null);
      setUser(null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('useAuth: Auth state changed', { event, session: !!session });
      
      // Handle token refresh errors gracefully
      if (event === 'TOKEN_REFRESHED' && !session) {
        logger.warn('useAuth: Token refresh failed, signing out gracefully');
        setSession(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      setSession(session as AuthSession);
      
      if (event === 'SIGNED_OUT') {
        logger.debug('useAuth: User signed out');
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Handle session expiry errors without auto-signout  
      if (!session && event !== 'INITIAL_SESSION') {
        logger.warn('useAuth: Session lost unexpectedly, clearing state but not forcing signout');
        setUser(null);
        setLoading(false);
        return;
      }
      
      if (session?.user) {
        // Defer the profile fetch to avoid blocking the auth state change
        setTimeout(() => {
          fetchUserProfile(session.user.id);
        }, 0);
      } else if (event === 'SIGNED_IN') {
        logger.debug('useAuth: No session in state change, clearing user');
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Add debouncing to prevent multiple calls
  const fetchUserProfileRef = useRef<string | null>(null);
  
  const fetchUserProfile = async (userId: string, force = false) => {
    // Prevent duplicate calls for the same user unless forced
    if (!force && fetchUserProfileRef.current === userId) {
      logger.debug('fetchUserProfile: Skipping duplicate call for user', { userId });
      return;
    }
    
    fetchUserProfileRef.current = userId;
    logger.debug('fetchUserProfile: Starting for user', { userId });
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          id, email, role, full_name, created_at, last_login_at, status, 
          password_display, is_temp_password, updated_at, created_by,
          lms_status,
          students(onboarding_completed)
        `)
        .eq('id', userId)
        .maybeSingle();
      
      logger.debug('fetchUserProfile: Database query completed', { 
        hasData: !!data, 
        userRole: data?.role,
        error: error?.message
      });

      if (error) {
        logger.error('fetchUserProfile: Database error', error);
        // Don't sign out on database errors - keep the session active
        if (sessionRef.current?.user) {
          logger.warn('fetchUserProfile: Keeping session active despite database error');
          setUser({
            id: sessionRef.current.user.id,
            email: sessionRef.current.user.email || '',
            role: 'student', // default role
            full_name: sessionRef.current.user.user_metadata?.full_name || sessionRef.current.user.email,
            onboarding_done: false // Assume onboarding needed on error
          });
        }
      } else if (data) {
        logger.debug('fetchUserProfile: Setting user data', { role: data.role, email: data.email });
        // Determine onboarding status - default to needing onboarding for students
        let onboardingDone = data.role !== 'student'; // Non-students don't need onboarding
        
        if (data.role === 'student') {
          if (import.meta.env.DEV) {
            console.log('fetchUserProfile: Checking student onboarding status for user:', userId);
          }
          const { data: studentRow, error: studentErr } = await supabase
            .from('students')
            .select('onboarding_completed')
            .eq('user_id', userId)
            .maybeSingle();
          
          if (studentErr) {
            logger.warn('fetchUserProfile: Error fetching student onboarding status', studentErr);
            if (import.meta.env.DEV) {
              console.warn('fetchUserProfile: Student query error, defaulting to onboarding needed:', studentErr.message);
            }
            // If error fetching student record, assume onboarding needed
            onboardingDone = false;
          } else if (!studentRow) {
            logger.warn('fetchUserProfile: No student record found for user, assuming onboarding needed', { userId });
            if (import.meta.env.DEV) {
              console.warn('fetchUserProfile: No student record found, onboarding needed');
            }
            // If no student record exists, they definitely need onboarding
            onboardingDone = false;
          } else {
            // Student record exists, check completion status
            onboardingDone = !!studentRow.onboarding_completed;
            if (import.meta.env.DEV) {
              console.log('fetchUserProfile: Student record found, onboarding_completed:', studentRow.onboarding_completed, 'onboardingDone:', onboardingDone);
            }
          }
          
          logger.debug('fetchUserProfile: Student onboarding status', { 
            userId, 
            studentExists: !!studentRow, 
            onboardingCompleted: studentRow?.onboarding_completed,
            onboardingDone,
            studentErr: studentErr?.message 
          });
        }

        const userData = {
          ...data,
          onboarding_done: onboardingDone,
        };
        logger.debug('fetchUserProfile: Setting user data with onboarding status', { 
          userId: userData.id, 
          role: userData.role, 
          email: userData.email,
          onboarding_done: userData.onboarding_done 
        });
        setUser(userData as User);
      } else {
        logger.warn('fetchUserProfile: No data returned but session exists');
        // User record doesn't exist but session is valid - use session data
        if (sessionRef.current?.user) {
          logger.warn('fetchUserProfile: Creating fallback user data for session without user record');
          setUser({
            id: sessionRef.current.user.id,
            email: sessionRef.current.user.email || '',
            role: 'student', // default role
            full_name: sessionRef.current.user.user_metadata?.full_name || sessionRef.current.user.email,
            onboarding_done: false // New users need onboarding
          });
        }
      }
    } catch (error) {
      logger.error('fetchUserProfile: Unexpected error', error);
      // Don't sign out on errors - preserve the session
      if (sessionRef.current?.user) {
        logger.warn('fetchUserProfile: Preserving session despite error');
        setUser({
          id: sessionRef.current.user.id,
          email: sessionRef.current.user.email || '',
          role: 'student', // default role
          full_name: sessionRef.current.user.user_metadata?.full_name || sessionRef.current.user.email,
          onboarding_done: false // Assume onboarding needed on error
        });
      }
    } finally {
      logger.debug('fetchUserProfile: Setting loading to false');
      setLoading(false);
      fetchUserProfileRef.current = null; // Reset to allow future calls
    }
  };

  const refreshUser = async (force = false) => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.id) {
        await fetchUserProfile(authUser.id, force);
      } else {
        logger.warn('refreshUser: No auth user found');
        setUser(null);
        setLoading(false);
      }
    } catch (e) {
      logger.error('refreshUser: Error refreshing user', e);
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const hasRole = (roles: string | string[]): boolean => {
    if (!user) return false;
    if (typeof roles === 'string') return user.role === roles;
    return roles.includes(user.role);
  };

  const canAccessLMS = (): boolean => {
    if (!user) return false;
    if (user.role !== 'student') return true; // Non-students always have access
    // Check student's LMS status - must be 'active' to access
    return user.lms_status === 'active';
  };

  return {
    user,
    loading,
    signOut,
    hasRole,
    canAccessLMS,
    refreshUser,
    session
  };
};