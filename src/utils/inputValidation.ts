/**
 * Comprehensive input validation and sanitization utilities
 * Security-focused to prevent XSS, injection, and other attacks
 */

// Email validation
export function validateEmail(email: string): { valid: boolean; message?: string } {
  if (!email || typeof email !== 'string') {
    return { valid: false, message: 'Email is required' };
  }
  
  if (email.length > 254) {
    return { valid: false, message: 'Email is too long' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: 'Invalid email format' };
  }
  
  return { valid: true };
}

// Password validation
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }
  
  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters long' };
  }
  
  if (password.length > 128) {
    return { valid: false, message: 'Password is too long' };
  }
  
  if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
    return { valid: false, message: 'Password must contain uppercase, lowercase, and number' };
  }
  
  return { valid: true };
}

// Name validation
export function validateName(name: string): { valid: boolean; message?: string } {
  if (!name || typeof name !== 'string') {
    return { valid: false, message: 'Name is required' };
  }
  
  if (name.length < 1) {
    return { valid: false, message: 'Name cannot be empty' };
  }
  
  if (name.length > 100) {
    return { valid: false, message: 'Name is too long' };
  }
  
  // Allow letters, spaces, hyphens, apostrophes
  const nameRegex = /^[a-zA-Z\s\-']+$/;
  if (!nameRegex.test(name)) {
    return { valid: false, message: 'Name contains invalid characters' };
  }
  
  return { valid: true };
}

// Text input sanitization (removes potentially dangerous characters)
export function sanitizeText(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/[<>'"&]/g, '') // Remove HTML/JS injection characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim() // Remove leading/trailing whitespace
    .slice(0, 1000); // Limit length
}

// HTML sanitization for rich text content
export function sanitizeHtml(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/&/g, '&amp;');
}

// URL validation and sanitization
export function validateUrl(url: string): { valid: boolean; message?: string } {
  if (!url || typeof url !== 'string') {
    return { valid: false, message: 'URL is required' };
  }
  
  try {
    const parsed = new URL(url);
    
    // Only allow http/https protocols
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, message: 'Only HTTP/HTTPS URLs are allowed' };
    }
    
    return { valid: true };
  } catch {
    return { valid: false, message: 'Invalid URL format' };
  }
}

// Phone number validation
export function validatePhone(phone: string): { valid: boolean; message?: string } {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, message: 'Phone number is required' };
  }
  
  // Remove all non-digit characters for validation
  const digitsOnly = phone.replace(/\D/g, '');
  
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return { valid: false, message: 'Phone number must be 10-15 digits' };
  }
  
  return { valid: true };
}

// Generic text length validation
export function validateTextLength(
  text: string, 
  minLength: number = 0, 
  maxLength: number = 1000
): { valid: boolean; message?: string } {
  if (!text || typeof text !== 'string') {
    if (minLength > 0) {
      return { valid: false, message: 'This field is required' };
    }
    return { valid: true };
  }
  
  if (text.length < minLength) {
    return { valid: false, message: `Must be at least ${minLength} characters` };
  }
  
  if (text.length > maxLength) {
    return { valid: false, message: `Must be less than ${maxLength} characters` };
  }
  
  return { valid: true };
}

// Form validation helper
export function validateForm(
  data: Record<string, any>, 
  rules: Record<string, (value: any) => { valid: boolean; message?: string }>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  
  for (const [field, validator] of Object.entries(rules)) {
    const result = validator(data[field]);
    if (!result.valid && result.message) {
      errors[field] = result.message;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

// SQL injection prevention (for user-controlled search terms)
export function sanitizeSearchTerm(term: string): string {
  if (!term || typeof term !== 'string') {
    return '';
  }
  
  return term
    .replace(/[;'"\\]/g, '') // Remove SQL injection characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim()
    .slice(0, 100); // Limit length
}