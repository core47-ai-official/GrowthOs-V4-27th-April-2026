# Company Branding System

## Overview

The Company Branding system enables complete customization of the Growth OS platform with company logos, colors, and visual identity to match organizational branding requirements.

## User-Facing Behavior

### For Superadmins
- **Logo Management**: Upload and manage company logos with manual update of favicon from teh backend
- **Brand Configuration**: Set company details (name, contact information, colors)
- **Email Customization**: Customize email sender information

### For All Users
- **Branded Experience**: See company logo and colors throughout the platform
- **Consistent Visual Identity**: Experience cohesive brand presentation

## Technical Implementation

### Core Components
- `src/components/LogoUploadSection.tsx` - Logo upload and management interface
- `src/components/superadmin/CompanySettings.tsx` - Brand configuration panel
- `src/components/DynamicFavicon.tsx` - Automatic favicon generation
- `src/hooks/useCompanyBranding.ts` - Branding data management

### Database Tables
- `company_settings` - All branding and company configuration data
- `branding` JSONB field - Logo URLs, color schemes, styling preferences

### Storage Integration
- `company-branding` Supabase Storage bucket for logo assets
- Automatic image optimization and format conversion
- CDN delivery for optimal performance

### Key Functions
```typescript
// Branding management
updateCompanyBranding(brandingData: object)
uploadCompanyLogo(file: File)
generateFavicon(logoUrl: string)
```

## Configuration Matrix

### Environment Variables
| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| No specific environment variables | Storage handled by Supabase | N/A | N/A |

### Company Settings (Database)
| Field | Purpose | Default | Editable |
|-------|---------|---------|----------|
| `company_name` | Organization name | "Your Company" | Yes |
| `company_email` | Primary contact email | None | Yes |
| `primary_phone` | Main phone number | "" | Yes |
| `secondary_phone` | Secondary contact | None | Yes |
| `address` | Company address | "" | Yes |
| `contact_email` | Support email | "" | Yes |
| `branding.logo_url` | Company logo | None | Yes |
| `branding.favicon_url` | Favicon | Auto-generated | Auto |
| `branding.primary_color` | Brand color | System default | Yes |
| `branding.secondary_color` | Accent color | System default | Yes |

### Email Branding Configuration
| Setting | Purpose | Default | Location |
|---------|---------|---------|----------|
| `SMTP_FROM_NAME` | Email sender name | "Growth OS" | Environment |
| `SMTP_LMS_FROM_NAME` | LMS email sender | "LMS Team" | Environment |
| `SMTP_FROM_EMAIL` | Default sender | Required | Environment |
| `SMTP_LMS_FROM_EMAIL` | LMS sender | Required | Environment |

### Hard-coded Values
```typescript
// Storage configuration
const BRANDING_BUCKET = 'company-branding';
const LOGO_PATH = 'logos/';
const FAVICON_PATH = 'favicons/';

// Supported image formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/svg+xml'];

// Maximum file sizes
const MAX_LOGO_SIZE = 5 * 1024 * 1024; // 5MB
```

## Security Considerations

### Access Control
- Only Superadmins can modify company branding
- Logo uploads restricted to authenticated superadmins
- Branding assets stored in public bucket for CDN delivery
- File type validation prevents malicious uploads

### Data Protection
- Branding data versioned for rollback capabilities
- Logo files scanned for malicious content
- Public storage bucket with controlled write access
- Audit logging for all branding changes

### Failure Modes
- **Logo Upload Failures**: Fallback to previous logo version
- **Storage Issues**: Local caching of branding assets
- **CDN Failures**: Direct storage URL fallback
- **Format Conversion Issues**: Manual image processing backup

## Branding Features

### Logo Management
```typescript
// Logo upload process
const uploadLogo = async (file: File) => {
  // Validate file type and size
  // Upload to Supabase Storage
  // Generate multiple sizes (favicon, header, email)
  // Update company_settings with new URLs
  // Clear browser cache for immediate update
}
```

### Automatic Favicon Generation
- Converts uploaded logo to favicon formats
- Generates multiple sizes (16x16, 32x32, 180x180)
- Automatic browser cache invalidation
- Fallback to default favicon if generation fails

### Color Theme Management
```typescript
// Dynamic color scheme application
const applyBrandColors = (colors) => {
  // Updates CSS custom properties
  // Affects primary, secondary, and accent colors
  // Maintains accessibility contrast ratios
  // Applies to all UI components
}
```

### Email Template Branding
- Company logo in email headers
- Branded email signatures
- Custom sender names and addresses
- Consistent visual identity across all communications

## Integration Points

### Storage System
```typescript
// Supabase Storage integration
const brandingStorage = supabase.storage.from('company-branding');

// Upload with optimization
const uploadBrandingAsset = async (file, path) => {
  // Image optimization
  // Multiple format generation
  // CDN cache invalidation
}
```

### CSS Custom Properties
```css
/* Dynamic brand colors */
:root {
  --brand-primary: var(--company-primary, hsl(var(--primary)));
  --brand-secondary: var(--company-secondary, hsl(var(--secondary)));
  --brand-accent: var(--company-accent, hsl(var(--accent)));
}
```

### Email Service Integration
- Logo embedding in email templates
- Brand color application in HTML emails
- Custom sender configuration per email type
- Template versioning for brand updates

## Extending the System

### Advanced Branding Options
```typescript
// Extended branding configuration
const advancedBranding = {
  fonts: {
    primary: 'Company Font',
    secondary: 'Fallback Font'
  },
  spacing: {
    scale: 1.2 // Custom spacing multiplier
  },
  borders: {
    radius: 8 // Custom border radius
  }
}
```

### Brand Asset Management
```typescript
// Advanced asset management
const brandAssets = {
  logos: {
    primary: 'main-logo.svg',
    secondary: 'icon-only.svg',
    monochrome: 'logo-mono.svg'
  },
  graphics: {
    hero_banner: 'hero.jpg',
    email_header: 'email-header.png'
  }
}
```

### Theme Builder Interface
1. Visual color picker for brand colors
2. Real-time preview of changes
3. Theme export/import functionality
4. Brand guideline compliance checking

## Workflow Examples

### Setting Up Company Branding
1. Superadmin navigates to Company Settings
2. Uploads company logo (automatic favicon generation)
3. Sets company name and contact information
4. Saves settings - changes apply immediately across platform

## Troubleshooting

### Common Issues

**Logo Not Displaying**
- Check file upload completed successfully
- Verify storage bucket permissions
- Confirm logo URL in company_settings table
- Clear browser cache and CDN cache

**Favicon Not Updating**
- Verify favicon generation completed
- Check multiple favicon sizes were created
- Clear browser favicon cache (hard refresh)
- Confirm favicon URL is correct

**Brand Colors Not Applying**
- Check CSS custom property updates
- Verify color format (HSL required)
- Confirm browser supports CSS custom properties
- Review color contrast accessibility

**Email Branding Issues**
- Verify email configuration
- Check SMTP sender name settings
- Confirm logo URL is publicly accessible
- Test email rendering across email clients

### Debugging Commands
```sql
-- Check current branding configuration
SELECT * FROM company_settings WHERE id = 1;

-- Verify logo upload
SELECT branding->'logo_url' as logo_url 
FROM company_settings WHERE id = 1;
```

```typescript
// Check CSS custom properties
const checkBrandColors = () => {
  const root = getComputedStyle(document.documentElement);
  console.log('Primary:', root.getPropertyValue('--brand-primary'));
  console.log('Secondary:', root.getPropertyValue('--brand-secondary'));
}
```

## Next Steps

Review [Environment Reference](../env-reference.md) for email configuration details and [Company Settings](../integrations/supabase.md) for database configuration management.
