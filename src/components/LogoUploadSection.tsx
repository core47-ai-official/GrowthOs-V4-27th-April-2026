import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, Eye, AlertTriangle, CheckCircle, X } from "lucide-react";
import { useState, useRef } from "react";
import { validateLogo, generateLogoVariants, LogoValidationResult } from "@/utils/logoUtils";
import { supabase } from "@/integrations/supabase/client";

interface LogoUploadSectionProps {
  currentLogo: string | null;
  onLogoUpdate: (branding: any) => void;
}

export function LogoUploadSection({ currentLogo, onLogoUpdate }: LogoUploadSectionProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [validation, setValidation] = useState<LogoValidationResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    
    // Validate the file
    const validationResult = await validateLogo(file);
    setValidation(validationResult);
  };

  const handleUpload = async () => {
    if (!selectedFile || !validation?.isValid) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const fileExt = selectedFile.name.split('.').pop();
      
      // Upload original file
      const originalPath = `logos/original-${timestamp}.${fileExt}`;
      const { error: originalError } = await supabase.storage
        .from('company-branding')
        .upload(originalPath, selectedFile);

      if (originalError) throw originalError;

      // Generate and upload variants
      const variants = await generateLogoVariants(selectedFile);
      
      // Upload favicon variant
      const faviconPath = `logos/favicon-${timestamp}.png`;
      const { error: faviconError } = await supabase.storage
        .from('company-branding')
        .upload(faviconPath, variants[0]);

      if (faviconError) throw faviconError;

      // Upload header variant
      const headerPath = `logos/header-${timestamp}.png`;
      const { error: headerError } = await supabase.storage
        .from('company-branding')
        .upload(headerPath, variants[1]);

      if (headerError) throw headerError;

      // Get public URLs
      const { data: originalUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(originalPath);

      const { data: faviconUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(faviconPath);

      const { data: headerUrl } = supabase.storage
        .from('company-branding')
        .getPublicUrl(headerPath);

      // Update company settings with branding data
      const brandingData = {
        logo: {
          original: originalUrl.publicUrl,
          favicon: faviconUrl.publicUrl,
          header: headerUrl.publicUrl
        }
      };

      // Update company settings directly instead of using RPC
      const { error: updateError } = await supabase
        .from('company_settings')
        .upsert({ id: 1, branding: brandingData, updated_at: new Date().toISOString() });

      if (updateError) throw updateError;

      onLogoUpdate(brandingData);
      
      toast({
        title: "Logo uploaded successfully",
        description: "Your company logo has been updated across all applications.",
      });

      // Reset form
      setSelectedFile(null);
      setPreviewUrl(null);
      setValidation(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (error: any) {
      console.error('Logo upload error:', error);
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setValidation(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Company Logo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Logo Display */}
        {currentLogo && !previewUrl && (
          <div className="flex items-center gap-3 p-3 border rounded-lg bg-muted/20">
            <img 
              src={currentLogo} 
              alt="Current logo" 
              className="w-12 h-12 object-contain border rounded"
            />
            <span className="text-sm text-muted-foreground">Current company logo</span>
          </div>
        )}

        {/* File Input */}
        <div className="space-y-2">
          <Label htmlFor="logo-upload">Upload Logo (PNG/JPG, max 5MB, square format recommended)</Label>
          <Input
            ref={fileInputRef}
            id="logo-upload"
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            onChange={handleFileSelect}
            className="cursor-pointer"
          />
        </div>

        {/* Preview and Actions */}
        {selectedFile && (
          <div className="space-y-3">
            {/* Compact Preview */}
            <div className="flex items-center gap-4 p-3 border rounded-lg bg-muted/20">
              <img 
                src={previewUrl!} 
                alt="Logo preview" 
                className="w-12 h-12 object-contain border rounded"
              />
              <div className="flex-1">
                <div className="text-sm font-medium">Preview</div>
                <div className="text-xs text-muted-foreground">
                  Will be used for favicon, headers, and branding
                </div>
              </div>
            </div>

            {/* Simplified Validation */}
            {validation && validation.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  {validation.errors.join('. ')}
                </AlertDescription>
              </Alert>
            )}

            {validation && validation.isValid && validation.errors.length === 0 && (
              <div className="text-sm text-green-600 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Ready to upload
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                disabled={!validation?.isValid || isUploading}
                className="flex-1"
                size="sm"
              >
                {isUploading ? "Uploading..." : "Upload Logo"}
              </Button>
              <Button
                variant="outline"
                onClick={clearSelection}
                disabled={isUploading}
                size="sm"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}