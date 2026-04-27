# File Storage Integration

## Overview

File Storage integration manages user uploads, company branding assets, and system files through Supabase Storage with CDN delivery.

## Purpose in Project

- **Assignment Uploads**: Student file submissions for assignments
- **Company Branding**: Logo uploads and brand asset management
- **System Assets**: Platform images, documents, and resources
- **Content Delivery**: CDN-optimized file serving

## Setup and Configuration

### Storage Buckets
- `assignment-files`: Public bucket for student assignment uploads
- `company-branding`: Public bucket for logo and branding assets

### File Upload Limits
- Maximum file size: 10MB for assignments
- Maximum file size: 5MB for branding assets
- Supported formats: PDF, DOC, DOCX, images (JPG, PNG, SVG)

### Access Control
```sql
-- Assignment files policies
CREATE POLICY "Students can upload assignment files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'assignment-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Branding assets policies  
CREATE POLICY "Superadmins can upload branding"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'company-branding' AND is_superadmin());
```

## Integration Points

### Assignment System
```typescript
// File upload for assignments
const uploadAssignmentFile = async (file: File, assignmentId: string) => {
  const filePath = `${auth.uid()}/${assignmentId}/${file.name}`;
  
  const { data, error } = await supabase.storage
    .from('assignment-files')
    .upload(filePath, file);
    
  return data?.path;
}
```

### Branding System
```typescript
// Logo upload with optimization
const uploadCompanyLogo = async (file: File) => {
  // Validate file type and size
  // Upload to company-branding bucket
  // Generate multiple sizes for different uses
  // Update company_settings with new URL
}
```

### CDN Delivery
- Automatic CDN caching for optimal performance
- Global edge locations for fast file delivery
- Image optimization and format conversion
- Bandwidth optimization for video content

## Security Considerations

### File Validation
- File type verification prevents malicious uploads
- Size limits prevent storage abuse
- Virus scanning for uploaded content
- User-specific folder isolation

### Access Control
- Row Level Security governs file access
- Public buckets for CDN delivery
- Private buckets for sensitive content
- Time-limited signed URLs for secure access

## Key Storage Patterns

### Assignment Files
```
assignment-files/
├── {user_id}/
│   ├── {assignment_id}/
│   │   ├── submission.pdf
│   │   └── supporting_doc.docx
```

### Branding Assets
```
company-branding/
├── logos/
│   ├── main-logo.svg
│   ├── favicon-16x16.png
│   └── favicon-32x32.png
```

## Troubleshooting

### Common Issues

**Upload Failures**
- Check file size against bucket limits
- Verify file type is supported
- Confirm user has upload permissions
- Review storage quota and billing status

**File Access Issues**
- Verify RLS policies allow file access
- Check file path and naming convention
- Confirm bucket public/private settings
- Test with different user roles

**Performance Issues**
- Monitor CDN cache hit rates
- Optimize image formats and sizes
- Check bandwidth usage patterns
- Consider compression for large files

### Debug Queries
```sql
-- Check recent file uploads
SELECT name, size, created_at, owner
FROM storage.objects 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Monitor storage usage by bucket
SELECT bucket_id, COUNT(*) as file_count, 
       SUM(size) as total_size
FROM storage.objects 
GROUP BY bucket_id;
```

## Extending the System

### Advanced File Management
- File versioning and history
- Automated backup and archival
- Advanced metadata and tagging
- File conversion and processing

### Content Management
- Rich media support (audio, video)
- Document preview and collaboration
- Batch upload and management
- Advanced search and filtering

## Next Steps
Review [Assignment System](../features/assignment-system.md) for file upload workflows and [Company Branding](../features/company-branding.md) for asset management.