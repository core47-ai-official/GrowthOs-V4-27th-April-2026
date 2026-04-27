import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface VideoPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recordingTitle: string;
  recordingUrl: string;
}

// Sanitize video URLs by removing garbage prefixes
const sanitizeVideoUrl = (url: string): string => {
  if (!url) return '';
  
  let cleanUrl = url.trim();
  
  const garbagePrefixes = [
    'ChatGPT said:',
    'AI said:',
    'AI:',
    'Copy:',
    'Link:',
    'URL:',
  ];
  
  for (const prefix of garbagePrefixes) {
    if (cleanUrl.toLowerCase().startsWith(prefix.toLowerCase())) {
      cleanUrl = cleanUrl.substring(prefix.length).trim();
    }
  }
  
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return '';
  }
  
  return cleanUrl;
};

// Convert various video URLs to embeddable format
const convertToEmbedUrl = (url: string): string => {
  if (!url) return '';
  
  // Handle BunnyStream URLs
  if (url.includes('iframe.mediadelivery.net/embed/')) {
    const hasParams = url.includes('?');
    const bunnyParams = 'autoplay=true&loop=false&muted=false&preload=true&responsive=true';
    return hasParams ? `${url}&${bunnyParams}` : `${url}?${bunnyParams}`;
  }
  
  // If already an embed URL, return as is
  if (url.includes('youtube.com/embed/') || url.includes('youtu.be/embed/')) {
    return url;
  }
  
  // Extract video ID from various YouTube URL formats
  let videoId = '';
  
  if (url.includes('youtube.com/watch?v=')) {
    const match = url.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  } else if (url.includes('youtu.be/')) {
    const match = url.match(/youtu\.be\/([^?&]+)/);
    if (match) videoId = match[1];
  } else if (url.includes('youtube.com') && url.includes('v=')) {
    const match = url.match(/[?&]v=([^&]+)/);
    if (match) videoId = match[1];
  }
  
  if (videoId) {
    videoId = videoId.split('&')[0].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1`;
  }
  
  return url;
};

export function VideoPreviewDialog({ 
  open, 
  onOpenChange, 
  recordingTitle, 
  recordingUrl 
}: VideoPreviewDialogProps) {
  const { user } = useAuth();
  const [iframeKey, setIframeKey] = useState(0);
  const [videoError, setVideoError] = useState(false);
  
  const canSeeUrl = user?.role === 'superadmin' || user?.role === 'admin';

  // Compute embed URL directly
  const sanitizedUrl = sanitizeVideoUrl(recordingUrl);
  const embedUrl = open && sanitizedUrl ? convertToEmbedUrl(sanitizedUrl) : '';
  const isInvalidUrl = open && recordingUrl && !sanitizedUrl;

  // Reset state and force iframe recreation when dialog opens/closes
  useEffect(() => {
    if (open) {
      // Force a fresh iframe when dialog opens
      setVideoError(false);
      setIframeKey(prev => prev + 1);
    }
  }, [open, recordingUrl]);

  const handleReload = () => {
    setIframeKey(prev => prev + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="pr-8 truncate">{recordingTitle}</DialogTitle>
        </DialogHeader>
        
        <div className="relative">
          <div className="aspect-video bg-muted rounded-lg overflow-hidden">
            {isInvalidUrl || videoError ? (
              <div className="w-full h-full flex items-center justify-center bg-muted">
                <div className="text-center p-6">
                  <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
                  <p className="text-destructive font-medium mb-2">Invalid Video URL</p>
                  <p className="text-muted-foreground text-sm">
                    The video URL is not valid or cannot be embedded.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2 break-all max-w-md">
                    {recordingUrl}
                  </p>
                </div>
              </div>
            ) : (
              <iframe
                key={`preview-${iframeKey}`}
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                title={recordingTitle}
                frameBorder="0"
              />
            )}
          </div>
          
          {!isInvalidUrl && !videoError && (
            <Button
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2 opacity-70 hover:opacity-100"
              onClick={handleReload}
              title="Reload video"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {canSeeUrl && (
          <div className="text-xs text-muted-foreground break-all">
            <span className="font-medium">URL:</span> {recordingUrl}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
