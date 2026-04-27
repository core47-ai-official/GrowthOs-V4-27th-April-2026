import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface EnhancedStudentData {
  email: string
  full_name: string
  phone: string
  installment_count: number
  course_id?: string
  pathway_id?: string
  batch_id?: string
  total_fee_amount?: number
  discount_amount?: number
  discount_percentage?: number
  // Access control overrides
  drip_override?: boolean
  drip_enabled?: boolean
  sequential_override?: boolean
  sequential_enabled?: boolean
}

export interface EnhancedStudentResponse {
  success: boolean
  data?: {
    id: string
    email: string
    full_name: string
    role: string
    student_id: string
    lms_credentials: {
      lms_user_id: string
      lms_password: string
    }
    generated_password: string
    created_at: string
  }
  message?: string
  error?: string
  error_code?: string
}

export const useEnhancedStudentCreation = () => {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const createStudent = async (studentData: EnhancedStudentData): Promise<EnhancedStudentResponse> => {
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('create-enhanced-student', {
        body: studentData,
        headers: {
          Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      })

      // Handle edge function errors (network issues, etc.)
      if (error) {
        console.error('Edge function error:', error)
        
        // Try to parse error message if it contains our custom error
        const errorMessage = error?.message || error?.toString() || ''
        const errorCode = errorMessage.includes('PHONE_EXISTS') ? 'PHONE_EXISTS' 
          : errorMessage.includes('EMAIL_EXISTS') ? 'EMAIL_EXISTS'
          : errorMessage.includes('INVALID_PHONE_FORMAT') ? 'INVALID_PHONE_FORMAT'
          : 'FUNCTION_ERROR'
        
        let friendlyMessage = 'Failed to create student. Please try again.'
        
        switch (errorCode) {
          case 'EMAIL_EXISTS':
            friendlyMessage = 'A student with this email address already exists in the system.'
            break
          case 'PHONE_EXISTS':
            friendlyMessage = 'A student with this phone number already exists in the system.'
            break
          case 'INVALID_PHONE_FORMAT':
            friendlyMessage = 'Invalid phone format. Please use international format (e.g., +923001234567)'
            break
        }
        
        toast({
          title: "Error",
          description: friendlyMessage,
          variant: "destructive",
        })
        
        return {
          success: false,
          error: friendlyMessage,
          error_code: errorCode
        }
      }

      if (data?.success) {
        // email_sent may be undefined if emails are sent asynchronously after the response
        const emailExplicitlyFailed = data.email_sent === false;
        const emailStatus = emailExplicitlyFailed
          ? 'Welcome email could not be sent. Please check email configuration.'
          : 'Welcome email will be sent with LMS credentials.';
        
        toast({
          title: "Student Created",
          description: `Student ${data.data.full_name} created successfully! ${emailStatus}`,
          variant: emailExplicitlyFailed ? "destructive" : "default",
        })

        if (emailExplicitlyFailed && data.email_error) {
          console.warn('Email delivery failed:', data.email_error);
        }

        return data
      } else {
        const errorCode = data?.error_code
        let friendlyMessage = data?.error || 'Unknown error occurred'
        
        // Map error codes to user-friendly messages
        switch (errorCode) {
          case 'EMAIL_EXISTS':
            friendlyMessage = 'A student with this email address already exists in the system.'
            break
          case 'PHONE_EXISTS':
            friendlyMessage = data?.error || 'A student with this phone number already exists in the system.'
            break
          case 'INVALID_PHONE_FORMAT':
            friendlyMessage = 'Invalid phone format. Please use international format (e.g., +923001234567)'
            break
          case 'MISSING_FIELDS':
            friendlyMessage = 'Please fill in all required fields.'
            break
          default:
            // Use the error message from the server
            friendlyMessage = data?.error || 'Failed to create student. Please try again.'
        }
        
        toast({
          title: "Error",
          description: friendlyMessage,
          variant: "destructive",
        })
        return { 
          success: false, 
          error: friendlyMessage, 
          error_code: errorCode
        }
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      const errorMessage = err instanceof Error ? err.message : 'Unexpected error occurred'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      return {
        success: false,
        error: errorMessage,
        error_code: 'UNEXPECTED_ERROR'
      }
    } finally {
      setIsLoading(false)
    }
  }

  return {
    createStudent,
    isLoading
  }
}