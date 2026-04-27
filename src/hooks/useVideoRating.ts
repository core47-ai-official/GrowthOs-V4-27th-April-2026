import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { safeLogger } from '@/lib/safe-logger';

interface UseVideoRatingProps {
  recordingId: string;
  lessonTitle: string;
}

export function useVideoRating({ recordingId, lessonTitle }: UseVideoRatingProps) {
  const { user } = useAuth();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const [videoCompleted, setVideoCompleted] = useState(false);

  useEffect(() => {
    if (user?.id && recordingId) {
      checkExistingRating();
    }
  }, [user?.id, recordingId]);

  const checkExistingRating = async () => {
    if (!user?.id) return;

    try {
      const { data } = await supabase
        .from('recording_ratings')
        .select('id')
        .eq('student_id', user.id)
        .eq('recording_id', recordingId)
        .maybeSingle();

      setHasRated(!!data);
    } catch (error) {
      setHasRated(false);
    }
  };

  const handleVideoComplete = () => {
    setVideoCompleted(true);
    if (!hasRated && user?.role === 'student') {
      setShowRatingModal(true);
    }
  };

  const handleRatingSubmitted = () => {
    setHasRated(true);
    setShowRatingModal(false);
  };

  const closeRatingModal = () => {
    if (hasRated) {
      setShowRatingModal(false);
    }
  };

  return {
    showRatingModal,
    hasRated,
    videoCompleted,
    handleVideoComplete,
    handleRatingSubmitted,
    closeRatingModal
  };
}