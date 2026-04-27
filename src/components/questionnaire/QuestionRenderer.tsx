import React, { useState } from 'react';
import { Control, Controller } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { QuestionItem } from '@/types/questionnaire';
import { Upload, Check, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface QuestionRendererProps {
  question: QuestionItem;
  control: Control<any>;
  error?: string;
}

export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  question,
  control,
  error
}) => {
  const [isUploading, setIsUploading] = useState(false);
  
  const handleFileUpload = async (file: File, onChange: (value: any) => void) => {
    setIsUploading(true);
    
    try {
      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please select a file smaller than 10MB.',
          variant: 'destructive'
        });
        return;
      }
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const filePath = `onboarding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('assignment-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('assignment-files')
        .getPublicUrl(filePath);

      const fileData = {
        fileName: file.name,
        fileUrl: publicUrl,
        fileSize: file.size
      };
      
      onChange(fileData);
      
      toast({
        title: 'File uploaded successfully',
        description: file.name
      });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload file. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const renderInput = () => {
    switch (question.answerType) {
      case 'singleLine':
        return (
          <Controller
            name={question.id}
            control={control}
            render={({ field }) => (
              <Input
                {...field}
                placeholder="Enter your answer..."
                className={error ? 'border-destructive focus:border-destructive' : ''}
                aria-describedby={error ? `${question.id}-error` : undefined}
                aria-invalid={!!error}
              />
            )}
          />
        );

      case 'multiLine':
        return (
          <Controller
            name={question.id}
            control={control}
            render={({ field }) => (
              <Textarea
                {...field}
                placeholder="Enter your answer..."
                rows={4}
                className={error ? 'border-destructive focus:border-destructive' : ''}
                aria-describedby={error ? `${question.id}-error` : undefined}
                aria-invalid={!!error}
              />
            )}
          />
        );

      case 'singleSelect':
        return (
          <Controller
            name={question.id}
            control={control}
            render={({ field }) => (
              <Select
                value={field.value || ''}
                onValueChange={field.onChange}
              >
                <SelectTrigger 
                  className={error ? 'border-destructive focus:border-destructive' : ''}
                  aria-describedby={error ? `${question.id}-error` : undefined}
                  aria-invalid={!!error}
                >
                  <SelectValue placeholder="Select an option..." />
                </SelectTrigger>
                <SelectContent>
                  {question.options?.map((option, index) => (
                    <SelectItem key={index} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        );

      case 'multiSelect':
        return (
          <Controller
            name={question.id}
            control={control}
            render={({ field }) => (
              <div 
                className="space-y-3"
                role="group"
                aria-labelledby={`${question.id}-label`}
                aria-describedby={error ? `${question.id}-error` : undefined}
                aria-invalid={!!error}
              >
                {question.options?.map((option, index) => (
                  <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                    <Checkbox
                      id={`${question.id}-${index}`}
                      checked={Array.isArray(field.value) && field.value.includes(option)}
                      onCheckedChange={(checked) => {
                        const currentValues = Array.isArray(field.value) ? field.value : [];
                        if (checked) {
                          field.onChange([...currentValues, option]);
                        } else {
                          field.onChange(currentValues.filter((v: string) => v !== option));
                        }
                      }}
                      aria-describedby={`${question.id}-${index}-label`}
                    />
                    <Label 
                      id={`${question.id}-${index}-label`}
                      htmlFor={`${question.id}-${index}`} 
                      className="text-sm font-medium cursor-pointer flex-1"
                    >
                      {option}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          />
        );

      case 'file':
        return (
          <Controller
            name={question.id}
            control={control}
            render={({ field }) => (
              <div className="space-y-4">
                <div 
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    error 
                      ? 'border-destructive bg-destructive/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                  <Label 
                    htmlFor={`file-${question.id}`} 
                    className="cursor-pointer block"
                  >
                    <span className="text-sm font-medium text-primary hover:text-primary/80">
                      Click to upload a file
                    </span>
                    <Input
                      id={`file-${question.id}`}
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFileUpload(file, field.onChange);
                        }
                      }}
                      disabled={isUploading}
                      className="hidden"
                      aria-describedby={error ? `${question.id}-error` : `${question.id}-help`}
                      aria-invalid={!!error}
                    />
                  </Label>
                  <p id={`${question.id}-help`} className="text-xs text-muted-foreground mt-1">
                    Maximum file size: 10MB
                  </p>
                </div>
                
                {isUploading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
                    Uploading...
                  </div>
                )}
                
                {field.value && field.value.fileName && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <FileText className="h-4 w-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                    <span className="text-sm text-green-800 dark:text-green-200 font-medium truncate">
                      {field.value.fileName}
                    </span>
                    <Check className="h-4 w-4 text-green-600 dark:text-green-400 ml-auto flex-shrink-0" />
                  </div>
                )}
                
                {error && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-2">
      <div id={`${question.id}-label`} className="sr-only">
        {question.text}
      </div>
      {renderInput()}
    </div>
  );
};