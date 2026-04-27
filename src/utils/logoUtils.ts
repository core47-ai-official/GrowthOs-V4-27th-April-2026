// Logo processing utilities

export interface LogoVariants {
  original: string;
  favicon: string;
  header: string;
}

export interface LogoValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Validate logo file and dimensions
export const validateLogo = async (file: File): Promise<LogoValidationResult> => {
  const result: LogoValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // File type validation
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    result.errors.push('Only PNG, JPEG, or SVG files are allowed');
    result.isValid = false;
  }

  // File size validation (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    result.errors.push('File size must be less than 5MB');
    result.isValid = false;
  }

  // Dimension validation for raster images
  if (file.type !== 'image/svg+xml') {
    const dimensions = await getImageDimensions(file);
    
    if (dimensions.width < 256 || dimensions.height < 256) {
      result.errors.push('Image must be at least 256×256 pixels');
      result.isValid = false;
    }

    // Check if image is square (with some tolerance)
    const aspectRatio = dimensions.width / dimensions.height;
    if (Math.abs(aspectRatio - 1) > 0.1) {
      result.warnings.push('Square images (1:1 aspect ratio) work best for logos');
    }

    // Recommend optimal size
    if (dimensions.width !== 512 || dimensions.height !== 512) {
      result.warnings.push('For best results, use 512×512 pixels');
    }
  }

  return result;
};

// Get image dimensions
const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

// Generate resized image variants
export const generateLogoVariants = async (file: File): Promise<Blob[]> => {
  const variants: Blob[] = [];
  
  // Load original image
  const img = await loadImage(file);
  
  // Generate favicon (32x32)
  const faviconBlob = await resizeImage(img, 32, 32);
  variants.push(faviconBlob);
  
  // Generate header version (max height 200px, maintain aspect ratio)
  const headerBlob = await resizeImage(img, null, 200);
  variants.push(headerBlob);
  
  return variants;
};

const loadImage = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
};

const resizeImage = (img: HTMLImageElement, width: number | null, height: number | null): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }

    let targetWidth = width;
    let targetHeight = height;

    // Calculate dimensions maintaining aspect ratio
    if (width && !height) {
      targetWidth = width;
      targetHeight = (img.naturalHeight / img.naturalWidth) * width;
    } else if (height && !width) {
      targetHeight = height;
      targetWidth = (img.naturalWidth / img.naturalHeight) * height;
    } else if (!width && !height) {
      targetWidth = img.naturalWidth;
      targetHeight = img.naturalHeight;
    }

    canvas.width = targetWidth!;
    canvas.height = targetHeight!;

    // Use high-quality scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    
    ctx.drawImage(img, 0, 0, targetWidth!, targetHeight!);
    
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create blob'));
        }
      },
      'image/png',
      0.9
    );
  });
};

// Get logo URL from company settings
export const getLogoUrl = (branding: any, variant: 'original' | 'favicon' | 'header' = 'header'): string | null => {
  return branding?.logo?.[variant] || null;
};

// Format branding object for database storage
export const formatBrandingData = (logoVariants: LogoVariants) => {
  return {
    logo: logoVariants
  };
};