import { useState, useEffect } from "react";
import { safeLogger } from '@/lib/safe-logger';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { StudentQuestionnaireForm } from "@/components/questionnaire/StudentQuestionnaireForm";
import { supabase } from "@/integrations/supabase/client";
import { QuestionItem, QuestionnaireResponse } from "@/types/questionnaire";
import { generateDreamGoalSummary } from "@/utils/dreamGoalUtils";
import { ENV_CONFIG } from "@/lib/env-config";
interface OnboardingProps {
  user: any;
  onComplete: () => void;
}
const Onboarding = ({
  user,
  onComplete
}: OnboardingProps) => {
  const {
    toast
  } = useToast();
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [autoCompleted, setAutoCompleted] = useState(false);
  
  // Clear any potential redirect caches before rendering
  useEffect(() => {
    // Clear any cached redirects or navigation state
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => {
          registration.unregister();
        });
      });
    }
    
    // Clear session storage for any redirect data
    try {
      sessionStorage.removeItem('redirect_url');
      sessionStorage.removeItem('lms_redirect');
      localStorage.removeItem('redirect_url');
      localStorage.removeItem('lms_redirect');
    } catch (e) {
      // Ignore storage errors
    }
  }, []);
  
  useEffect(() => {
    const fetchQuestions = async () => {
      safeLogger.info('Onboarding: Starting to fetch questionnaire', { userId: user?.id });
      
      // Prevent any automatic redirects during onboarding
      const preventRedirects = () => {
        safeLogger.warn('Onboarding: Blocked redirect attempt during onboarding');
        return false;
      };
      
      // Note: Redirect protection is handled globally in main.tsx

      try {
        safeLogger.info('Onboarding: About to fetch company settings');
        const {
          data: settings,
          error
        } = await supabase.from('company_settings').select('enable_student_signin, questionnaire').eq('id', 1).maybeSingle();
        safeLogger.info('Onboarding: Raw response from company_settings', { settings, error });
        if (error) {
          safeLogger.error('Onboarding: Error fetching company settings', error);
          // If no settings found, assume questionnaire is disabled
          setIsEnabled(false);
          setQuestions([]);
        } else {
          safeLogger.info('Onboarding: Company settings fetched', { 
            enable_student_signin: settings?.enable_student_signin, 
            hasQuestionnaire: !!settings?.questionnaire,
            questionnaireLength: Array.isArray(settings?.questionnaire) ? settings.questionnaire.length : 'not-array'
          });
          setIsEnabled(settings?.enable_student_signin || false);
          if (settings?.enable_student_signin && settings?.questionnaire) {
            try {
              // Parse questionnaire if it's a string, otherwise use as-is
              const questionnaireData = typeof settings.questionnaire === 'string' ? JSON.parse(settings.questionnaire) : settings.questionnaire;
              if (Array.isArray(questionnaireData)) {
                // Sort questions by order
                const sortedQuestions = questionnaireData.sort((a, b) => a.order - b.order);
                safeLogger.info('Onboarding: Questions loaded successfully', { 
                  questionCount: sortedQuestions.length,
                  firstQuestion: sortedQuestions[0]?.text?.substring(0, 50) 
                });
                setQuestions(sortedQuestions);
              } else {
                safeLogger.warn('Onboarding: Questionnaire data is not an array', { 
                  type: typeof questionnaireData, 
                  value: questionnaireData 
                });
                setQuestions([]);
              }
            } catch (parseError) {
              console.error('Error parsing questionnaire data:', parseError);
              setQuestions([]);
            }
          } else {
            setQuestions([]);
          }
        }
      } catch (error) {
        console.error('Error fetching questionnaire:', error);
        setIsEnabled(false);
        setQuestions([]);
      } finally {
        setLoading(false);
        
        // Redirect protection is handled globally in main.tsx
      }
    };
    
    fetchQuestions();
  }, []);

  // Handle auto-completion when questionnaire is disabled
  useEffect(() => {
    if (!loading && !isEnabled && !autoCompleted) {
      safeLogger.info('Onboarding: Auto-completing due to disabled questionnaire', { 
        isEnabled, 
        questionCount: questions.length 
      });
      
      setAutoCompleted(true);
      
      // Auto-complete onboarding since questionnaire is disabled
      const completeOnboarding = async () => {
        try {
          // Mark student onboarding as completed with proper data to satisfy constraint
          const { error } = await supabase
            .from('students')
            .update({ 
              onboarding_completed: true,
              answers_json: {},
              goal_brief: 'Questionnaire was disabled - onboarding auto-completed',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', user.id);
            
          if (error) {
            safeLogger.error('Onboarding: Error auto-completing onboarding', error);
            // Show error message and allow retry
            toast({
              variant: "destructive",
              title: "Auto-completion failed",
              description: "Please refresh the page to try again."
            });
            setAutoCompleted(false); // Allow retry
            return;
          } else {
            safeLogger.info('Onboarding: Auto-completion successful');
            // Wait a moment then complete
            setTimeout(() => {
              onComplete();
            }, 500);
          }
        } catch (error) {
          safeLogger.error('Onboarding: Error in auto-completion', error);
          toast({
            variant: "destructive",
            title: "Auto-completion failed",
            description: "Please refresh the page to try again."
          });
          setAutoCompleted(false); // Allow retry
        }
      };

      // Auto-complete after a brief delay
      setTimeout(completeOnboarding, 100);
    }
  }, [loading, isEnabled, autoCompleted, onComplete, user.id, toast, questions.length]);
  const handleQuestionnaireComplete = async (responses: QuestionnaireResponse[]) => {
    setSubmitting(true);
    
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const maxRetries = 2;
    
    const executeWithRetry = async (): Promise<void> => {
      // Add timeout to prevent getting stuck
      timeoutId = setTimeout(() => {
        setSubmitting(false);
        toast({
          variant: "destructive",
          title: "Request timed out",
          description: "Please try again. If the problem persists, refresh the page."
        });
      }, ENV_CONFIG.DEFAULT_SESSION_DURATION_MINUTES * 1000); // configurable timeout

      try {
      safeLogger.info('Starting onboarding completion', { 
        userId: user.id,
        userEmail: user?.email,
        responseCount: responses.length,
        timestamp: new Date().toISOString()
      });
      
      // First, verify student record exists
      const { data: studentCheck, error: checkError } = await supabase
        .from('students')
        .select('id, user_id, onboarding_completed, answers_json, goal_brief')
        .eq('user_id', user.id)
        .maybeSingle();

      if (checkError || !studentCheck) {
        console.error('Student record not found:', checkError);
        throw new Error('Student record not found. Please contact support.');
      }

      safeLogger.info('Student record found', { 
        studentId: studentCheck?.id,
        currentOnboardingStatus: studentCheck?.onboarding_completed,
        hasExistingAnswers: !!studentCheck?.answers_json,
        hasExistingGoalBrief: !!studentCheck?.goal_brief
      });

      // 1. Save responses to user_activity_logs for audit trail
      const responsePromises = responses.map(response => {
        let answerValue = '';
        let answerData: any = {
          questionId: response.questionId
        };

        // Handle different value types
        if (response.value instanceof File) {
          answerValue = response.value.name;
          answerData.value = response.value.name;
          answerData.fileType = response.value.type;
        } else if (Array.isArray(response.value)) {
          answerValue = response.value.join(', ');
          answerData.value = response.value;
        } else {
          answerValue = String(response.value || '');
          answerData.value = response.value;
        }

        return supabase.from('user_activity_logs').insert({
          user_id: user.id,
          activity_type: 'onboarding_response',
          metadata: {
            question_type: 'dynamic_questionnaire',
            question_text: questions.find(q => q.id === response.questionId)?.text || 'Unknown question',
            answer_value: answerValue,
            answer_data: answerData
          }
        });
      });

      safeLogger.info('Saving activity logs');
      const results = await Promise.all(responsePromises);
      const hasErrors = results.some(result => result.error);

      if (hasErrors) {
        console.error('Activity log errors:', results.filter(r => r.error));
        throw new Error('Failed to save some responses to activity logs');
      }

      // 2. Generate goal summary from answers
      const questionAnswers = responses.map((response, index) => {
        const question = questions.find(q => q.id === response.questionId);
        let answerText = '';
        
        if (Array.isArray(response.value)) {
          answerText = response.value.join(', ');
        } else if (response.value instanceof File) {
          answerText = response.value.name;
        } else {
          answerText = String(response.value || '');
        }

        return {
          id: response.questionId,
          questionText: question?.text || '',
          answer: answerText,
          order: question?.order || index
        };
      });

      const goalBrief = generateDreamGoalSummary(questionAnswers) || 'Goal set from questionnaire completion';

      // 3. Prepare answers JSON for storage
      const answersJson = responses.reduce((acc, response) => {
        const question = questions.find(q => q.id === response.questionId);
        acc[response.questionId] = {
          questionText: question?.text || '',
          value: response.value,
          order: question?.order || 0
        };
        return acc;
      }, {} as Record<string, any>);

      safeLogger.info('Updating student record with onboarding completion');
      
      // 4. Update students table with completion data
      const { data: updateData, error: studentError } = await supabase
        .from('students')
        .update({
          onboarding_completed: true,
          answers_json: answersJson,
          goal_brief: goalBrief,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
        .select();

      if (studentError) {
        console.error('Student update error:', studentError);
        throw new Error(`Failed to update student record: ${studentError.message}`);
      }

      safeLogger.info('Student record updated successfully', { 
        studentId: updateData?.[0]?.id,
        onboardingCompleted: updateData?.[0]?.onboarding_completed,
        hasAnswers: !!updateData?.[0]?.answers_json,
        hasGoalBrief: !!updateData?.[0]?.goal_brief,
        updateCount: updateData?.length
      });

      // 5. Also update user profile with dream goal summary for backward compatibility
      const { error: userError } = await supabase
        .from('users')
        .update({
          dream_goal_summary: goalBrief
        })
        .eq('id', user.id);

      if (userError) {
        console.error('Warning: Failed to update user profile:', userError);
        // Don't throw here as student record is the primary source
      }

      // Clear timeout since we succeeded
      if (timeoutId) clearTimeout(timeoutId);
      
      // 7. Complete onboarding with automatic page refresh after 5 seconds
      setTimeout(() => {
        safeLogger.info('Onboarding: Completing onboarding and calling onComplete');
        
        // Reset submitting state first
        setSubmitting(false);
        
        // Show success message
        toast({
          title: "Onboarding Complete!",
          description: "Page will refresh in 5 seconds...",
          duration: 5000
        });
        
        // Set up automatic page refresh after 5 seconds
        setTimeout(() => {
          safeLogger.info('Onboarding: Auto-refreshing page after 5 seconds');
          window.location.reload();
        }, 5000);
        
        // Still call onComplete for immediate navigation if needed
        if (window.location.hostname === window.location.hostname) {
          safeLogger.info('Onboarding completed, will refresh shortly');
          onComplete();
        } else {
          safeLogger.error('Onboarding: Domain changed during completion, reloading page immediately');
          window.location.reload();
        }
      }, 100);

    } catch (error: any) {
      // Clear timeout
      if (timeoutId) clearTimeout(timeoutId);
      
      console.error('Onboarding completion error:', error);
      
      // Retry logic for transient failures
      if (retryCount < maxRetries && (
        error.message?.includes('timeout') || 
        error.message?.includes('network') ||
        error.message?.includes('connection')
      )) {
        retryCount++;
        safeLogger.warn('Retrying onboarding completion', { attempt: retryCount, maxRetries });
        
        toast({
          title: "Retrying...",
          description: `Attempt ${retryCount} of ${maxRetries + 1}. Please wait.`
        });
        
        // Wait a bit before retrying
        setTimeout(() => executeWithRetry(), 2000);
        return;
      }
      
      toast({
        variant: "destructive",
        title: "Could not save your answers",
        description: error.message || "Please try again. If the problem persists, refresh the page."
      });
      setSubmitting(false);
    }
    };
    
    // Start the execution with retry logic
    await executeWithRetry();
  };

  // If loading, show loading state
  if (loading) {
    return <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading questionnaire...</p>
          </CardContent>
        </Card>
      </div>;
  }

  // If questionnaire is disabled, show auto-completion loading
  if (!isEnabled) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardContent className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Completing onboarding...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If questionnaire is enabled but no questions available, show error
  if (isEnabled && questions.length === 0) {
    safeLogger.error('Onboarding: Questionnaire enabled but no questions found', { 
      isEnabled, 
      questionCount: questions.length 
    });
    
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardContent className="p-8 text-center">
            <div className="text-destructive mb-4">
              <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-destructive mb-2">Questionnaire Not Available</h3>
            <p className="text-muted-foreground mb-4">
              The onboarding questionnaire is enabled but no questions are configured. Please contact support.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (import.meta.env.DEV) {
    console.log('Onboarding: About to render questionnaire', {
      questionCount: questions.length, 
      submitting, 
      userId: user?.id,
      sampleQuestion: questions[0]
    });
  }
  safeLogger.info('Onboarding: Rendering questionnaire form', { 
    questionCount: questions.length, 
    submitting, 
    userId: user?.id 
  });

  try {
    return <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-semibold text-gray-900">Welcome! Let's Get Started</CardTitle>
            <p className="text-gray-600 mt-2">Help us understand your goals so we can personalize your learning experience.</p>
          </CardHeader>
          
          <CardContent className="bg-slate-50">
            <StudentQuestionnaireForm questions={questions} onComplete={handleQuestionnaireComplete} isLoading={submitting} />
          </CardContent>
        </Card>
      </div>;
  } catch (renderError) {
    console.error('Onboarding: Error rendering questionnaire:', renderError);
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl shadow-elevated border-0">
          <CardContent className="p-8 text-center">
            <div className="text-destructive mb-4">
              <svg className="h-12 w-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Questionnaire</h3>
            <p className="text-muted-foreground mb-4">
              Something went wrong while loading the questionnaire. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              Refresh Page
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }
};
export default Onboarding;