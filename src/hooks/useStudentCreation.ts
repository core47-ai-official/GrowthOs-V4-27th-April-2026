import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface CreateStudentData {
  email: string
  password: string
  full_name: string
  phone?: string
  address?: string
  mentor_id?: string
}

export interface CreateStudentResponse {
  success: boolean
  data?: {
    id: string
    email: string
    full_name: string
    role: string
    phone?: string
    address?: string
    mentor_id?: string
    created_at: string
  }
  message?: string
  error?: string
  error_code?: string
}

export const useStudentCreation = () => {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const createStudent = async (studentData: CreateStudentData): Promise<CreateStudentResponse> => {
    setIsLoading(true)
    
    try {
      const { data, error } = await supabase.functions.invoke('create-student-v2', {
        body: studentData
      })

      if (error) {
        console.error('Edge function error:', error)
        toast({
          title: "Error",
          description: "Failed to create student. Please try again.",
          variant: "destructive",
        })
        return {
          success: false,
          error: 'Edge function error',
          error_code: 'FUNCTION_ERROR'
        }
      }

      if (data?.success) {
        toast({
          title: "Success",
          description: `Student ${data.data.full_name} created successfully!`,
        })
        return data
      } else {
        const errorMessage = data?.error || 'Unknown error occurred'
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        })
        return data || { success: false, error: errorMessage }
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