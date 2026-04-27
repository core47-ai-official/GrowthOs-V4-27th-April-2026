import { Star, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useRecordingRatings } from '@/hooks/useRecordingRatings';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { safeLogger } from '@/lib/safe-logger';

interface RecordingRatingDetailsProps {
  recordingId: string;
  recordingTitle: string;
  onDelete: () => void;
}

export function RecordingRatingDetails({ recordingId, recordingTitle, onDelete }: RecordingRatingDetailsProps) {
  const { data, loading } = useRecordingRatings(recordingId);
  const { toast } = useToast();

  const handleDeleteRecording = async () => {
    try {
      // First try to delete any ratings for this recording
      try {
        await supabase
          .from('recording_ratings' as any)
          .delete()
          .eq('recording_id', recordingId);
      } catch (ratingsError) {
        safeLogger.info('No ratings to delete or table not found:', { ratingsError });
      }

      const { error } = await supabase
        .from('available_lessons')
        .delete()
        .eq('id', recordingId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Recording deleted successfully"
      });
      
      onDelete();
    } catch (error) {
      console.error('Error deleting recording:', error);
      toast({
        title: "Error",
        description: "Failed to delete recording",
        variant: "destructive"
      });
    }
  };

  const downloadCSV = () => {
    if (!data) return;

    const csvContent = [
      ['Student Name', 'Rating', 'Rated On'],
      ...data.studentRatings.map(rating => [
        rating.student_name,
        rating.rating.toString(),
        new Date(rating.created_at).toLocaleDateString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordingTitle}_ratings.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4 bg-gray-50 border-l-4 border-primary">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6 bg-gray-50 border-l-4 border-primary">
        <div className="flex items-center justify-between mb-4">
          <p className="text-muted-foreground">No rating data available</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Recording
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete "{recordingTitle}". 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleDeleteRecording}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete Recording
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        <p className="text-xs text-muted-foreground">
          Rating system will be available after database migration is complete.
        </p>
      </div>
    );
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
        }`}
      />
    ));
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 border-l-4 border-primary">
      {/* Rating Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-lg">Rating Summary</h4>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={downloadCSV}
              className="hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Recording
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Recording</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete "{recordingTitle}" and all its ratings. 
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDeleteRecording}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete Recording
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex">{renderStars(Math.round(data.average))}</div>
              <span className="font-semibold text-lg">{data.average.toFixed(1)}</span>
              <span className="text-muted-foreground">({data.total} ratings)</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <h5 className="font-medium">Rating Distribution</h5>
            {[5, 4, 3, 2, 1].map(star => (
              <div key={star} className="flex items-center gap-2 text-sm">
                <span className="w-8">{star}★</span>
                <Progress 
                  value={(data.distribution[star] / data.total) * 100} 
                  className="flex-1 h-2"
                />
                <span className="w-8 text-right">{data.distribution[star]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Student Ratings Table */}
      <div className="space-y-4">
        <h4 className="font-semibold text-lg">Student Ratings</h4>
        {data.studentRatings.length === 0 ? (
          <p className="text-muted-foreground">No student ratings yet</p>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-white">
                  <TableHead>Student Name</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Rated On</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.studentRatings.map((rating) => (
                  <TableRow key={rating.id} className="bg-white hover:bg-gray-50">
                    <TableCell className="font-medium">{rating.student_name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex">{renderStars(rating.rating)}</div>
                        <Badge variant="outline">{rating.rating}/5</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(rating.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}