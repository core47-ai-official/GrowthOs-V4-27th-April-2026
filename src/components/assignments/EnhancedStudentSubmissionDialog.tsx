import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Upload, Link, FileText, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { logUserActivity, ACTIVITY_TYPES } from "@/lib/activity-logger";

interface Assignment {
  id: string;
  name: string;
  description?: string;
  submission_type: 'text' | 'links' | 'attachments';
}

interface EnhancedStudentSubmissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment;
  userId: string;
  hasSubmitted?: boolean;
  onSubmissionComplete?: () => void;
}

export const EnhancedStudentSubmissionDialog = ({ 
  open, 
  onOpenChange, 
  assignment,
  userId,
  hasSubmitted = false,
  onSubmissionComplete
}: EnhancedStudentSubmissionDialogProps) => {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [links, setLinks] = useState<string[]>([""]);
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAddLink = () => {
    setLinks([...links, ""]);
  };

  const handleRemoveLink = (index: number) => {
    if (links.length > 1) {
      setLinks(links.filter((_, i) => i !== index));
    }
  };

  const handleLinkChange = (index: number, value: string) => {
    const newLinks = [...links];
    newLinks[index] = value;
    setLinks(newLinks);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      setFiles([...files, ...selectedFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of files) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${userId}/${assignment.id}/${fileName}`;

      const { data, error } = await supabase.storage
        .from('assignment-submissions')
        .upload(filePath, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('assignment-submissions')
        .getPublicUrl(data.path);

      uploadedUrls.push(publicUrl);
    }

    return uploadedUrls;
  };

  const validateSubmission = () => {
    switch (assignment.submission_type) {
      case 'text':
        if (!content.trim()) {
          toast({
            title: "Error",
            description: "Please enter your assignment response.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 'links':
        const validLinks = links.filter(link => link.trim());
        if (validLinks.length === 0) {
          toast({
            title: "Error",
            description: "Please provide at least one valid link.",
            variant: "destructive",
          });
          return false;
        }
        break;
      case 'attachments':
        if (files.length === 0) {
          toast({
            title: "Error",
            description: "Please attach at least one file.",
            variant: "destructive",
          });
          return false;
        }
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateSubmission()) return;

    setIsSubmitting(true);

    try {
      // Query the latest version to prevent conflicts on resubmission
      const { data: existingSubmissions, error: queryError } = await supabase
        .from('submissions')
        .select('version')
        .eq('student_id', userId)
        .eq('assignment_id', assignment.id)
        .order('version', { ascending: false })
        .limit(1);

      if (queryError) throw queryError;

      const nextVersion = ((existingSubmissions?.[0]?.version) || 0) + 1;

      let submissionData: any = {
        assignment_id: assignment.id,
        student_id: userId,
        status: 'pending',
        version: nextVersion
      };

      switch (assignment.submission_type) {
        case 'text':
          submissionData.content = content.trim();
          break;
        case 'links':
          const validLinks = links.filter(link => link.trim());
          submissionData.links = validLinks;
          submissionData.content = `Submitted ${validLinks.length} link(s)`;
          break;
        case 'attachments':
          const fileUrls = await uploadFiles();
          submissionData.file_urls = fileUrls.map((url, index) => ({
            url,
            name: files[index].name,
            size: files[index].size
          }));
          submissionData.content = `Submitted ${files.length} file(s)`;
          break;
      }

      const { error } = await supabase
        .from('submissions')
        .insert(submissionData);

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

      // Log assignment submission activity
      logUserActivity({
        user_id: userId,
        activity_type: ACTIVITY_TYPES.ASSIGNMENT_SUBMITTED,
        reference_id: assignment.id,
        metadata: {
          assignment_name: assignment.name,
          version: nextVersion,
          submission_type: assignment.submission_type,
          timestamp: new Date().toISOString()
        }
      });

      toast({
        title: "Assignment Submitted",
        description: "Your assignment has been successfully submitted for review.",
      });

      // Reset form
      setContent("");
      setLinks([""]);
      setFiles([]);
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

  const getSubmissionTypeBadge = () => {
    const types = {
      text: { label: 'Text Response', icon: FileText, color: 'bg-blue-100 text-blue-800' },
      links: { label: 'Link Submission', icon: Link, color: 'bg-green-100 text-green-800' },
      attachments: { label: 'File Upload', icon: Upload, color: 'bg-purple-100 text-purple-800' }
    };
    
    const type = types[assignment.submission_type];
    const Icon = type.icon;
    
    return (
      <Badge variant="outline" className={type.color}>
        <Icon className="w-3 h-3 mr-1" />
        {type.label}
      </Badge>
    );
  };

  const renderSubmissionForm = () => {
    if (hasSubmitted) {
      return (
        <div className="flex items-center gap-2 text-success">
          <CheckCircle className="w-4 h-4" />
          <p className="text-sm font-medium">
            Assignment already submitted and under review
          </p>
        </div>
      );
    }

    switch (assignment.submission_type) {
      case 'text':
        return (
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
        );

      case 'links':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Links</label>
              <Button type="button" variant="outline" size="sm" onClick={handleAddLink}>
                <Plus className="w-3 h-3 mr-1" />
                Add Link
              </Button>
            </div>
            {links.map((link, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  placeholder="https://example.com"
                  value={link}
                  onChange={(e) => handleLinkChange(index, e.target.value)}
                  className="flex-1"
                />
                {links.length > 1 && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleRemoveLink(index)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Add links to your work, portfolio, or relevant resources.
            </p>
          </div>
        );

      case 'attachments':
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium">Attachments</label>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="w-3 h-3 mr-1" />
                Add Files
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif"
            />
            {files.length > 0 && (
              <div className="space-y-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 border rounded">
                    <div className="flex items-center gap-2">
                      <Upload className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{file.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({Math.round(file.size / 1024)} KB)
                      </span>
                    </div>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleRemoveFile(index)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Upload documents, images, or other files related to your assignment.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Assignment</DialogTitle>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground flex-1">
              {assignment.name}
            </p>
            {getSubmissionTypeBadge()}
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Assignment Details</CardTitle>
            </CardHeader>
            <CardContent>
              {assignment.description && (
                <p className="text-sm text-muted-foreground mb-3">
                  {assignment.description}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                Complete the assignment and submit your work below.
              </p>
            </CardContent>
          </Card>

          {renderSubmissionForm()}

          {!hasSubmitted && (
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Assignment"}
              </Button>
            </div>
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