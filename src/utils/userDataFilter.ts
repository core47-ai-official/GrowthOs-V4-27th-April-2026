/**
 * User Data Filtering Utilities
 * Ensures sensitive fields like passwords are never exposed to non-superadmin users
 */

export interface User {
  id: string;
  email: string;
  full_name?: string;
  role: string;
  status?: string;
  lms_status?: string;
  phone?: string;
  last_active_at?: string;
  created_at?: string;
  updated_at?: string;
  password_hash?: string;
  password_display?: string;
  is_temp_password?: boolean;
}

/**
 * Filters sensitive password fields from user data based on current user's role
 * @param userData - The user data to filter
 * @param currentUserRole - The role of the user requesting the data
 * @returns Filtered user data without sensitive fields if not superadmin
 */
export function filterUserData<T extends Partial<User>>(
  userData: T,
  currentUserRole?: string
): T {
  // Superadmins can see everything
  if (currentUserRole === 'superadmin') {
    return userData;
  }

  // For all other roles, remove password fields
  const { password_hash, password_display, ...filteredData } = userData;
  
  return filteredData as T;
}

/**
 * Filters an array of user data
 * @param users - Array of user data to filter
 * @param currentUserRole - The role of the user requesting the data
 * @returns Filtered array without sensitive fields if not superadmin
 */
export function filterUserDataArray<T extends Partial<User>>(
  users: T[],
  currentUserRole?: string
): T[] {
  return users.map(user => filterUserData(user, currentUserRole));
}

/**
 * Check if current user can view password fields
 * @param currentUserRole - The role of the user
 * @returns true if user can view passwords, false otherwise
 */
export function canViewPasswords(currentUserRole?: string): boolean {
  return currentUserRole === 'superadmin';
}

/**
 * Get safe columns for SELECT query based on user role
 * @param currentUserRole - The role of the user
 * @returns Column list to select (excludes passwords for non-superadmin)
 */
export function getSafeUserColumns(currentUserRole?: string): string {
  if (currentUserRole === 'superadmin') {
    return '*';
  }
  
  // Explicitly list all columns except password fields
  return 'id, email, full_name, role, status, lms_status, phone, last_active_at, created_at, updated_at, is_temp_password';
}