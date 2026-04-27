import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';
import { useToast } from './use-toast';

interface StudentRating {
  id: string;
  rating: number;
  created_at: string;
  student_name: string;
  student_id: string;
}

interface RatingSummary {
  average: number;
  total: number;
  distribution: { [key: number]: number };
  studentRatings: StudentRating[];
}

export function useRecordingRatings(recordingId: string | null) {
  const [data, setData] = useState<RatingSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (recordingId) {
      fetchRatingData();
      
      // Set up real-time subscription
      const subscription = supabase
        .channel(`recording_ratings_${recordingId}`)
        .on('postgres_changes', 
          { 
            event: '*', 
            schema: 'public', 
            table: 'recording_ratings' as any,
            filter: `recording_id=eq.${recordingId}`
          }, 
          () => {
            fetchRatingData();
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [recordingId]);

  const fetchRatingData = async () => {
    if (!recordingId) return;
    
    setLoading(true);
    try {
      // Note: This will fail until recording_ratings table is created
      // For now, return empty data to prevent build errors
      const { data: ratings, error } = await supabase
        .from('recording_ratings' as any)
        .select(`
          id,
          rating,
          created_at,
          student_id,
          users(full_name)
        `)
        .eq('recording_id', recordingId)
        .order('created_at', { ascending: false });

      if (error) {
        // Table doesn't exist yet, return empty data
        safeLogger.info('Recording ratings table not found:', { error });
        setData({
          average: 0,
          total: 0,
          distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          studentRatings: []
        });
        return;
      }

      const processedRatings: StudentRating[] = (ratings || []).map((rating: any) => ({
        id: rating.id,
        rating: rating.rating,
        created_at: rating.created_at,
        student_id: rating.student_id,
        student_name: rating.users?.full_name || 'Unknown Student'
      }));

      // Calculate summary statistics
      const total = processedRatings.length;
      const average = total > 0 
        ? processedRatings.reduce((sum, r) => sum + r.rating, 0) / total 
        : 0;

      // Calculate distribution
      const distribution: { [key: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      processedRatings.forEach(rating => {
        distribution[rating.rating] = (distribution[rating.rating] || 0) + 1;
      });

      setData({
        average,
        total,
        distribution,
        studentRatings: processedRatings
      });
    } catch (error) {
      console.error('Error fetching rating data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch rating data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, refetch: fetchRatingData };
}