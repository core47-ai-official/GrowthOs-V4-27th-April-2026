import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'framer-motion';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { QuestionItem, QuestionnaireResponse } from '@/types/questionnaire';
import { QuestionRenderer } from './QuestionRenderer';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { errorHandler } from '@/lib/error-handler';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { safeLogger } from '@/lib/safe-logger';
interface QuestionnaireWizardProps {
  questions: QuestionItem[];
  onComplete: (responses: QuestionnaireResponse[]) => void;
  isLoading?: boolean;
}

// Create dynamic schema based on questions with error handling
const createQuestionnaireSchema = (questions: QuestionItem[]) => {
  try {
    // Defensive check for questions array
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      safeLogger.warn('QuestionnaireWizard: Creating empty schema - questions array is empty or invalid');
      return z.object({});
    }

    const schemaObject: Record<string, z.ZodTypeAny> = {};
    
    questions.forEach((question, index) => {
      try {
        // Defensive checks for question structure
        if (!question || !question.id || !question.answerType) {
          safeLogger.warn(`QuestionnaireWizard: Skipping invalid question at index ${index}:`, { question });
          return;
        }

        let fieldSchema: z.ZodTypeAny;
        
        switch (question.answerType) {
          case 'singleLine':
          case 'multiLine':
            fieldSchema = z.string().optional();
            break;
          case 'singleSelect':
            fieldSchema = z.string().optional();
            break;
          case 'multiSelect':
            fieldSchema = z.array(z.string()).optional();
            break;
          case 'file':
            fieldSchema = z.object({
              fileName: z.string(),
              fileUrl: z.string(),
              fileSize: z.number()
            }).nullable().optional();
            break;
          default:
            safeLogger.warn(`QuestionnaireWizard: Unknown answer type "${question.answerType}" for question ${question.id}`);
            fieldSchema = z.any().optional();
        }

        // All fields start as optional to prevent validation errors during initialization
        // Required validation will be handled manually during step navigation
        schemaObject[question.id] = fieldSchema;
      } catch (error) {
        safeLogger.error(`QuestionnaireWizard: Error processing question ${question?.id || index}:`, error);
        // Continue with other questions instead of failing completely
      }
    });

    return z.object(schemaObject);
  } catch (error) {
    safeLogger.error('QuestionnaireWizard: Critical error creating schema:', error);
    errorHandler.handleError(error, 'questionnaire_schema_creation', false);
    // Return empty schema as fallback
    return z.object({});
  }
};

// Local storage key
const STORAGE_KEY = 'questionnaire-wizard-data';
export const QuestionnaireWizard: React.FC<QuestionnaireWizardProps> = ({
  questions,
  onComplete,
  isLoading = false
}) => {
  safeLogger.info('QuestionnaireWizard: Component initialized', { 
    questionCount: questions?.length || 0, 
    hasQuestions: !!questions,
    isArray: Array.isArray(questions),
    isLoading 
  });

  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  // Early return for invalid questions
  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    if (import.meta.env.DEV) {
      console.log('QuestionnaireWizard: Invalid questions data', { 
        questions: questions,
        isArray: Array.isArray(questions),
        length: questions?.length 
      });
    }
    safeLogger.warn('QuestionnaireWizard: Returning loading state', { 
      questions: questions,
      isArray: Array.isArray(questions),
      length: questions?.length 
    });
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <p className="text-muted-foreground">Loading questionnaire...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (import.meta.env.DEV) {
    console.log('QuestionnaireWizard: Valid questions received', { 
      questionCount: questions.length,
      firstQuestion: questions[0]?.text?.substring(0, 50),
      sampleQuestion: questions[0]
    });
  }

  // Validate current step
  const validCurrentStep = Math.max(0, Math.min(currentStep, questions.length - 1));
  
  // Load saved data from localStorage
  const loadSavedData = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.answers || {};
      }
    } catch (error) {
      safeLogger.warn('Failed to load saved questionnaire data:', error);
    }
    return {};
  };

  // Initialize default values properly with error handling
  const getDefaultValues = useMemo(() => {
    try {
      if (!questions || questions.length === 0) {
        return {};
      }
      
      const savedData = loadSavedData();
      const defaults: Record<string, any> = {};
      
      questions.forEach(question => {
        try {
          if (!question || !question.id) {
            safeLogger.warn('QuestionnaireWizard: Skipping invalid question in defaults:', { question });
            return;
          }

          if (savedData[question.id] !== undefined) {
            defaults[question.id] = savedData[question.id];
          } else {
            // Set appropriate default values based on answer type
            switch (question.answerType) {
              case 'multiSelect':
                defaults[question.id] = [];
                break;
              case 'file':
                defaults[question.id] = null;
                break;
              default:
                defaults[question.id] = '';
            }
          }
        } catch (error) {
          safeLogger.error(`QuestionnaireWizard: Error setting default for question ${question?.id}:`, error);
        }
      });
      
      return defaults;
    } catch (error) {
      safeLogger.error('QuestionnaireWizard: Error creating default values:', error);
      setInitializationError('Failed to initialize form');
      return {};
    }
  }, [questions]);

  // Create schema with error handling
  const schema = useMemo(() => {
    try {
      return createQuestionnaireSchema(questions);
    } catch (error) {
      safeLogger.error('QuestionnaireWizard: Schema creation failed:', error);
      setInitializationError('Failed to initialize questionnaire');
      return z.object({});
    }
  }, [questions]);
  
  // Initialize form with comprehensive error handling
  const form = useForm({
    resolver: zodResolver(schema),
    mode: 'onSubmit', // Changed to onSubmit to prevent premature validation
    reValidateMode: 'onSubmit', // Changed to onSubmit
    defaultValues: getDefaultValues,
    shouldFocusError: true,
    criteriaMode: 'firstError'
  });

  // Reset form when questions change
  useEffect(() => {
    try {
      if (questions && questions.length > 0 && getDefaultValues) {
        form.reset(getDefaultValues);
        setCurrentStep(0);
        setInitializationError(null);
      }
    } catch (error) {
      safeLogger.error('QuestionnaireWizard: Error resetting form:', error);
      setInitializationError('Failed to reset form');
    }
  }, [questions, form, getDefaultValues]);
  const {
    formState: {
      isValid,
      errors
    },
    watch,
    trigger
  } = form;
  const currentQuestion = questions[validCurrentStep];
  const totalSteps = questions.length;
  const progress = (validCurrentStep + 1) / totalSteps * 100;
  const isLastStep = validCurrentStep === totalSteps - 1;

  // Show error state if initialization failed
  if (initializationError) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8 space-y-4">
            <div className="text-destructive font-medium">Questionnaire Error</div>
            <p className="text-muted-foreground text-sm">{initializationError}</p>
            <Button 
              onClick={() => {
                // Use safe refresh without hard reload
                setInitializationError(null);
                window.location.href = window.location.href;
              }}
              variant="outline"
              size="sm"
            >
              Refresh Page
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Defensive check for current question
  if (!currentQuestion) {
    safeLogger.error('QuestionnaireWizard: Current question is undefined', { currentStep: validCurrentStep, totalQuestions: questions.length });
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <Card className="w-full max-w-md mx-auto">
          <CardContent className="text-center p-8">
            <p className="text-muted-foreground">Loading question...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Watch all form values to save to localStorage
  const watchedValues = watch();

  // Save to localStorage whenever form values change
  useEffect(() => {
    const saveData = {
      answers: watchedValues,
      currentStep,
      timestamp: Date.now()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saveData));
  }, [watchedValues, currentStep]);

  // Focus management
  useEffect(() => {
    if (stepRef.current) {
      const firstInput = stepRef.current.querySelector('input, select, textarea, button') as HTMLElement;
      if (firstInput) {
        setTimeout(() => {
          firstInput.focus();
        }, 300); // Wait for animation
      }
    }
  }, [currentStep]);

  // Check if current step is valid - only validate current question
  const isCurrentStepValid = async () => {
    try {
      if (!currentQuestion) return false;
      
      // Only validate if required
      if (!currentQuestion.required) return true;
      
      // Get current value
      const currentValue = form.getValues(currentQuestion.id);
      
      // Validate based on answer type
      switch (currentQuestion.answerType) {
        case 'singleLine':
        case 'multiLine':
        case 'singleSelect':
          return currentValue && typeof currentValue === 'string' && currentValue.trim().length > 0;
        case 'multiSelect':
          return Array.isArray(currentValue) && currentValue.length > 0;
        case 'file':
          return currentValue !== null && currentValue !== undefined;
        default:
          return true;
      }
    } catch (error) {
      safeLogger.error('Error validating current step:', error);
      return false;
    }
  };
  const handleNext = async () => {
    try {
      // Validate current step only when trying to proceed
      const stepValid = await isCurrentStepValid();
      if (!stepValid && currentQuestion.required) {
        // Show error message without triggering Zod validation
        toast({
          title: 'Please complete this field',
          description: 'This question is required to continue.',
          variant: 'destructive'
        });
        return;
      }
      
      if (isLastStep) {
        await handleSubmit();
      } else {
        setCurrentStep(prev => Math.min(prev + 1, questions.length - 1));
      }
    } catch (error) {
      safeLogger.error('QuestionnaireWizard: Error in handleNext:', error);
      toast({
        title: 'Navigation Error',
        description: 'Unable to proceed to next question. Please try again.',
        variant: 'destructive'
      });
    }
  };
  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  const handleSubmit = async () => {
    setIsSubmitting(true);
    safeLogger.info('QuestionnaireWizard: Starting submission...');
    
    try {
      // Manual validation of required fields
      const formData = form.getValues();
      const missingFields: string[] = [];
      
      questions.forEach(question => {
        if (question.required) {
          const value = formData[question.id];
          let isValid = false;
          
          switch (question.answerType) {
            case 'singleLine':
            case 'multiLine':
            case 'singleSelect':
              isValid = value && typeof value === 'string' && value.trim().length > 0;
              break;
            case 'multiSelect':
              isValid = Array.isArray(value) && value.length > 0;
              break;
            case 'file':
              isValid = value !== null && value !== undefined;
              break;
            default:
              isValid = true;
          }
          
          if (!isValid) {
            missingFields.push(question.text);
          }
        }
      });
      
      if (missingFields.length > 0) {
        toast({
          title: 'Please complete all required fields',
          description: `Missing: ${missingFields.slice(0, 2).join(', ')}${missingFields.length > 2 ? ` and ${missingFields.length - 2} more` : ''}`,
          variant: 'destructive'
        });
        setIsSubmitting(false);
        return;
      }
      
      safeLogger.info('QuestionnaireWizard: Form data:', { formData });
      
      const responses: QuestionnaireResponse[] = questions.map(question => ({
        questionId: question.id,
        value: formData[question.id] || null
      }));
      
      safeLogger.info('QuestionnaireWizard: Calling onComplete with responses:', { responses });
      
      // Show loading toast
      toast({
        title: 'Saving your answers...',
        description: 'Please wait while we process your responses.'
      });
      
      await onComplete(responses);

      // Clear saved data on successful submission
      localStorage.removeItem(STORAGE_KEY);
      safeLogger.info('QuestionnaireWizard: Submission completed successfully');
      
    } catch (error) {
      safeLogger.error('QuestionnaireWizard: Submission error:', error);
      toast({
        title: 'Submission failed',
        description: 'Please try again. If the problem persists, refresh the page.',
        variant: 'destructive'
      });
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const stepVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 50 : -50,
      opacity: 0
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      zIndex: 0,
      x: direction < 0 ? 50 : -50,
      opacity: 0
    })
  };
  return (
    <ErrorBoundary>
      <div className="min-h-[80vh] flex items-center justify-center p-4 py-8">
        <Card className="wizard-card w-full max-w-[560px] mx-auto shadow-xl border-0 bg-white/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-6 pb-8">
          <div className="space-y-2">
            
            <CardTitle className="text-2xl font-bold text-foreground sm:text-3xl">
              Tell us about yourself
            </CardTitle>
            <p className="text-muted-foreground text-sm">
              Just a few questions to personalize your experience
            </p>
          </div>
          
          {/* Progress Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm font-medium">
              <span className="text-primary">Step {validCurrentStep + 1} of {totalSteps}</span>
              <span className="text-muted-foreground">{Math.round(progress)}% complete</span>
            </div>
            
            <div className="space-y-3">
              <Progress value={progress} className="h-2.5 bg-muted/50" aria-label={`Progress: ${Math.round(progress)}% complete`} aria-valuenow={validCurrentStep + 1} aria-valuemax={totalSteps} />
              
              {/* Step Indicators */}
              <div className="flex justify-center gap-2" role="tablist" aria-label="Questionnaire steps">
                {questions.map((_, index) => <div key={index} role="tab" aria-selected={index === validCurrentStep} aria-label={`Step ${index + 1}${index < validCurrentStep ? ' - completed' : index === validCurrentStep ? ' - current' : ' - upcoming'}`} className={`h-2.5 rounded-full transition-all duration-500 ${index === validCurrentStep ? 'bg-primary w-8 shadow-sm' : index < validCurrentStep ? 'bg-primary/80 w-2.5' : 'bg-muted w-2.5'}`} />)}
              </div>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-8 pb-8">
          {/* Question Content */}
          <div className="relative overflow-hidden">
            <AnimatePresence mode="wait" custom={1}>
              <motion.div key={validCurrentStep} ref={stepRef} custom={1} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={{
              x: {
                type: "spring",
                stiffness: 300,
                damping: 30
              },
              opacity: {
                duration: 0.25
              }
            }} className="space-y-6">
                <div className="space-y-6">
                  <div className="space-y-3">
                    <label className="text-lg sm:text-xl font-semibold leading-relaxed block text-foreground">
                      {currentQuestion.text}
                      {currentQuestion.required && <span className="text-destructive ml-1" aria-label="required">*</span>}
                    </label>
                    {currentQuestion.required && <p className="text-sm text-muted-foreground">
                        This field is required to continue
                      </p>}
                  </div>
                  
                  <QuestionRenderer question={currentQuestion} control={form.control} error={errors[currentQuestion.id]?.message as string} />
                  
                  {/* Error Display */}
                  {errors[currentQuestion.id] && <div data-error={currentQuestion.id} aria-live="polite" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3 animate-in slide-in-from-left-2">
                      <div className="w-1.5 h-1.5 bg-destructive rounded-full flex-shrink-0"></div>
                      {errors[currentQuestion.id]?.message as string}
                    </div>}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
          
          {/* Navigation */}
          <nav className="wizard-nav flex items-center justify-between pt-6 border-t border-border/50" aria-label="Questionnaire navigation">
            {validCurrentStep > 0 ? <Button type="button" variant="ghost" onClick={handlePrevious} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors" aria-label="Go to previous question">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button> : <div />}
            
            <Button type="button" onClick={handleNext} disabled={isSubmitting || isLoading} className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium px-6 py-2.5 rounded-lg shadow-sm hover:shadow-md transition-all duration-200" aria-label={isLastStep ? "Complete questionnaire" : "Go to next question"}>
              {isSubmitting || isLoading ? <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                  {isLastStep ? 'Submitting...' : 'Loading...'}
                </> : <>
                  {isLastStep ? <>
                      <Check className="h-4 w-4" />
                      Complete
                    </> : <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>}
                </>}
            </Button>
          </nav>
        </CardContent>
      </Card>
    </div>
    </ErrorBoundary>
  );
};