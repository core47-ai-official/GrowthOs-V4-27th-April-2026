#!/usr/bin/env node

/**
 * Script to replace console.error statements with proper error handling
 * This helps convert legacy error handling to production-ready patterns
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all TypeScript and TSX files in src
const files = glob.sync('src/**/*.{ts,tsx}', { ignore: ['src/**/*.test.*', 'src/**/*.spec.*'] });

let totalReplacements = 0;

files.forEach(filePath => {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Skip files that already import error handling utilities
  if (content.includes('handleApplicationError') || content.includes('errorHandler')) {
    return;
  }
  
  // Count console.error occurrences (excluding logger files)
  if (filePath.includes('/lib/logger.ts') || filePath.includes('/lib/production-monitoring.ts')) {
    return;
  }
  
  const consoleErrorMatches = content.match(/console\.error\(/g);
  if (consoleErrorMatches) {
    console.log(`Found ${consoleErrorMatches.length} console.error statements in ${filePath}`);
    totalReplacements += consoleErrorMatches.length;
  }
});

console.log(`\nTotal console.error statements found: ${totalReplacements}`);
console.log(`Files to update: ${files.filter(f => {
  const content = fs.readFileSync(f, 'utf8');
  return content.includes('console.error(') && 
         !content.includes('handleApplicationError') &&
         !f.includes('/lib/logger.ts') &&
         !f.includes('/lib/production-monitoring.ts');
}).length}`);

console.log('\nRecommendation:');
console.log('1. Import { handleApplicationError } from "@/utils/errorHandling" in each file');
console.log('2. Replace console.error(message, error) with handleApplicationError(error, "context")');
console.log('3. Update error context to be descriptive of the operation that failed');