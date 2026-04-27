import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Loader2 } from 'lucide-react';

interface OnboardingVideoModalProps {
  videoUrl: string;
  userId: string;
  onComplete: () => void;
}

export const OnboardingVideoModal: React.FC<OnboardingVideoModalProps> = ({
  videoUrl,
  userId,
  onComplete
}) => {
  const [videoCompleted, setVideoCompleted] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showManualConfirm, setShowManualConfirm] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const videoType = getVideoType(videoUrl);

  // Show manual confirm button after 30 seconds as fallback
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowManualConfirm(true);
      console.log('Manual confirm button enabled after 30 seconds');
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  function getVideoType(url: string): 'youtube' | 'vimeo' | 'bunny' | 'direct' {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    }
    if (url.includes('vimeo.com')) {
      return 'vimeo';
    }
    if (url.includes('bunnycdn.com') || url.includes('mediadelivery.net')) {
      return 'bunny';
    }
    return 'direct';
  }

  function getBunnyEmbedUrl(url: string): string {
    // If already an embed URL, return as is
    if (url.includes('iframe.mediadelivery.net/embed')) {
      return url;
    }
    // If it's a video.bunnycdn.com URL, convert to embed
    if (url.includes('video.bunnycdn.com/play')) {
      const videoId = url.match(/play\/(\d+)\/([^/]+)/);
      if (videoId) {
        return `https://iframe.mediadelivery.net/embed/${videoId[1]}/${videoId[2]}?autoplay=true&preload=true`;
      }
    }
    // Otherwise return as is and hope it works
    return url;
  }

  function getYouTubeEmbedUrl(url: string): string {
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1`;
  }

  function getVimeoEmbedUrl(url: string): string {
    const videoId = url.match(/vimeo\.com\/(\d+)/)?.[1];
    return `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0`;
  }

  useEffect(() => {
    // Log all postMessage events for debugging
    const handleAllMessages = (event: MessageEvent) => {
      console.log('PostMessage received:', {
        origin: event.origin,
        data: event.data,
        videoType
      });
    };

    window.addEventListener('message', handleAllMessages);

    if (videoType === 'youtube') {
      // YouTube iframe API
      const handleMessage = (event: MessageEvent) => {
        if (event.origin === 'https://www.youtube.com') {
          try {
            const data = JSON.parse(event.data);
            console.log('YouTube event:', data);
            if (data.event === 'onStateChange' && data.info === 0) {
              // Video ended (state 0)
              console.log('YouTube video completed!');
              setVideoCompleted(true);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('message', handleAllMessages);
      };
    } else if (videoType === 'vimeo') {
      // Vimeo player API
      const handleMessage = (event: MessageEvent) => {
        if (event.origin === 'https://player.vimeo.com') {
          try {
            const data = JSON.parse(event.data);
            console.log('Vimeo event:', data);
            if (data.event === 'ended') {
              console.log('Vimeo video completed!');
              setVideoCompleted(true);
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('message', handleAllMessages);
      };
    } else if (videoType === 'bunny') {
      // Bunny Stream player API - with enhanced detection
      const handleMessage = (event: MessageEvent) => {
        if (event.origin.includes('mediadelivery.net') || event.origin.includes('bunnycdn.com')) {
          console.log('Bunny Stream event:', event.data);
          try {
            const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
            // Try multiple detection methods for Bunny Stream
            if (data.event === 'ended' || 
                data.type === 'ended' || 
                data === 'ended' ||
                data.event === 'timeupdate' && data.duration && data.currentTime >= data.duration - 1) {
              console.log('Bunny Stream video completed!');
              setVideoCompleted(true);
            }
          } catch (e) {
            // If it's just a string "ended", handle it
            if (event.data === 'ended') {
              console.log('Bunny Stream video completed (string)!');
              setVideoCompleted(true);
            }
          }
        }
      };

      window.addEventListener('message', handleMessage);
      return () => {
        window.removeEventListener('message', handleMessage);
        window.removeEventListener('message', handleAllMessages);
      };
    }

    return () => window.removeEventListener('message', handleAllMessages);
  }, [videoType]);

  const handleVideoEnd = () => {
    console.log('Direct video ended');
    setVideoCompleted(true);
  };

  const handleContinue = async () => {
    console.log('Continue button clicked', { userId, videoCompleted, isUpdating });
    setIsUpdating(true);

    try {
      console.log('Updating student record...');
      
      // First check if record exists
      const { data: existingStudent, error: checkError } = await supabase
        .from('students')
        .select('id, user_id, onboarding_video_watched')
        .eq('user_id', userId)
        .maybeSingle();
      
      console.log('Existing student record:', existingStudent, 'Check error:', checkError);
      
      if (checkError) {
        console.error('Error checking student record:', checkError);
        throw new Error('Could not verify your student record');
      }
      
      if (!existingStudent) {
        throw new Error('Student record not found');
      }
      
      // Now update
      const { data, error } = await supabase
        .from('students')
        .update({ onboarding_video_watched: true })
        .eq('user_id', userId)
        .select();

      console.log('Update result:', { data, error });

      if (error) {
        console.error('Database error:', error);
        throw new Error(error.message || 'Database update failed');
      }
      
      if (!data || data.length === 0) {
        throw new Error('Update did not affect any records');
      }

      console.log('Successfully updated, calling onComplete');
      
      toast({
        title: "Welcome!",
        description: "Redirecting to your dashboard...",
      });

      // Wait a moment before calling onComplete
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error) {
      console.error('Error updating video watch status:', error);
      toast({
        variant: "destructive",
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update your progress. Please try again.",
      });
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={true} modal>
      <DialogContent 
        className="max-w-4xl p-0 gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-2xl font-semibold">
            Welcome! Watch this video to get started
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Please watch the complete video before continuing to your dashboard
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-6">

          <div className="aspect-video bg-black rounded-lg overflow-hidden">
            {videoType === 'youtube' && (
              <iframe
                ref={iframeRef}
                src={getYouTubeEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {videoType === 'vimeo' && (
              <iframe
                ref={iframeRef}
                src={getVimeoEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            )}

            {videoType === 'bunny' && (
              <iframe
                ref={iframeRef}
                src={getBunnyEmbedUrl(videoUrl)}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}

            {videoType === 'direct' && (
              <video
                ref={videoRef}
                src={videoUrl}
                className="w-full h-full"
                controls
                autoPlay
                muted={false}
                playsInline
                onEnded={handleVideoEnd}
                onError={(e) => {
                  console.error('Video error:', e);
                  toast({
                    variant: "destructive",
                    title: "Video Error",
                    description: "Unable to load the video. Please contact support.",
                  });
                }}
                onLoadStart={() => console.log('Video loading started')}
                onCanPlay={() => console.log('Video can play')}
              >
                Your browser does not support the video tag.
              </video>
            )}
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2 text-sm">
              {videoCompleted ? (
                <>
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-600 font-medium">Video completed!</span>
                </>
              ) : showManualConfirm ? (
                <span className="text-amber-600 text-xs">
                  If you've finished watching, click the button to continue
                </span>
              ) : (
                <span className="text-muted-foreground">Please watch the entire video</span>
              )}
            </div>

            <Button
              onClick={handleContinue}
              disabled={(!videoCompleted && !showManualConfirm) || isUpdating}
              size="lg"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Please wait...
                </>
              ) : (
                'Continue to Dashboard'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
