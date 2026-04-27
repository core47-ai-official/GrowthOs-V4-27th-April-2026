// API wrapper with centralized error handling
import { supabase } from '@/integrations/supabase/client';
import { errorHandler } from './error-handler';
import { safeQuery } from './database-safety';
import { logger } from './logger';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

export class ApiWrapper {
  // Generic database query wrapper
  static async query<T>(
    operation: () => Promise<{ data: T | null; error: any }>,
    context = 'database'
  ): Promise<ApiResponse<T>> {
    try {
      const { data, error } = await operation();
      
      if (error) {
        const userError = errorHandler.handleError(error, context, false);
        return {
          data: null,
          error: userError.message,
          success: false
        };
      }
      
      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      const userError = errorHandler.handleError(error, context, false);
      return {
        data: null,
        error: userError.message,
        success: false
      };
    }
  }

  // User operations
  static async getUser(userId: string): Promise<ApiResponse<any>> {
    return this.query(
      async () => {
        const result = await supabase
          .from('users')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        return result;
      },
      'user_fetch'
    );
  }

  static async updateUser(userId: string, updates: any): Promise<ApiResponse<any>> {
    return this.query(
      async () => {
        const result = await supabase
          .from('users')
          .update(updates)
          .eq('id', userId)
          .select()
          .maybeSingle();
        return result;
      },
      'user_update'
    );
  }

  // Auth operations
  static async signIn(email: string, password: string): Promise<ApiResponse<any>> {
    return this.query(
      async () => {
        const result = await supabase.auth.signInWithPassword({ email, password });
        return result;
      },
      'auth_signin'
    );
  }

  static async signOut(): Promise<ApiResponse<void>> {
    return this.query(
      async () => {
        const { error } = await supabase.auth.signOut();
        return { data: undefined, error };
      },
      'auth_signout'
    );
  }

  // File upload operations
  static async uploadFile(
    bucket: string, 
    path: string, 
    file: File
  ): Promise<ApiResponse<any>> {
    return this.query(
      async () => {
        const result = await supabase.storage.from(bucket).upload(path, file);
        return result;
      },
      'file_upload'
    );
  }

  // Generic operations with custom error context
  static async execute<T>(
    operation: () => Promise<T>,
    context = 'general'
  ): Promise<ApiResponse<T>> {
    try {
      const data = await operation();
      return {
        data,
        error: null,
        success: true
      };
    } catch (error) {
      const userError = errorHandler.handleError(error, context, false);
      return {
        data: null,
        error: userError.message,
        success: false
      };
    }
  }
}

// Utility function for form submissions
export const handleFormSubmission = async <T>(
  operation: () => Promise<T>,
  onSuccess?: (data: T) => void,
  onError?: (error: string) => void,
  context = 'form_submission'
): Promise<boolean> => {
  const result = await ApiWrapper.execute(operation, context);
  
  if (result.success && result.data !== null) {
    onSuccess?.(result.data);
    return true;
  } else {
    onError?.(result.error || 'An unexpected error occurred');
    return false;
  }
};