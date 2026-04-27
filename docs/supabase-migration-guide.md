# Supabase Project Migration Guide

A complete, step-by-step guide to duplicate a Supabase project 100% identically from one instance to another.

**Last Updated:** December 2025

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Full Database Export Methods](#2-full-database-export-methods)
3. [Full Database Import Methods](#3-full-database-import-methods)
4. [Export & Import Storage Buckets](#4-export--import-storage-buckets)
5. [Export & Restore RLS Policies](#5-export--restore-rls-policies)
6. [Important Migration Notes](#6-important-migration-notes)
7. [Verification Checklist](#7-verification-checklist)
8. [Troubleshooting](#8-troubleshooting)
9. [Final Success Checklist](#9-final-success-checklist)

---

## 1. Prerequisites

### Required Tools

| Tool | Purpose | Installation |
|------|---------|-------------|
| **Supabase CLI** | Project management, migrations, edge functions | `npm install -g supabase` |
| **PostgreSQL Client (psql)** | Direct database access | `brew install postgresql` (Mac) or `apt install postgresql-client` (Linux) |
| **pg_dump** | Database export | Included with PostgreSQL |
| **Docker** (optional) | Local Supabase development | [Docker Desktop](https://docker.com) |
| **Node.js 18+** | Edge Functions deployment | [nodejs.org](https://nodejs.org) |

### Environment Variables

Create a `.env.migration` file with both source and target credentials:

```bash
# Source Project (Original)
SOURCE_PROJECT_REF=your-source-project-ref
SOURCE_DB_URL=postgresql://postgres.[SOURCE_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
SOURCE_DB_DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[SOURCE_PROJECT_REF].supabase.co:5432/postgres
SOURCE_ANON_KEY=your-source-anon-key
SOURCE_SERVICE_ROLE_KEY=your-source-service-role-key

# Target Project (New)
TARGET_PROJECT_REF=your-target-project-ref
TARGET_DB_URL=postgresql://postgres.[TARGET_PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
TARGET_DB_DIRECT_URL=postgresql://postgres:[PASSWORD]@db.[TARGET_PROJECT_REF].supabase.co:5432/postgres
TARGET_ANON_KEY=your-target-anon-key
TARGET_SERVICE_ROLE_KEY=your-target-service-role-key
```

### Access Requirements

- **Source Project:** Admin access with database password
- **Target Project:** Admin access with database password
- **Both Projects:** Access to Supabase Dashboard for verification
- **Storage Access:** Service role keys for both projects

### Getting Database Credentials

1. Go to Supabase Dashboard → Project Settings → Database
2. Copy the **Connection string** (URI format)
3. Replace `[YOUR-PASSWORD]` with the actual database password
4. Use the **Direct connection** URL for migrations (not pooler for schema changes)

> ⚠️ **Warning:** Always use the direct connection URL (port 5432) for schema exports/imports, not the pooler URL (port 6543).

---

## 2. Full Database Export Methods

### 2.1 Export Using Supabase CLI

The Supabase CLI can export your database schema and generate migration files.

#### Link to Source Project

```bash
# Initialize Supabase in your project directory
supabase init

# Link to source project
supabase link --project-ref $SOURCE_PROJECT_REF

# Enter database password when prompted
```

#### Pull Remote Schema (Migrations)

```bash
# Pull all migrations from remote database
supabase db pull

# This creates migration files in supabase/migrations/
```

#### Export Schema Diff

```bash
# Generate a migration from current remote state
supabase db diff --schema public --file full_schema

# This creates supabase/migrations/[timestamp]_full_schema.sql
```

### 2.2 Export Using pg_dump (Recommended for Complete Backup)

#### Export Schema Only

```bash
# Export public schema structure only (no data)
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file=schema_only.sql
```

#### Export Schema + Data (Full Backup)

```bash
# Complete backup with all data
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file=full_backup.sql

# With compression for large databases
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --compress=9 \
  --file=full_backup.sql.gz
```

#### Export All Schemas (Including auth, storage references)

```bash
# Export everything (public + extensions + types)
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --create \
  --file=complete_backup.sql
```

#### Export Specific Components

```bash
# Export only functions
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --section=pre-data \
  --file=functions_only.sql

# Export only data (no schema)
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --data-only \
  --file=data_only.sql

# Export specific tables
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --table=public.users \
  --table=public.students \
  --file=specific_tables.sql
```

### 2.3 Export Extensions List

```bash
# Connect and list all extensions
psql "$SOURCE_DB_DIRECT_URL" -c "SELECT extname, extversion FROM pg_extension ORDER BY extname;" > extensions_list.txt

# Export extension creation commands
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 'CREATE EXTENSION IF NOT EXISTS \"' || extname || '\" WITH SCHEMA extensions;'
FROM pg_extension
WHERE extname NOT IN ('plpgsql')
ORDER BY extname;
" > create_extensions.sql
```

### 2.4 Export Triggers

```bash
# Export all triggers
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT pg_get_triggerdef(oid) || ';'
FROM pg_trigger
WHERE tgrelid IN (
  SELECT oid FROM pg_class WHERE relnamespace = 'public'::regnamespace
)
AND NOT tgisinternal;
" > triggers.sql
```

### 2.5 Export Views

```bash
# Export all view definitions
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 'CREATE OR REPLACE VIEW ' || schemaname || '.' || viewname || ' AS ' || definition
FROM pg_views
WHERE schemaname = 'public';
" > views.sql
```

### 2.6 Export RLS Policies

```bash
# Export all RLS policies
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 
  'CREATE POLICY \"' || polname || '\" ON ' || schemaname || '.' || tablename ||
  ' AS ' || CASE WHEN polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END ||
  ' FOR ' || CASE polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END ||
  CASE WHEN polroles::text != '{0}' THEN ' TO ' || array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)), ', ') ELSE '' END ||
  CASE WHEN polqual IS NOT NULL THEN ' USING (' || pg_get_expr(polqual, polrelid) || ')' ELSE '' END ||
  CASE WHEN polwithcheck IS NOT NULL THEN ' WITH CHECK (' || pg_get_expr(polwithcheck, polrelid) || ')' ELSE '' END ||
  ';'
FROM pg_policy
JOIN pg_class ON pg_policy.polrelid = pg_class.oid
JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid
WHERE nspname = 'public';
" > rls_policies.sql
```

### 2.7 Complete Export Script

Create a script `export_database.sh`:

```bash
#!/bin/bash
set -e

# Load environment variables
source .env.migration

EXPORT_DIR="./supabase_export_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$EXPORT_DIR"

echo "🚀 Starting complete database export..."

# 1. Export complete schema + data
echo "📦 Exporting complete database..."
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --file="$EXPORT_DIR/01_complete_backup.sql"

# 2. Export schema only (for reference)
echo "📋 Exporting schema only..."
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --file="$EXPORT_DIR/02_schema_only.sql"

# 3. Export data only (for reference)
echo "💾 Exporting data only..."
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --data-only \
  --no-owner \
  --no-privileges \
  --file="$EXPORT_DIR/03_data_only.sql"

# 4. Export extensions
echo "🔧 Exporting extensions..."
psql "$SOURCE_DB_DIRECT_URL" -t -c "
SELECT 'CREATE EXTENSION IF NOT EXISTS \"' || extname || '\";'
FROM pg_extension
WHERE extname NOT IN ('plpgsql')
ORDER BY extname;
" > "$EXPORT_DIR/00_extensions.sql"

# 5. Export functions separately
echo "⚙️ Exporting functions..."
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;
" > "$EXPORT_DIR/04_functions.sql"

# 6. Export triggers
echo "⚡ Exporting triggers..."
psql "$SOURCE_DB_DIRECT_URL" -t -c "
SELECT pg_get_triggerdef(t.oid) || ';'
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal;
" > "$EXPORT_DIR/05_triggers.sql"

# 7. Export RLS status and policies
echo "🔒 Exporting RLS configuration..."
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 'ALTER TABLE public.' || tablename || ' ENABLE ROW LEVEL SECURITY;'
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
" > "$EXPORT_DIR/06_rls_enable.sql"

echo "✅ Export complete! Files saved to: $EXPORT_DIR"
ls -la "$EXPORT_DIR"
```

Make it executable and run:

```bash
chmod +x export_database.sh
./export_database.sh
```

---

## 3. Full Database Import Methods

### 3.1 Prepare Target Database

Before importing, ensure the target database is clean or ready:

```bash
# Connect to target database
psql "$TARGET_DB_DIRECT_URL"

# Optional: Drop all existing tables in public schema (DANGEROUS!)
-- DROP SCHEMA public CASCADE;
-- CREATE SCHEMA public;
-- GRANT ALL ON SCHEMA public TO postgres;
-- GRANT ALL ON SCHEMA public TO public;
```

### 3.2 Import Using Supabase CLI

```bash
# Link to target project
supabase link --project-ref $TARGET_PROJECT_REF

# Push all local migrations
supabase db push

# Or reset and push (CAUTION: destroys existing data)
supabase db reset --linked
```

### 3.3 Import Using psql (Recommended)

#### Import in Correct Order

```bash
# 1. First, install extensions
psql "$TARGET_DB_DIRECT_URL" -f 00_extensions.sql

# 2. Import complete backup (schema + data)
psql "$TARGET_DB_DIRECT_URL" -f 01_complete_backup.sql

# OR import schema first, then data:
psql "$TARGET_DB_DIRECT_URL" -f 02_schema_only.sql
psql "$TARGET_DB_DIRECT_URL" -f 03_data_only.sql

# 3. Import functions (if separate)
psql "$TARGET_DB_DIRECT_URL" -f 04_functions.sql

# 4. Import triggers
psql "$TARGET_DB_DIRECT_URL" -f 05_triggers.sql

# 5. Enable RLS
psql "$TARGET_DB_DIRECT_URL" -f 06_rls_enable.sql
```

#### Import with Error Handling

```bash
# Continue on errors (useful for debugging)
psql "$TARGET_DB_DIRECT_URL" \
  --set ON_ERROR_STOP=off \
  -f complete_backup.sql \
  2>&1 | tee import_log.txt

# Stop on first error
psql "$TARGET_DB_DIRECT_URL" \
  --set ON_ERROR_STOP=on \
  -f complete_backup.sql
```

### 3.4 Handling Large SQL Files

For databases larger than 1GB:

```bash
# Split large files into chunks
split -l 50000 large_backup.sql chunk_

# Import chunks sequentially
for f in chunk_*; do
  echo "Importing $f..."
  psql "$TARGET_DB_DIRECT_URL" -f "$f"
done
```

#### Using pg_restore for Custom Format

```bash
# Export in custom format (more efficient)
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --format=custom \
  --file=backup.dump

# Import with parallelism
pg_restore \
  --dbname="$TARGET_DB_DIRECT_URL" \
  --jobs=4 \
  --no-owner \
  --no-privileges \
  backup.dump
```

### 3.5 Import Specific Components

```bash
# Import only specific tables
psql "$TARGET_DB_DIRECT_URL" -c "
\copy public.users FROM 'users_data.csv' WITH CSV HEADER;
\copy public.students FROM 'students_data.csv' WITH CSV HEADER;
"
```

### 3.6 Complete Import Script

Create `import_database.sh`:

```bash
#!/bin/bash
set -e

source .env.migration

EXPORT_DIR=$1

if [ -z "$EXPORT_DIR" ]; then
  echo "Usage: ./import_database.sh <export_directory>"
  exit 1
fi

echo "🚀 Starting database import from $EXPORT_DIR..."

# 1. Install extensions first
if [ -f "$EXPORT_DIR/00_extensions.sql" ]; then
  echo "🔧 Installing extensions..."
  psql "$TARGET_DB_DIRECT_URL" -f "$EXPORT_DIR/00_extensions.sql" 2>&1 || true
fi

# 2. Import complete backup
echo "📦 Importing database..."
psql "$TARGET_DB_DIRECT_URL" \
  --set ON_ERROR_STOP=off \
  -f "$EXPORT_DIR/01_complete_backup.sql" \
  2>&1 | tee import_log.txt

# 3. Verify import
echo "✅ Verifying import..."
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT schemaname, COUNT(*) as table_count
FROM pg_tables
WHERE schemaname = 'public'
GROUP BY schemaname;
"

echo "📊 Table row counts:"
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT relname as table_name, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;
"

echo "✅ Import complete! Check import_log.txt for any errors."
```

---

## 4. Export & Import Storage Buckets

### 4.1 List All Buckets

```bash
# Using psql
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets;
"
```

### 4.2 Export Bucket Definitions

```bash
# Export bucket creation SQL
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 'INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES (' ||
  quote_literal(id) || ', ' ||
  quote_literal(name) || ', ' ||
  public || ', ' ||
  COALESCE(file_size_limit::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(allowed_mime_types::text), 'NULL') ||
') ON CONFLICT (id) DO NOTHING;'
FROM storage.buckets;
" > storage_buckets.sql
```

### 4.3 Export Storage Policies

```bash
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 
  'CREATE POLICY \"' || polname || '\" ON storage.objects FOR ' ||
  CASE polcmd 
    WHEN 'r' THEN 'SELECT'
    WHEN 'a' THEN 'INSERT'
    WHEN 'w' THEN 'UPDATE'
    WHEN 'd' THEN 'DELETE'
    WHEN '*' THEN 'ALL'
  END ||
  ' USING (' || pg_get_expr(polqual, polrelid) || ')' ||
  CASE WHEN polwithcheck IS NOT NULL 
    THEN ' WITH CHECK (' || pg_get_expr(polwithcheck, polrelid) || ')'
    ELSE ''
  END || ';'
FROM pg_policy
WHERE polrelid = 'storage.objects'::regclass;
" > storage_policies.sql
```

### 4.4 Download All Storage Objects

Create `download_storage.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  `https://${process.env.SOURCE_PROJECT_REF}.supabase.co`,
  process.env.SOURCE_SERVICE_ROLE_KEY
);

async function downloadAllStorage() {
  const outputDir = './storage_backup';
  
  // Get all buckets
  const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
  
  if (bucketsError) {
    console.error('Error listing buckets:', bucketsError);
    return;
  }
  
  for (const bucket of buckets) {
    console.log(`📁 Processing bucket: ${bucket.name}`);
    
    const bucketDir = path.join(outputDir, bucket.name);
    fs.mkdirSync(bucketDir, { recursive: true });
    
    // Save bucket metadata
    fs.writeFileSync(
      path.join(bucketDir, '_metadata.json'),
      JSON.stringify(bucket, null, 2)
    );
    
    // List all files in bucket
    await downloadBucketContents(bucket.name, bucketDir, '');
  }
  
  console.log('✅ Storage backup complete!');
}

async function downloadBucketContents(bucketName, localDir, prefix) {
  const { data: files, error } = await supabase.storage
    .from(bucketName)
    .list(prefix, { limit: 1000 });
  
  if (error) {
    console.error(`Error listing ${bucketName}/${prefix}:`, error);
    return;
  }
  
  for (const file of files) {
    const remotePath = prefix ? `${prefix}/${file.name}` : file.name;
    const localPath = path.join(localDir, remotePath);
    
    if (file.id === null) {
      // It's a folder
      fs.mkdirSync(localPath, { recursive: true });
      await downloadBucketContents(bucketName, localDir, remotePath);
    } else {
      // It's a file
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      
      const { data, error: downloadError } = await supabase.storage
        .from(bucketName)
        .download(remotePath);
      
      if (downloadError) {
        console.error(`Error downloading ${remotePath}:`, downloadError);
        continue;
      }
      
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(localPath, buffer);
      console.log(`  ✓ Downloaded: ${remotePath}`);
    }
  }
}

downloadAllStorage();
```

Run with:

```bash
node download_storage.js
```

### 4.5 Upload Storage to Target

Create `upload_storage.js`:

```javascript
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  `https://${process.env.TARGET_PROJECT_REF}.supabase.co`,
  process.env.TARGET_SERVICE_ROLE_KEY
);

async function uploadAllStorage() {
  const inputDir = './storage_backup';
  
  const buckets = fs.readdirSync(inputDir).filter(f => 
    fs.statSync(path.join(inputDir, f)).isDirectory()
  );
  
  for (const bucketName of buckets) {
    console.log(`📁 Processing bucket: ${bucketName}`);
    
    const bucketDir = path.join(inputDir, bucketName);
    const metadataPath = path.join(bucketDir, '_metadata.json');
    
    // Create bucket if it doesn't exist
    if (fs.existsSync(metadataPath)) {
      const metadata = JSON.parse(fs.readFileSync(metadataPath));
      
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: metadata.public,
        fileSizeLimit: metadata.file_size_limit,
        allowedMimeTypes: metadata.allowed_mime_types
      });
      
      if (createError && !createError.message.includes('already exists')) {
        console.error(`Error creating bucket ${bucketName}:`, createError);
      }
    }
    
    // Upload all files
    await uploadDirectory(bucketName, bucketDir, '');
  }
  
  console.log('✅ Storage upload complete!');
}

async function uploadDirectory(bucketName, localDir, prefix) {
  const items = fs.readdirSync(localDir);
  
  for (const item of items) {
    if (item === '_metadata.json') continue;
    
    const localPath = path.join(localDir, item);
    const remotePath = prefix ? `${prefix}/${item}` : item;
    
    if (fs.statSync(localPath).isDirectory()) {
      await uploadDirectory(bucketName, localPath, remotePath);
    } else {
      const fileBuffer = fs.readFileSync(localPath);
      
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(remotePath, fileBuffer, { upsert: true });
      
      if (error) {
        console.error(`Error uploading ${remotePath}:`, error);
      } else {
        console.log(`  ✓ Uploaded: ${remotePath}`);
      }
    }
  }
}

uploadAllStorage();
```

### 4.6 Import Storage Buckets and Policies

```bash
# Create buckets in target
psql "$TARGET_DB_DIRECT_URL" -f storage_buckets.sql

# Apply storage policies
psql "$TARGET_DB_DIRECT_URL" -f storage_policies.sql
```

---

## 5. Export & Restore RLS Policies

### 5.1 Check RLS Status on All Tables

```bash
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policy WHERE polrelid = (schemaname || '.' || tablename)::regclass) as policy_count
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### 5.2 Export Complete RLS Configuration

```bash
# Export RLS enable statements
psql "$SOURCE_DB_DIRECT_URL" -t -c "
SELECT 'ALTER TABLE ' || schemaname || '.' || tablename || ' ENABLE ROW LEVEL SECURITY;'
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true;
" > rls_enable.sql

# Export all policies with full definitions
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
" > rls_policies_report.txt
```

### 5.3 Export Functions Used in RLS Policies

Many RLS policies reference custom functions. Export these first:

```bash
# Find functions used in RLS policies
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT DISTINCT 
  regexp_matches(qual::text, 'public\.([a-z_]+)\(', 'g') as function_name
FROM pg_policies
WHERE schemaname = 'public' AND qual IS NOT NULL
UNION
SELECT DISTINCT 
  regexp_matches(with_check::text, 'public\.([a-z_]+)\(', 'g')
FROM pg_policies
WHERE schemaname = 'public' AND with_check IS NOT NULL;
"

# Export security-related functions
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT pg_get_functiondef(p.oid) || ';'
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
  'get_current_user_role',
  'get_my_role',
  'has_role',
  'has_any_role',
  'can_view_sensitive_user_data',
  'get_users_by_role'
)
ORDER BY p.proname;
" > security_functions.sql
```

### 5.4 Import RLS in Correct Order

```bash
# 1. First, import all security functions
psql "$TARGET_DB_DIRECT_URL" -f security_functions.sql

# 2. Then enable RLS on tables
psql "$TARGET_DB_DIRECT_URL" -f rls_enable.sql

# 3. Finally, create policies (they're included in the main schema export)
```

> ⚠️ **Critical:** Security functions MUST exist before RLS policies that reference them, or the policy creation will fail.

---

## 6. Important Migration Notes

### 6.1 Correct Order of Schema Import

Always import in this order to avoid dependency errors:

```
1. Extensions (CREATE EXTENSION)
2. Enums (CREATE TYPE)
3. Tables (CREATE TABLE) - without foreign keys first
4. Sequences (if not auto-created)
5. Functions (CREATE FUNCTION)
6. Table alterations (ADD CONSTRAINT for foreign keys)
7. Indexes (CREATE INDEX)
8. Views (CREATE VIEW)
9. Triggers (CREATE TRIGGER)
10. RLS Enable (ALTER TABLE ... ENABLE ROW LEVEL SECURITY)
11. RLS Policies (CREATE POLICY)
12. Data (INSERT/COPY)
```

### 6.2 Common Dependency Issues

#### Problem: Function doesn't exist

```sql
-- Error: function get_current_user_role() does not exist
```

**Solution:** Ensure functions are imported before RLS policies:

```bash
# Import functions first
psql "$TARGET_DB_DIRECT_URL" -f functions.sql

# Then import RLS policies
psql "$TARGET_DB_DIRECT_URL" -f rls_policies.sql
```

#### Problem: Table doesn't exist for foreign key

```sql
-- Error: relation "users" does not exist
```

**Solution:** Import tables in dependency order or use deferred constraints:

```sql
-- Add foreign keys after all tables exist
ALTER TABLE public.students
ADD CONSTRAINT students_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.users(id);
```

#### Problem: Extension not available

```sql
-- Error: extension "uuid-ossp" is not available
```

**Solution:** Some extensions require superuser access:

```bash
# List available extensions
psql "$TARGET_DB_DIRECT_URL" -c "SELECT * FROM pg_available_extensions;"

# Use gen_random_uuid() instead of uuid_generate_v4()
```

### 6.3 Schema Search Path Issues

Always set the correct search_path in functions:

```sql
-- Good: Explicit schema references
CREATE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public  -- Important!
AS $$
BEGIN
  -- function body
END;
$$;
```

### 6.4 Auth Schema References

Never try to recreate `auth` schema tables. Reference them:

```sql
-- Wrong: Don't do this
CREATE TABLE auth.users (...);

-- Right: Reference existing auth tables
SELECT * FROM auth.users WHERE id = auth.uid();
```

### 6.5 Sequence Ownership

After importing, fix sequence ownership:

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT 'ALTER SEQUENCE ' || sequence_schema || '.' || sequence_name || 
       ' OWNED BY ' || table_schema || '.' || table_name || '.' || column_name || ';'
FROM information_schema.columns 
WHERE column_default LIKE 'nextval%'
AND table_schema = 'public';
"
```

---

## 7. Verification Checklist

### 7.1 Verify All Tables Match

```bash
# Compare table counts
echo "=== Source Tables ==="
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT COUNT(*) as table_count FROM pg_tables WHERE schemaname = 'public';
"

echo "=== Target Tables ==="
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT COUNT(*) as table_count FROM pg_tables WHERE schemaname = 'public';
"

# Compare table names
echo "=== Tables in Source but not in Target ==="
psql "$SOURCE_DB_DIRECT_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" > source_tables.txt
psql "$TARGET_DB_DIRECT_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;" > target_tables.txt
diff source_tables.txt target_tables.txt
```

### 7.2 Verify Row Counts

```bash
# Compare row counts for all tables
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT relname as table_name, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
" > source_counts.txt

psql "$TARGET_DB_DIRECT_URL" -c "
SELECT relname as table_name, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;
" > target_counts.txt

diff source_counts.txt target_counts.txt
```

### 7.3 Verify Functions Exist

```bash
# Compare function counts
echo "=== Function Comparison ==="
psql "$SOURCE_DB_DIRECT_URL" -c "
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
"

psql "$TARGET_DB_DIRECT_URL" -c "
SELECT COUNT(*) FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public';
"
```

### 7.4 Verify Triggers Exist

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT 
  tgname as trigger_name,
  relname as table_name,
  CASE tgtype & 1 WHEN 1 THEN 'ROW' ELSE 'STATEMENT' END as trigger_level,
  CASE tgtype & 66
    WHEN 2 THEN 'BEFORE'
    WHEN 64 THEN 'INSTEAD OF'
    ELSE 'AFTER'
  END as trigger_timing
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
JOIN pg_namespace n ON c.relnamespace = n.oid
WHERE n.nspname = 'public' AND NOT t.tgisinternal
ORDER BY relname, tgname;
"
```

### 7.5 Verify RLS Is Active

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = t.tablename) as policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
"
```

### 7.6 Verify Storage Buckets

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT id, name, public, created_at
FROM storage.buckets
ORDER BY name;
"
```

### 7.7 Verify Extensions

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT extname, extversion 
FROM pg_extension 
ORDER BY extname;
"
```

### 7.8 Verify Indexes

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
"
```

### 7.9 Verify Foreign Keys

```bash
psql "$TARGET_DB_DIRECT_URL" -c "
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name;
"
```

---

## 8. Troubleshooting

### 8.1 Fix search_path Issues

**Problem:** Functions fail with "relation does not exist"

```sql
-- Error: relation "users" does not exist
```

**Solution:** Update function with explicit search_path:

```sql
CREATE OR REPLACE FUNCTION public.my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  SELECT * FROM public.users; -- Use explicit schema
END;
$$;
```

### 8.2 Fix Missing Extensions

**Problem:** Extension required but not installed

```sql
-- Error: type "uuid" does not exist
```

**Solution:**

```sql
-- Install required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA graphql;
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgjwt" WITH SCHEMA extensions;
```

### 8.3 Fix Dependency Errors

**Problem:** Cannot create due to dependency

```sql
-- Error: cannot drop table users because other objects depend on it
```

**Solution:** Use CASCADE carefully or fix order:

```bash
# Export with dependency order
pg_dump "$SOURCE_DB_DIRECT_URL" \
  --schema=public \
  --no-owner \
  --no-privileges \
  --serializable-deferrable \
  --file=ordered_backup.sql
```

### 8.4 Fix Import Failures

**Problem:** Import stops on error

**Solution:** Use error-tolerant mode:

```bash
psql "$TARGET_DB_DIRECT_URL" \
  --set ON_ERROR_STOP=off \
  -f backup.sql 2>&1 | tee import_errors.log

# Review errors
grep -i "error" import_errors.log
```

### 8.5 Fix RLS Policy Order Issues

**Problem:** Policy references non-existent function

```sql
-- Error: function get_current_user_role() does not exist
```

**Solution:** Create a migration script with correct order:

```bash
#!/bin/bash
# import_ordered.sh

echo "1. Installing extensions..."
psql "$TARGET_DB_DIRECT_URL" -f 00_extensions.sql

echo "2. Creating enums..."
psql "$TARGET_DB_DIRECT_URL" -f 01_enums.sql

echo "3. Creating tables (no FKs)..."
psql "$TARGET_DB_DIRECT_URL" -f 02_tables.sql

echo "4. Creating functions..."
psql "$TARGET_DB_DIRECT_URL" -f 03_functions.sql

echo "5. Adding foreign keys..."
psql "$TARGET_DB_DIRECT_URL" -f 04_foreign_keys.sql

echo "6. Creating indexes..."
psql "$TARGET_DB_DIRECT_URL" -f 05_indexes.sql

echo "7. Creating views..."
psql "$TARGET_DB_DIRECT_URL" -f 06_views.sql

echo "8. Creating triggers..."
psql "$TARGET_DB_DIRECT_URL" -f 07_triggers.sql

echo "9. Enabling RLS..."
psql "$TARGET_DB_DIRECT_URL" -f 08_rls_enable.sql

echo "10. Creating RLS policies..."
psql "$TARGET_DB_DIRECT_URL" -f 09_rls_policies.sql

echo "11. Importing data..."
psql "$TARGET_DB_DIRECT_URL" -f 10_data.sql

echo "✅ Import complete!"
```

### 8.6 Fix Sequence Reset After Data Import

**Problem:** Sequences not updated after data import

**Solution:**

```sql
-- Reset all sequences to max value of their column
SELECT 'SELECT setval(pg_get_serial_sequence(''' || table_name || ''', ''' || column_name || '''), COALESCE(MAX(' || column_name || '), 1)) FROM ' || table_name || ';'
FROM information_schema.columns
WHERE column_default LIKE 'nextval%'
AND table_schema = 'public';
```

### 8.7 Fix Permissions Issues

**Problem:** Permission denied on storage or tables

**Solution:**

```sql
-- Grant permissions on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
```

---

## 9. Final Success Checklist

Use this checklist to confirm your migration is 100% complete:

### Database Structure

- [ ] All tables exist in target (compare counts)
- [ ] All columns match (types, defaults, constraints)
- [ ] All primary keys exist
- [ ] All foreign keys exist and reference correct tables
- [ ] All unique constraints exist
- [ ] All check constraints exist
- [ ] All indexes exist

### Database Functions

- [ ] All functions exist (compare counts)
- [ ] Function signatures match
- [ ] Security definer settings correct
- [ ] Search paths set correctly

### Triggers

- [ ] All triggers exist
- [ ] Trigger timing correct (BEFORE/AFTER)
- [ ] Trigger events correct (INSERT/UPDATE/DELETE)
- [ ] Trigger functions exist

### Views

- [ ] All views exist
- [ ] View definitions match source

### RLS Security

- [ ] RLS enabled on all required tables
- [ ] All RLS policies exist
- [ ] Policy permissions correct (SELECT/INSERT/UPDATE/DELETE)
- [ ] Policy expressions reference valid functions

### Data

- [ ] Row counts match source
- [ ] Sample data verified
- [ ] Sequences reset to correct values
- [ ] No orphaned records

### Storage

- [ ] All buckets created
- [ ] Bucket settings correct (public/private)
- [ ] All files uploaded
- [ ] Storage policies applied

### Extensions

- [ ] All required extensions installed
- [ ] Extension versions compatible

### Edge Functions

- [ ] All edge functions deployed
- [ ] Environment secrets configured
- [ ] Function URLs accessible

### Authentication

- [ ] Auth users NOT migrated (use invitation flow)
- [ ] Auth settings configured in dashboard
- [ ] Email templates configured
- [ ] OAuth providers configured (if used)

### Final Verification

```bash
# Run complete verification script
./verify_migration.sh

# Manual spot checks
# 1. Log in as test user
# 2. Perform CRUD operations
# 3. Verify RLS restricts access correctly
# 4. Test edge functions
# 5. Upload/download files from storage
```

---

## Quick Reference Commands

### Export Complete Database

```bash
pg_dump "$SOURCE_DB_DIRECT_URL" --schema=public --no-owner --no-privileges -f backup.sql
```

### Import Complete Database

```bash
psql "$TARGET_DB_DIRECT_URL" -f backup.sql
```

### Compare Databases

```bash
# Tables
diff <(psql "$SOURCE_DB_DIRECT_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1") \
     <(psql "$TARGET_DB_DIRECT_URL" -t -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY 1")

# Functions
diff <(psql "$SOURCE_DB_DIRECT_URL" -t -c "SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' ORDER BY 1") \
     <(psql "$TARGET_DB_DIRECT_URL" -t -c "SELECT proname FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid WHERE n.nspname='public' ORDER BY 1")
```

### Deploy Edge Functions

```bash
# Deploy all functions
supabase functions deploy --project-ref $TARGET_PROJECT_REF

# Deploy specific function
supabase functions deploy my-function --project-ref $TARGET_PROJECT_REF
```

---

## Need Help?

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [PostgreSQL pg_dump Documentation](https://www.postgresql.org/docs/current/app-pgdump.html)
- [Supabase Migration Guide](https://supabase.com/docs/guides/platform/migrating-and-upgrading-projects)
- [RLS Best Practices](https://supabase.com/docs/guides/auth/row-level-security)

---

*This guide was created for Growth OS LMS and can be adapted for any Supabase project.*
