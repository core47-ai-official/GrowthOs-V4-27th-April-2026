import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface StudentSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: {
    id: string;
    name: string;
    description?: string;
  };
  userId: string;
  hasSubmitted?: boolean;
  onSubmissionComplete?: () => void;
}

export const StudentSubmissionDialog = ({ 
  open, 
  onOpenChange, 
  assignment,
  userId,
  hasSubmitted = false,
  onSubmissionComplete
}: StudentSubmissionDialogProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      toast({
        title: "Error",
        description: "Please enter your assignment response.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('submissions')
        .insert({
          assignment_id: assignment.id,
          student_id: userId,
          content: content.trim(),
          status: 'pending'
        });

      if (error) throw error;

      // Auto-mark the linked recording as watched
      try {
        const { data: linkedRecording } = await supabase
          .from('available_lessons')
          .select('id')
          .eq('assignment_id', assignment.id)
          .maybeSingle();
        if (linkedRecording) {
          await supabase.from('recording_views').upsert({
            user_id: userId,
            recording_id: linkedRecording.id,
            watched: true,
            watched_at: new Date().toISOString()
          }, { onConflict: 'user_id,recording_id' });
        }
      } catch (e) {
        console.error('Failed to auto-mark recording watched:', e);
      }

      toast({
        title: "Assignment Submitted",
        description: "Your assignment has been successfully submitted for review.",
      });

      setContent("");
      onOpenChange(false);
      onSubmissionComplete?.();
    } catch (error) {
      console.error('Submission error:', error);
      toast({
        title: "Submission Error",
        description: "Failed to submit assignment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {assignment.name}
          </p>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {hasSubmitted ? (
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle className="w-4 h-4" />
                  <p className="text-sm font-medium">
                    Assignment already submitted and under review
                  </p>
                </div>
              ) : (
                <>
                  {assignment.description && (
                    <p className="text-sm text-muted-foreground mb-3">
                      {assignment.description}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Complete the assignment and submit your work below.
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {!hasSubmitted && (
            <>
              <div className="space-y-3">
                <label htmlFor="content" className="block text-sm font-medium">
                  Your Response
                </label>
                <Textarea
                  id="content"
                  placeholder="Enter your assignment response here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={8}
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Assignment"}
                </Button>
              </div>
            </>
          )}

          {hasSubmitted && (
            <div className="flex justify-end pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};