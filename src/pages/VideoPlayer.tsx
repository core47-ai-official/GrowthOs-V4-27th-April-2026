import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, ArrowLeft, Play, Lock, MessageCircle, RefreshCw } from "lucide-react";
import SuccessPartner from "@/components/SuccessPartner";
import { LectureRating } from "@/components/LectureRating";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { safeMaybeSingle } from '@/lib/database-safety';
import { logger } from '@/lib/logger';
import CurrentModuleCard from "@/components/CurrentModuleCard";
import { obfuscateUrl, deobfuscateUrl } from "@/lib/utils";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";

// Sanitize video URLs by removing garbage prefixes
const sanitizeVideoUrl = (url: string): string => {
  if (!url) return '';
  
  let cleanUrl = url.trim();
  
  // Remove common garbage prefixes that may have been copy-pasted
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
  
  // Validate it's a proper URL
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return '';
  }
  
  return cleanUrl;
};

const VideoPlayer = () => {
  const {
    moduleId,
    lessonId
  } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading
  } = useAuth();
  const [showSuccessPartner, setShowSuccessPartner] = useState(false);
  const [checkedItems, setCheckedItems] = useState<{
    [key: number]: boolean;
  }>({});
  const [currentVideo, setCurrentVideo] = useState<any>(null);
  const [showRating, setShowRating] = useState(false);
  const [videoUrlError, setVideoUrlError] = useState(false);
  const [videoWatched, setVideoWatched] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [obfuscatedUrl, setObfuscatedUrl] = useState<string>("");
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  interface Attachment {
    id: string;
    file_name: string;
    file_url: string;
    uploaded_at: string;
  }
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  // Helper to extract URLs from description for attachments (simple auto-link)
  const extractLinks = (text: string): string[] => {
    const urlRegex = /(https?:\/\/[^\s)]+|www\.[^\s)]+)/g;
    return text ? (text.match(urlRegex) || []).map(u => u.startsWith('http') ? u : `http://${u}`) : [];
  };

  // Helper to convert YouTube URLs to embed format and add BunnyStream parameters
  const convertToEmbedUrl = (url: string): string => {
    if (!url) return '';
    
    // Handle BunnyStream URLs - add required parameters for proper playback
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
    
    // Standard YouTube URL: https://www.youtube.com/watch?v=VIDEO_ID
    if (url.includes('youtube.com/watch?v=')) {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) videoId = match[1];
    }
    // Short YouTube URL: https://youtu.be/VIDEO_ID
    else if (url.includes('youtu.be/')) {
      const match = url.match(/youtu\.be\/([^?&]+)/);
      if (match) videoId = match[1];
    }
    // YouTube URL with additional parameters
    else if (url.includes('youtube.com') && url.includes('v=')) {
      const match = url.match(/[?&]v=([^&]+)/);
      if (match) videoId = match[1];
    }
    
    // Clean video ID (remove any additional parameters)
    if (videoId) {
      videoId = videoId.split('&')[0].split('?')[0];
      return `https://www.youtube.com/embed/${videoId}`;
    }
    
    // If not a YouTube URL, return as is (for other video platforms)
    return url;
  };

  const attachmentLinks = currentVideo?.description ? extractLinks(currentVideo.description) : [];

  // Initialize video data from URL params or by ID
  useEffect(() => {
    const videoUrl = searchParams.get('url');
    const videoTitle = searchParams.get('title');
    const videoId = searchParams.get('id');
    const setFromParams = () => {
      if (videoUrl && videoTitle) {
        setCurrentVideo({
          id: videoId,
          title: decodeURIComponent(videoTitle),
          description: "Watch this lesson to continue your learning journey.",
          videoUrl: decodeURIComponent(videoUrl),
          duration: "N/A",
          module: "Current Module",
          checklist: ["Watch the complete video", "Take notes on key concepts", "Complete any related assignments", "Mark lesson as complete"]
        });
        return true;
      }
      return false;
    };
    const loadById = async (id: string) => {
      try {
        const {
          data,
          error
        } = await supabase.from('available_lessons').select('id, recording_title, recording_url, duration_min, module, notes').eq('id', id).maybeSingle();
        if (error) throw error;
        if (data) {
          // Resolve module name and course name from module UUID
          let moduleName = 'Module';
          let courseName = '';
          if (data.module) {
            const { data: moduleData } = await supabase
              .from('modules')
              .select('id, title, course_id')
              .eq('id', data.module)
              .maybeSingle();
            if (moduleData) {
              moduleName = moduleData.title || 'Module';
              if (moduleData.course_id) {
                const { data: courseData } = await supabase
                  .from('courses')
                  .select('title')
                  .eq('id', moduleData.course_id)
                  .maybeSingle();
                if (courseData) courseName = courseData.title || '';
              }
            }
          }
          setCurrentVideo({
            id: data.id,
            title: data.recording_title || 'Lesson',
            description: data.notes || 'Watch this lesson to continue your learning journey.',
            videoUrl: data.recording_url || '',
            duration: data.duration_min ? `${data.duration_min} min` : 'N/A',
            module: moduleName,
            moduleId: data.module,
            courseName: courseName,
            checklist: ['Watch the complete video', 'Take notes on key concepts', 'Complete any related assignments', 'Mark lesson as complete']
          });
          return;
        }
      } catch (e) {
        logger.error('VideoPlayer: failed to load by id', e);
      }
      // Fallback mock if not found
      setCurrentVideo({
        id: lessonId,
        title: 'Market Research Basics',
        description: 'Learn how to conduct effective market research to identify profitable niches and understand your target audience.',
        videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        duration: '18:20',
        module: 'Introduction to E-commerce',
        checklist: ['Identify your target market', 'Analyze market size and potential', 'Study competitor pricing strategies', 'Research customer pain points', 'Create buyer personas']
      });
    };

    // Prefer explicit params
    if (!setFromParams()) {
      if (videoId) {
        loadById(videoId);
      } else {
        // Legacy route fallback
        setCurrentVideo({
          id: lessonId,
          title: 'Market Research Basics',
          description: 'Learn how to conduct effective market research to identify profitable niches and understand your target audience.',
          videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
          duration: '18:20',
          module: 'Introduction to E-commerce',
          checklist: ['Identify your target market', 'Analyze market size and potential', 'Study competitor pricing strategies', 'Research customer pain points', 'Create buyer personas']
        });
      }
    }
  }, [searchParams, lessonId]);

  // Real watch tracking: mark watched only after meaningful playback.
  // Threshold = 30 seconds OR 25% of video duration, whichever comes first.
  // (Iframes from YouTube/BunnyStream don't expose playback events cross-origin,
  // so we use a wall-clock timer that starts when the iframe loads. This is a
  // pragmatic upgrade from the previous "mark watched on page load" behavior.)
  useEffect(() => {
    if (!user?.id || !currentVideo?.id) return;
    if (videoWatched) return;

    // Check if already marked watched in DB (grandfathered records stay watched)
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('recording_views')
        .select('watched')
        .eq('user_id', user.id)
        .eq('recording_id', currentVideo.id)
        .maybeSingle();
      if (!cancelled && data?.watched) {
        setVideoWatched(true);
      }
    })();

    // Compute threshold in ms: min(30s, 25% of duration)
    const durationMin = Number(currentVideo?.duration?.toString().match(/\d+/)?.[0]) || 0;
    const durationSec = durationMin * 60;
    const thresholdSec = durationSec > 0
      ? Math.min(30, Math.max(10, Math.round(durationSec * 0.25)))
      : 30;

    logger.info(`Watch threshold for ${currentVideo.id}: ${thresholdSec}s`);

    // Only count time when the tab is visible — pause if user switches away
    let elapsedMs = 0;
    let segmentStart = document.visibilityState === 'visible' ? Date.now() : 0;
    const targetMs = thresholdSec * 1000;

    const markWatched = async () => {
      try {
        await supabase.from('recording_views').upsert({
          user_id: user.id,
          recording_id: currentVideo.id,
          watched: true,
          watched_at: new Date().toISOString()
        }, { onConflict: 'user_id,recording_id' });
        if (!cancelled) {
          setVideoWatched(true);
          logger.info('Marked video watched after playback threshold:', currentVideo.id);
        }
      } catch (error) {
        logger.error('Error marking video watched:', error);
      }
    };

    const tick = () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible' && segmentStart > 0) {
        elapsedMs += Date.now() - segmentStart;
        segmentStart = Date.now();
      }
      if (elapsedMs >= targetMs) {
        clearInterval(interval);
        markWatched();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        segmentStart = Date.now();
      } else if (segmentStart > 0) {
        elapsedMs += Date.now() - segmentStart;
        segmentStart = 0;
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const interval = setInterval(tick, 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id, currentVideo?.id, currentVideo?.duration, videoWatched]);

  // Load attachments for current video
  useEffect(() => {
    const loadAttachments = async () => {
      if (!currentVideo?.id) return;
      try {
        const {
          data,
          error
        } = (await supabase.from('recording_attachments' as any).select('id, file_name, file_url, uploaded_at').eq('recording_id', currentVideo.id).order('uploaded_at', {
          ascending: false
        })) as any;
        if (!error) setAttachments(data as Attachment[] || []);
      } catch (e) {
        logger.error('Failed to load attachments', e);
      }
    };
    loadAttachments();
  }, [currentVideo?.id]);

  // Set iframe src via ref to hide URL from DOM
  useEffect(() => {
    if (currentVideo?.videoUrl && iframeRef.current) {
      // Sanitize the URL first
      const sanitizedUrl = sanitizeVideoUrl(currentVideo.videoUrl);
      
      if (!sanitizedUrl) {
        setVideoUrlError(true);
        logger.error('Invalid video URL detected:', currentVideo.videoUrl);
        return;
      }
      
      setVideoUrlError(false);
      const embedUrl = convertToEmbedUrl(sanitizedUrl);
      const encoded = obfuscateUrl(embedUrl);
      setObfuscatedUrl(encoded);
      
      // Set src via ref instead of JSX to hide from Elements tab
      iframeRef.current.src = embedUrl;
    }
    // Removed cleanup that was causing blank video issues
  }, [currentVideo?.videoUrl, iframeKey]);
  
  // modules list moved to CurrentModuleCard via useVideosData

  const handleChecklistToggle = (index: number) => {
    setCheckedItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };
  // Video selection handled by CurrentModuleCard

  const checkVideoCompletion = async () => {
    if (!user?.id || !currentVideo?.id) return;
    try {
      // Check if recording has been watched and no rating exists yet
      const watchedResult = await safeMaybeSingle(supabase.from('recording_views').select('watched').eq('user_id', user.id).eq('recording_id', currentVideo.id).eq('watched', true).maybeSingle() as any, `check if recording ${currentVideo.id} was watched by user ${user.id}`);
      const ratingResult = await safeMaybeSingle(supabase.from('recording_ratings' as any).select('id').eq('student_id', user.id).eq('recording_id', currentVideo.id).maybeSingle() as any, `check if recording ${currentVideo.id} was rated by user ${user.id}`);
      if (watchedResult.data && !ratingResult.data) {
        setShowRating(true);
      }
    } catch (error) {
      logger.error('Error checking video completion:', error);
    }
  };
  const handleMarkComplete = async () => {
    if (!user?.id || !currentVideo?.id) return;
    try {
      // Mark recording as watched
      await supabase.from('recording_views').upsert({
        user_id: user.id,
        recording_id: currentVideo.id,
        watched: true,
        watched_at: new Date().toISOString()
      });
      setVideoWatched(true);

      // Log video watched activity with course context
      const courseNameParam = searchParams.get('course') ? decodeURIComponent(searchParams.get('course') || '') : undefined;
      logUserActivity({
        user_id: user.id,
        activity_type: ACTIVITY_TYPES.VIDEO_WATCHED,
        reference_id: currentVideo.id,
        metadata: {
          video_title: currentVideo.title,
          module_name: currentVideo.module,
          course_name: courseNameParam || currentVideo.courseName || 'N/A',
          timestamp: new Date().toISOString()
        }
      });

      // Check if should show rating
      setTimeout(() => {
        checkVideoCompletion();
      }, 1000);
    } catch (error) {
      console.error('Error marking video complete:', error);
    }
  };
  return <div>
      <div className="flex items-center gap-3 mb-4">
        <Button variant="outline" size="sm" onClick={() => navigate('/videos')} className="flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Videos
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Video Player Section */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardContent className="p-0">
              <div className="aspect-video bg-gray-900 rounded-t-lg relative">
                {videoUrlError ? (
                  <div className="w-full h-full flex items-center justify-center bg-muted rounded-t-lg">
                    <div className="text-center p-6">
                      <p className="text-destructive font-medium mb-2">Video URL is invalid</p>
                      <p className="text-muted-foreground text-sm">Please contact support to fix this video.</p>
                    </div>
                  </div>
                ) : currentVideo && (
                  <>
                    <iframe 
                      key={`video-${currentVideo.id}-${iframeKey}`}
                      ref={iframeRef}
                      className="w-full h-full rounded-t-lg" 
                      allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture" 
                      allowFullScreen 
                      title={currentVideo.title}
                      frameBorder="0"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 opacity-70 hover:opacity-100"
                      onClick={() => setIframeKey(prev => prev + 1)}
                      title="Reload video if not playing"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
              <div className="p-6">
                <h2 className="text-2xl font-bold mb-2">{currentVideo?.title}</h2>
                <h3 className="font-semibold mb-2 text-base">Description</h3>
                <p className="mb-4 text-black text-left text-sm">{currentVideo?.description}</p>

                {attachments.length > 0 && <div className="mb-4">
                    <h3 className="font-semibold mb-2 text-base">Attachments</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {attachments.map(att => <li key={att.id}>
                          <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {att.file_name}
                          </a>
                        </li>)}
                    </ul>
                  </div>}
                
                {attachmentLinks.length > 0 && <div className="mb-4">
                    <h3 className="text-sm font-semibold mb-2">Links mentioned</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {attachmentLinks.map((link, idx) => <li key={idx}>
                          <a href={link} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                            {link}
                          </a>
                        </li>)}
                    </ul>
                  </div>}
                

                {/* Lecture Rating - Shows after video is marked complete */}
                {showRating && currentVideo && <LectureRating recordingId={currentVideo.id} lessonTitle={currentVideo.title} />}

                <div className="mt-8 flex justify-center">
                  <Button size="sm" onClick={handleMarkComplete} disabled={videoWatched}>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {videoWatched ? 'Completed' : 'Mark Complete'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Success Partner Assistant - Hidden on mobile */}
          <Card className="hidden sm:block bg-gradient-to-r from-blue-50 to-green-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-green-600 rounded-full mr-2 flex items-center justify-center">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
                Success Partner
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                I'm here to help! Ask me anything about this video or your learning journey.
              </p>
              <Button 
                size="sm" 
                className="w-full" 
                onClick={() => setShowSuccessPartner(true)}
                disabled={authLoading || !user?.id || !user?.email}
              >
                {authLoading ? 'Loading...' : 'Ask Partner'}
              </Button>
            </CardContent>
          </Card>

          {/* Module Progress - current module only */}
          <CurrentModuleCard currentVideoId={currentVideo?.id} />

        </div>
      </div>

      {showSuccessPartner && !authLoading && user?.id && user?.email && (
        <SuccessPartner 
          onClose={() => setShowSuccessPartner(false)}
          user={{
            id: user.id,
            full_name: user.full_name || user.email.split('@')[0] || 'Student',
            email: user.email
          }}
        />
      )}
    </div>;
  };
export default VideoPlayer;