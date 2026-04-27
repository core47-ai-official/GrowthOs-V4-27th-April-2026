import { z } from 'zod';

/**
 * Secure input validation schemas and utilities
 * Prevents injection attacks and ensures data integrity
 */

// Email validation with strict rules
export const emailSchema = z
  .string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" })
  .toLowerCase();

// Phone validation (international format)
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" })
  .optional();

// Name validation (no special characters except spaces, hyphens, apostrophes)
export const nameSchema = z
  .string()
  .trim()
  .min(1, { message: "Name cannot be empty" })
  .max(100, { message: "Name must be less than 100 characters" })
  .regex(/^[a-zA-Z\s\-']+$/, { message: "Name can only contain letters, spaces, hyphens, and apostrophes" });

// Password validation (strong password requirements)
export const passwordSchema = z
  .string()
  .min(8, { message: "Password must be at least 8 characters" })
  .max(128, { message: "Password must be less than 128 characters" })
  .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
  .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
  .regex(/[0-9]/, { message: "Password must contain at least one number" });

// URL validation with allowed protocols
export const urlSchema = z
  .string()
  .trim()
  .url({ message: "Invalid URL format" })
  .refine((url) => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, { message: "Only HTTP and HTTPS protocols are allowed" });

// Text content validation (prevents XSS)
export const textContentSchema = z
  .string()
  .trim()
  .max(10000, { message: "Text content must be less than 10000 characters" })
  .transform((val) => {
    // Remove any HTML tags
    return val.replace(/<[^>]*>/g, '');
  });

// JSON validation with size limit
export const jsonSchema = z
  .string()
  .refine((val) => {
    try {
      JSON.parse(val);
      return true;
    } catch {
      return false;
    }
  }, { message: "Invalid JSON format" })
  .refine((val) => val.length < 100000, { message: "JSON data too large" });

// UUID validation
export const uuidSchema = z
  .string()
  .uuid({ message: "Invalid UUID format" });

// Numeric ID validation
export const numericIdSchema = z
  .number()
  .int({ message: "ID must be an integer" })
  .positive({ message: "ID must be positive" });

/**
 * Sanitize string for safe display (prevents XSS)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize for URL parameters
 */
export function sanitizeUrlParam(input: string): string {
  return encodeURIComponent(input.trim());
}

/**
 * Validate and sanitize file upload
 */
export const fileUploadSchema = z.object({
  name: z.string().regex(/^[\w\-. ]+$/, { message: "Invalid file name" }),
  size: z.number().max(10 * 1024 * 1024, { message: "File size must be less than 10MB" }),
  type: z.string().regex(/^(image|application|video)\/(jpeg|jpg|png|gif|pdf|mp4|webm)$/, {
    message: "Invalid file type"
  })
});

/**
 * Student creation validation schema
 */
export const studentCreationSchema = z.object({
  email: emailSchema,
  fullName: nameSchema,
  phone: phoneSchema,
  password: passwordSchema.optional(),
});

/**
 * Assignment submission validation schema
 */
export const submissionSchema = z.object({
  content: textContentSchema.optional(),
  links: z.array(urlSchema).max(10, { message: "Maximum 10 links allowed" }).optional(),
});

/**
 * Message/Feedback validation schema
 */
export const messageSchema = z.object({
  content: z.string().trim().min(1, { message: "Message cannot be empty" }).max(10000, { message: "Message must be less than 10000 characters" }),
  type: z.enum(['feedback', 'support', 'general']),
});

/**
 * Rate limiting check (simple in-memory implementation)
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests = 10, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(key);

  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (record.count >= maxRequests) {
    return false;
  }

  record.count++;
  return true;
}

/**
 * Clean up old rate limit entries
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 60000); // Clean up every minute
