import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Star } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { logger } from '@/lib/logger';
import { safeQuery } from '@/lib/database-safety';
import type { RecordingRatingResult } from '@/types/database';

interface LectureRatingProps {
  recordingId: string;
  lessonTitle: string;
  isModalOpen?: boolean;
  onClose?: () => void;
  mandatory?: boolean;
}

export function LectureRating({ 
  recordingId, 
  lessonTitle, 
  isModalOpen = false, 
  onClose,
  mandatory = false 
}: LectureRatingProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedback, setFeedback] = useState('');
  const [hasRated, setHasRated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkExistingRating();
  }, [recordingId, user?.id]);

  const checkExistingRating = async () => {
    if (!user?.id) return;

    try {
      const result = await safeQuery<RecordingRatingResult>(
        supabase
          .from('recording_ratings')
          .select('*')
          .eq('student_id', user.id)
          .eq('recording_id', recordingId)
          .single(),
        `check existing rating for recording ${recordingId}`
      );

      if (result.success && result.data) {
        setHasRated(true);
        setRating(result.data.rating);
        setFeedback(result.data.feedback || '');
      }
    } catch (error) {
      // No existing rating found, which is fine
    }
  };

  const submitRating = async () => {
    if (!user?.id || rating === 0) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('recording_ratings')
        .upsert({
          student_id: user.id,
          recording_id: recordingId,
          lesson_title: lessonTitle,
          rating,
          feedback: feedback.trim() || null
        });

      if (error) throw error;

      setHasRated(true);
      toast({
        title: 'Rating Submitted',
        description: 'Thank you for your feedback!'
      });

      if (onClose) onClose();
    } catch (error) {
      logger.error('Error submitting rating:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit rating. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    const key = parseInt(event.key);
    if (key >= 1 && key <= 5) {
      setRating(key);
    }
  };

  const renderStars = (size = 'w-8 h-8') => (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="p-1 hover:scale-110 transition-transform focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
          onMouseEnter={() => !hasRated && setHoverRating(star)}
          onMouseLeave={() => !hasRated && setHoverRating(0)}
          onClick={() => !hasRated && setRating(star)}
          disabled={hasRated}
          aria-label={`Rate ${star} stars`}
        >
          <Star
            className={`${size} ${
              star <= (hoverRating || rating)
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-gray-300 hover:text-yellow-200'
            } ${hasRated ? 'cursor-default' : 'cursor-pointer'}`}
          />
        </button>
      ))}
    </div>
  );

  const renderContent = () => (
    <div className="space-y-4">
      <div className="text-center">
        <p className="text-sm text-muted-foreground mb-3">
          {hasRated 
            ? `You rated "${lessonTitle}"` 
            : mandatory 
            ? `Please rate "${lessonTitle}" to continue`
            : "Please rate your experience to help us improve"
          }
        </p>
        
        {renderStars()}

        {!hasRated && !mandatory && (
          <p className="text-xs text-muted-foreground mt-2">
            Use keys 1-5 or click to rate
          </p>
        )}
      </div>

      {!mandatory && !hasRated && (
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Additional feedback (optional)
          </label>
          <Textarea
            placeholder="Share what you liked or suggestions for improvement..."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            rows={3}
          />
        </div>
      )}

      {hasRated && feedback && (
        <div>
          <span className="text-sm font-medium">Your feedback:</span>
          <p className="text-sm text-muted-foreground mt-1">{feedback}</p>
        </div>
      )}

      <Button
        onClick={hasRated ? onClose : submitRating}
        disabled={!hasRated && (rating === 0 || loading)}
        className="w-full"
      >
        {loading ? 'Submitting...' : hasRated ? 'Close' : 'Submit Rating'}
      </Button>
    </div>
  );

  // Modal mode for mandatory ratings
  if (isModalOpen) {
    return (
      <Dialog open={isModalOpen} onOpenChange={() => {}}>
        <DialogContent 
          className="sm:max-w-md"
          onKeyDown={handleKeyPress}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-center text-xl font-semibold">
              {hasRated ? 'Your Rating' : 'Rate this Recording'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {renderContent()}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (hasRated) {
    return (
      <Card className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-lg text-green-800">
            ✅ Rating Submitted
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Your rating:</span>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`w-5 h-5 ${
                  star <= rating
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          {feedback && (
            <div>
              <span className="text-sm font-medium">Your feedback:</span>
              <p className="text-sm text-muted-foreground mt-1">{feedback}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
      <CardHeader>
        <CardTitle className="text-lg text-orange-800">
          🌟 Rate This Lesson
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground mb-3">
            You've completed this lesson! Please rate your experience to help us improve.
          </p>
          
          <div className="flex items-center gap-1 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 hover:scale-110 transition-transform"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= (hoverRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300 hover:text-yellow-200'
                  }`}
                />
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Additional feedback (optional)
            </label>
            <Textarea
              placeholder="Share what you liked or suggestions for improvement..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <Button
          onClick={submitRating}
          disabled={rating === 0 || loading}
          className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
        >
          {loading ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </CardContent>
    </Card>
  );
}