import { useState, useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useInstallmentOptions } from './useInstallmentOptions';
import { logger } from '@/lib/logger';

// Phone regex: +{1-4 digits country code}{6-14 digits}
const PHONE_REGEX = /^\+\d{1,4}\d{6,14}$/;

// RFC 5322 email regex (simplified but comprehensive)
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export interface StudentFormData {
  full_name: string;
  email: string;
  phone: string;
  fees_structure: string;
}

export interface ValidationErrors {
  full_name?: string;
  email?: string;
  phone?: string;
  fees_structure?: string;
  general?: string;
}

export const createStudentSchema = (maxInstallmentCount: number) => z.object({
  full_name: z
    .string()
    .min(3, 'Full name must be at least 3 characters')
    .max(100, 'Full name must be less than 100 characters')
    .trim(),
  email: z
    .string()
    .regex(EMAIL_REGEX, 'Please enter a valid email address')
    .transform(val => val.toLowerCase().trim()),
  phone: z
    .string()
    .regex(PHONE_REGEX, 'Phone must start with a country code, e.g. \'+92…\'')
    .min(8, 'Phone number is too short')
    .max(18, 'Phone number is too long'),
  fees_structure: z
    .string()
    .refine(
      (val) => {
        const match = val.match(/^(\d+)_installments?$/);
        if (!match) return false;
        const count = parseInt(match[1]);
        return count >= 1 && count <= maxInstallmentCount;
      },
      `Installment count must be between 1 and ${maxInstallmentCount}`
    )
});

export const useStudentFormValidation = () => {
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isValidating, setIsValidating] = useState(false);
  const { maxCount, validateInstallmentValue } = useInstallmentOptions();

  const validateField = useCallback(async (field: keyof StudentFormData, value: string): Promise<string | undefined> => {
    const schema = createStudentSchema(maxCount);
    
    try {
      if (field === 'email') {
        // Check email uniqueness
        const { data: existingStudent, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', value.toLowerCase().trim())
          .eq('role', 'student')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "not found" which is what we want
          logger.error('Email uniqueness check error:', error);
          throw error;
        }

        if (existingStudent) {
          return 'A student with this email already exists';
        }
      }

      if (field === 'phone') {
        // Check phone uniqueness - users table doesn't have phone field, skip for now
        // TODO: Add phone field to users table or create profiles table
        const existingStudent = null;
        const error = null;

        if (error && error.code !== 'PGRST116') {
          // PGRST116 is "not found" which is what we want
          logger.error('Phone uniqueness check error:', error);
          throw error;
        }

        if (existingStudent) {
          return 'A student with this phone number already exists';
        }
      }

      // Validate the field using Zod
      const fieldSchema = schema.shape[field];
      fieldSchema.parse(value);
      return undefined;
    } catch (error) {
      logger.error(`Field validation error for ${field}:`, error);
      if (error instanceof z.ZodError) {
        return error.issues[0]?.message;
      }
      return 'Validation failed';
    }
  }, [maxCount]);

  const validateForm = useCallback(async (data: StudentFormData): Promise<ValidationErrors> => {
    const schema = createStudentSchema(maxCount);
    const newErrors: ValidationErrors = {};

    logger.debug('Validating form data:', { data });

    try {
      // First validate the structure with Zod
      const result = schema.safeParse(data);
      
      if (!result.success) {
        logger.debug('Zod validation errors:', { issues: result.error.issues });
        result.error.issues.forEach((issue) => {
          const field = issue.path[0] as keyof StudentFormData;
          if (field) {
            newErrors[field] = issue.message;
          }
        });
      }

      // Check email uniqueness if email is valid
      if (!newErrors.email && data.email) {
        logger.debug('Checking email uniqueness for:', { email: data.email });
        const { data: existingStudent, error } = await supabase
          .from('users')
          .select('id')
          .eq('email', data.email.toLowerCase().trim())
          .eq('role', 'student')
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          logger.error('Email uniqueness check error:', error);
          newErrors.general = 'Failed to validate email uniqueness';
        } else if (existingStudent) {
          logger.debug('Email already exists:', { existingStudent });
          newErrors.email = 'A student with this email already exists';
        }
      }

      // Check phone uniqueness if phone is valid
      // TODO: Add phone field to users table or create profiles table
      // Skipping phone uniqueness check for now

      // Validate installment count against current settings
      if (!newErrors.fees_structure && !validateInstallmentValue(data.fees_structure)) {
        logger.debug('Invalid installment value:', { value: data.fees_structure, maxAllowed: maxCount });
        newErrors.fees_structure = 'The selected installment option is no longer available';
      }

    } catch (error) {
      logger.error('Form validation error:', error);
      newErrors.general = 'Validation failed. Please try again.';
    }

    logger.debug('Validation completed. Errors:', { errors: newErrors });
    return newErrors;
  }, [maxCount, validateInstallmentValue]);

  const validateAndSetErrors = useCallback(async (data: StudentFormData): Promise<boolean> => {
    setIsValidating(true);
    const validationErrors = await validateForm(data);
    setErrors(validationErrors);
    setIsValidating(false);
    return Object.keys(validationErrors).length === 0;
  }, [validateForm]);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const clearFieldError = useCallback((field: keyof StudentFormData) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });
  }, []);

  return {
    errors,
    isValidating,
    validateField,
    validateForm,
    validateAndSetErrors,
    clearErrors,
    clearFieldError,
    schema: createStudentSchema(maxCount)
  };
};