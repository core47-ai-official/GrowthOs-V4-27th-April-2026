import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

interface CoverImageUploadProps {
  currentImageUrl: string;
  onImageChange: (url: string) => void;
  type: 'course' | 'pathway';
  entityId?: string;
}

const BUCKET = 'cover-images';

export function CoverImageUpload({ 
  currentImageUrl, 
  onImageChange, 
  type,
  entityId 
}: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, WebP)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 5MB",
        variant: "destructive"
      });
      return;
    }

    try {
      setUploading(true);

      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${type}/${entityId || 'new'}-${Date.now()}.${fileExt}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, file, {
          upsert: true,
          cacheControl: '3600'
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;
      
      setPreview(publicUrl);
      onImageChange(publicUrl);

      toast({
        title: "Image uploaded",
        description: "Cover image has been uploaded successfully"
      });
    } catch (error) {
      logger.error('Error uploading cover image:', error);
      toast({
        title: "Upload failed",
        description: "Failed to upload image. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
      // Reset the input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setPreview(null);
    onImageChange('');
  };

  return (
    <div className="space-y-3">
      <Label>Cover Image</Label>
      
      {preview ? (
        <div className="relative rounded-lg overflow-hidden border bg-muted">
          <img 
            src={preview} 
            alt="Cover preview" 
            className="w-full h-32 object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2 h-7 w-7"
            onClick={handleRemoveImage}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div 
          className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="p-2 rounded-full bg-primary/10">
              <ImageIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium">Click to upload cover image</p>
              <p className="text-xs text-muted-foreground">JPG, PNG, WebP (max 5MB)</p>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {!preview && (
        <div className="flex gap-2">
          <Input
            placeholder="Or paste image URL..."
            value={currentImageUrl}
            onChange={(e) => {
              onImageChange(e.target.value);
              setPreview(e.target.value || null);
            }}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </Button>
        </div>
      )}

      {/* Resolution guidelines */}
      <div className="text-xs text-muted-foreground space-y-1 bg-muted/50 p-2 rounded-md">
        <p className="font-medium">Recommended Image Dimensions:</p>
        <p>• <span className="font-medium">Desktop:</span> 1280 × 720 px (16:9 aspect ratio)</p>
        <p>• <span className="font-medium">Mobile:</span> 640 × 360 px (16:9 aspect ratio)</p>
        <p className="text-muted-foreground/80">Images will be auto-resized to fit. Use high-resolution images for best quality.</p>
      </div>
    </div>
  );
}
