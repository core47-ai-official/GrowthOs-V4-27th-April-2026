import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Star, Download } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RecordingAnalyticsProps {
  recordingId: string;
  recordingTitle: string;
}

interface RatingData {
  average: number;
  total: number;
  distribution: { [key: number]: number };
  ratings: Array<{
    id: string;
    rating: number;
    feedback: string;
    created_at: string;
    user_name: string;
  }>;
}

export function RecordingAnalytics({ recordingId, recordingTitle }: RecordingAnalyticsProps) {
  const { toast } = useToast();
  const [ratingData, setRatingData] = useState<RatingData>({
    average: 0,
    total: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    ratings: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRatingData();
    
    // Set up real-time subscription
    const subscription = supabase
      .channel('rating_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'recording_ratings',
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
  }, [recordingId]);

  const fetchRatingData = async () => {
    try {
      const { data: ratings, error } = await supabase
        .from('recording_ratings' as any)
        .select(`
          id,
          rating,
          feedback,
          created_at,
          user_id
        `)
        .eq('recording_id', recordingId);

      if (error) throw error;

      const processedRatings = ratings.map((r: any) => ({
        id: r.id,
        rating: r.rating,
        feedback: r.feedback || '',
        created_at: r.created_at,
        user_name: 'Student'
      }));

      // Calculate statistics
      const total = ratings.length;
      const average = total > 0 ? ratings.reduce((sum: number, r: any) => sum + r.rating, 0) / total : 0;
      
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      ratings.forEach((r: any) => {
        distribution[r.rating]++;
      });

      setRatingData({
        average: Math.round(average * 10) / 10,
        total,
        distribution,
        ratings: processedRatings
      });
    } catch (error) {
      console.error('Error fetching rating data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load rating data',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadCSV = () => {
    const headers = ['Student Name', 'Rating', 'Feedback', 'Date'];
    const csvContent = [
      headers.join(','),
      ...ratingData.ratings.map(rating => [
        `"${rating.user_name}"`,
        rating.rating,
        `"${rating.feedback.replace(/"/g, '""')}"`,
        new Date(rating.created_at).toLocaleDateString()
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordingTitle.replace(/[^a-z0-9]/gi, '_')}_ratings.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Download Started',
      description: 'Rating data CSV file is being downloaded'
    });
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Rating Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading rating data...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 justify-between">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            Rating Analytics
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={downloadCSV}
            disabled={ratingData.total === 0}
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {ratingData.total === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No ratings yet for this recording
          </div>
        ) : (
          <>
            {/* Overall Rating */}
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-6 h-6 ${
                        star <= Math.round(ratingData.average)
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold">{ratingData.average}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Based on {ratingData.total} rating{ratingData.total !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Rating Distribution */}
            <div className="space-y-3">
              <h4 className="font-medium">Rating Distribution</h4>
              {[5, 4, 3, 2, 1].map((rating) => (
                <div key={rating} className="flex items-center gap-3">
                  <div className="flex items-center gap-1 w-12">
                    <span className="text-sm">{rating}</span>
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                  </div>
                  <div className="flex-1">
                    <Progress 
                      value={ratingData.total > 0 ? (ratingData.distribution[rating] / ratingData.total) * 100 : 0}
                      className="h-2"
                    />
                  </div>
                  <span className="text-sm text-muted-foreground w-8">
                    {ratingData.distribution[rating]}
                  </span>
                </div>
              ))}
            </div>

            {/* Recent Feedback */}
            {ratingData.ratings.some(r => r.feedback) && (
              <div className="space-y-3">
                <h4 className="font-medium">Recent Feedback</h4>
                <div className="max-h-60 overflow-y-auto space-y-3">
                  {ratingData.ratings
                    .filter(r => r.feedback)
                    .slice(0, 5)
                    .map((rating) => (
                      <div key={rating.id} className="p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-3 h-3 ${
                                  star <= rating.rating
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            by {rating.user_name}
                          </span>
                        </div>
                        <p className="text-sm">{rating.feedback}</p>
                        <span className="text-xs text-muted-foreground">
                          {new Date(rating.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}