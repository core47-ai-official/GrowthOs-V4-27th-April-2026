import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type UserRole = 'student' | 'admin' | 'mentor' | 'superadmin' | 'enrollment_manager';

export interface CreateUserRequest {
  target_email: string;
  target_password: string;
  target_role: UserRole;
  target_full_name?: string;
  target_metadata?: any;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  created_at: string;
  metadata?: any;
}

export const useUserManagement = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createUser = async (userData: CreateUserRequest): Promise<boolean> => {
    setLoading(true);
    try {
      // Check if there are any users in the system first
      const { count: userCount } = await supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      // For the first user (bootstrap), we don't need authentication
      const invokeOptions: any = {
        body: userData
      };

      // Only add auth header if users exist in the system
      if (userCount && userCount > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast({
            variant: "destructive",
            title: "Error",
            description: "You must be logged in to create users"
          });
          return false;
        }
      }

      const { data, error } = await supabase.functions.invoke('create-user-with-role', invokeOptions);

      if (error || data?.error) {
        toast({
          variant: "destructive",
          title: "Error",
          description: data?.error || error?.message || "Failed to create user"
        });
        return false;
      }

      toast({
        title: "Success",
        description: `User ${userData.target_email} created successfully`
      });
      return true;
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to create user"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId: string): Promise<boolean> => {
    setLoading(true);
    try {
      console.log('[useUserManagement] Attempting to delete user:', userId);
      
      const { data, error } = await supabase.functions.invoke('delete-user-with-role', {
        body: { target_user_id: userId }
      });

      console.log('[useUserManagement] Edge function response:', { data, error });

      if (error) {
        console.error('[useUserManagement] Edge function error:', error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to delete user"
        });
        return false;
      }

      if (data?.error) {
        console.error('[useUserManagement] Server-side error:', data.error);
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error
        });
        return false;
      }

      console.log('[useUserManagement] User deleted successfully');
      toast({
        title: "Success",
        description: "User deleted successfully"
      });
      return true;
    } catch (error: any) {
      console.error('[useUserManagement] Exception during deletion:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete user"
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const deleteMultipleUsers = async (userIds: string[]): Promise<{ success: number; failed: number }> => {
    setLoading(true);
    let success = 0;
    let failed = 0;

    try {
      for (const userId of userIds) {
        try {
          const { data, error } = await supabase.functions.invoke('delete-user-with-role', {
            body: { target_user_id: userId }
          });

          if (error || data?.error) {
            failed++;
          } else {
            success++;
          }
        } catch {
          failed++;
        }
      }

      if (success > 0) {
        toast({
          title: "Bulk Delete Completed",
          description: `Successfully deleted ${success} student(s)${failed > 0 ? `, ${failed} failed` : ''}`
        });
      }

      if (failed > 0 && success === 0) {
        toast({
          variant: "destructive",
          title: "Bulk Delete Failed",
          description: `Failed to delete ${failed} student(s)`
        });
      }

      return { success, failed };
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to delete users"
      });
      return { success: 0, failed: userIds.length };
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserInfo = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('whoami');
      
      if (error || data?.error) {
        console.error('Failed to get user info:', data?.error || error?.message);
        return null;
      }

      return data as UserProfile;
    } catch (error: any) {
      console.error('Failed to get user info:', error.message);
      return null;
    }
  };

  return {
    createUser,
    deleteUser,
    deleteMultipleUsers,
    getCurrentUserInfo,
    loading
  };
};