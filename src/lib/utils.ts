import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Simple URL obfuscation utilities
export function obfuscateUrl(url: string): string {
  try {
    return btoa(encodeURIComponent(url));
  } catch {
    return url;
  }
}

export function deobfuscateUrl(encoded: string): string {
  try {
    return decodeURIComponent(atob(encoded));
  } catch {
    return encoded;
  }
}
