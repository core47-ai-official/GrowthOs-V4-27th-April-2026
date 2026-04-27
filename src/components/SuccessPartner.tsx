import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { X, Send, MessageSquare, BookOpen, Heart, Brain, Loader2, Clock, TrendingUp, BarChart3, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ENV_CONFIG } from "@/lib/env-config";
import { detectBusinessContext, getContextDescription } from "@/lib/ai-context-detector";
import { safeLogger } from '@/lib/safe-logger';
import { buildBusinessContext } from "@/lib/ai-context-builder";
import { StudentIntegrations } from "@/lib/student-integrations";
import ReactMarkdown from 'react-markdown';
interface Message {
  id: number;
  sender: "user" | "ai" | "loading";
  content: string;
  timestamp: Date;
}
interface SuccessPartnerProps {
  onClose: () => void;
  user?: {
    id: string;
    full_name?: string;
    email?: string;
  };
}
interface CreditsInfo {
  credits_used: number;
  daily_limit: number;
  credits_remaining: number;
  can_send_message: boolean;
  date: string;
}
const SuccessPartner = ({
  onClose,
  user
}: SuccessPartnerProps) => {
  const [message, setMessage] = useState("");
  const [dateRangeDays, setDateRangeDays] = useState<number>(ENV_CONFIG.SUCCESS_PARTNER_DEFAULT_DATE_RANGE_DAYS);
  const [messages, setMessages] = useState<Message[]>([{
    id: 1,
    sender: "ai",
    content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
    timestamp: new Date()
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);
  const [isFetchingContext, setIsFetchingContext] = useState(false);
  const [contextDescription, setContextDescription] = useState("");
  const [explicitContextFlags, setExplicitContextFlags] = useState<{ includeShopify: boolean; includeMetaAds: boolean } | null>(null);
  const [integrationStatus, setIntegrationStatus] = useState({
    shopify: false,
    metaAds: false,
    loading: true
  });
  const {
    toast
  } = useToast();

  // Load conversation history from database on mount
  useEffect(() => {
    if (!user?.id) return;
    
    const loadMessages = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        
        // Add a small delay to ensure any in-flight messages are saved
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data: dbMessages, error } = await supabase
          .from('success_partner_messages')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .order('timestamp', { ascending: true });

        if (error) {
          console.error('Failed to load messages:', error);
          return;
        }

        if (dbMessages && dbMessages.length > 0) {
          const restored: Message[] = dbMessages.map((msg, idx) => ({
            id: idx + 2,
            sender: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
            timestamp: new Date(msg.timestamp)
          }));

          console.log('Success Partner: Loaded messages from database', {
            messageCount: restored.length,
            messages: restored
          });

          // Check if first message is already a greeting from the AI
          const hasGreeting = restored.length > 0 && 
            restored[0].sender === 'ai' && 
            restored[0].content.includes("Success Partner");

          if (hasGreeting) {
            // Already has greeting in DB, just show restored messages
            setMessages(restored);
          } else {
            // Prepend default greeting
            setMessages([
              {
                id: 1,
                sender: "ai",
                content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
                timestamp: new Date()
              },
              ...restored
            ]);
          }
        } else {
          // No messages in DB, show default greeting
          setMessages([{
            id: 1,
            sender: "ai",
            content: "Hello, I'm your Success Partner. I'm here to help you succeed in your e-commerce journey. What can I help you with today?",
            timestamp: new Date()
          }]);
        }
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();

    // Safety re-fetch: pick up any assistant reply that landed just after opening
    const refetchTimer = setTimeout(() => {
      loadMessages();
    }, 2000);

    return () => clearTimeout(refetchTimer);
  }, [user?.id]);

  // Set up Realtime subscription for new messages
  useEffect(() => {
    if (!user?.id) return;

    console.log('Setting up Realtime subscription for user:', user.id);

    const channel = supabase
      .channel('success-partner-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'success_partner_messages',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('Realtime: New message received', payload);
          
          // Only add assistant messages via realtime (user messages are added immediately)
          if (payload.new.role === 'assistant') {
            setMessages(prev => {
              // Remove loading indicator if present
              const withoutLoading = prev.filter(m => m.sender !== 'loading');
              
              // Check if message already exists (prevent duplicates)
              const exists = withoutLoading.some(m => 
                m.sender === 'ai' && 
                m.content === payload.new.content &&
                Math.abs(new Date(m.timestamp).getTime() - new Date(payload.new.timestamp).getTime()) < 1000
              );
              
              if (exists) {
                console.log('Message already exists, skipping');
                return prev;
              }

              return [
                ...withoutLoading,
                {
                  id: Date.now(),
                  sender: 'ai',
                  content: payload.new.content,
                  timestamp: new Date(payload.new.timestamp)
                }
              ];
            });
            
            setIsLoading(false);
            console.log('AI response added to UI via Realtime');
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
        
        // Handle connection issues with automatic reconnection
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime connection issue detected, reconnecting...');
          setTimeout(() => {
            supabase.removeChannel(channel);
            // Trigger re-subscription by forcing component re-mount logic
          }, 3000);
        }
      });

    return () => {
      console.log('Cleaning up Realtime subscription');
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Validate user data - show error if incomplete
  if (!user?.id || !user?.email) {
    console.error('SuccessPartner: Incomplete user data provided', {
      user
    });
    toast({
      title: "User Error",
      description: "Unable to initialize chat. Please refresh the page and try again.",
      variant: "destructive"
    });
    onClose();
    return null;
  }

  // Fetch credits on component mount
  useEffect(() => {
    const fetchCredits = async () => {
      try {
        const {
          data,
          error
        } = await supabase.functions.invoke('success-partner-credits', {
          method: 'GET'
        });
        if (error) {
          console.error('Error fetching credits:', error);
          return;
        }
        setCredits(data);
      } catch (error) {
        console.error('Error fetching credits:', error);
      } finally {
        setLoadingCredits(false);
      }
    };
    fetchCredits();
  }, []);

  // Fetch integration status on component mount and warm up cache
  useEffect(() => {
    const fetchIntegrationStatus = async () => {
      try {
        const integration = await StudentIntegrations.get(user.id);
        const status = {
          shopify: integration?.is_shopify_connected ?? false,
          metaAds: integration?.is_meta_connected ?? false,
          loading: false
        };
        setIntegrationStatus(status);

        // Cache warming removed - we now only fetch when user query requires it
      } catch (error) {
        console.error('Error fetching integration status:', error);
        setIntegrationStatus(prev => ({
          ...prev,
          loading: false
        }));
      }
    };
    fetchIntegrationStatus();
  }, [user.id]);

  // Function to update credits after successful message
  const updateCredits = useCallback(async () => {
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('success-partner-credits', {
        method: 'POST'
      });
      if (error) {
        console.error('Error updating credits:', error);
        return;
      }
      setCredits(data);
    } catch (error) {
      console.error('Error updating credits:', error);
    }
  }, []);

  // Helper: sleep
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // Helper: fetch business context with retries until both services are ready
  const fetchContextUntilReady = async (studentId: string, flags: { includeShopify: boolean; includeMetaAds: boolean }) => {
    const start = Date.now();
    const MAX_WAIT_MS = 120000; // up to 2 minutes
    const SHOPIFY_TIMEOUT = 30000;
    const META_TIMEOUT = 60000;
    let lastContext: any = null;
    while (Date.now() - start < MAX_WAIT_MS) {
      try {
        const ctx = await buildBusinessContext(
          studentId, 
          flags, 
          Math.max(SHOPIFY_TIMEOUT, META_TIMEOUT), 
          { shopify: SHOPIFY_TIMEOUT, metaAds: META_TIMEOUT },
          dateRangeDays
        );
        lastContext = ctx;
        const shopifyReady = !flags.includeShopify || !!ctx?.shopify?.metrics || ctx?.shopify?.connected === true;
        const metaReady = !flags.includeMetaAds || !!ctx?.metaAds?.metrics || ctx?.metaAds?.connected === true;
        if (shopifyReady && metaReady) return ctx;
      } catch (e: any) {
        safeLogger.warn('Business context fetch attempt failed, retrying...', { error: e?.message });
      }
      await sleep(1500);
    }
    return lastContext;
  };

  const sendMessageToBackend = useCallback(async (userMessage: string, studentName: string): Promise<void> => {
    try {
      // Use explicit flags if set (from badge click), otherwise detect from message
      const requestedFlags = explicitContextFlags || detectBusinessContext(userMessage);
      const flags = {
        includeShopify: requestedFlags.includeShopify && integrationStatus.shopify,
        includeMetaAds: requestedFlags.includeMetaAds && integrationStatus.metaAds
      };
      const needsContext = flags.includeShopify || flags.includeMetaAds;
      
      // Clear explicit flags after use
      if (explicitContextFlags) {
        setExplicitContextFlags(null);
      }
      
      let businessContext = null;
      if (needsContext) {
        setIsFetchingContext(true);
        const description = `Fetching ${
          flags.includeShopify && flags.includeMetaAds ? 'Shopify & Meta Ads' :
          flags.includeShopify ? 'Shopify' :
          'Meta Ads'
        } data (last ${dateRangeDays} days)...`;
        setContextDescription(description);
        
        try {
          businessContext = await fetchContextUntilReady(user.id, flags);

          if (businessContext) {
            const disconnectedServices: string[] = [];
            if (businessContext.shopify?.connected === false) {
              disconnectedServices.push('Shopify');
            }
            if (businessContext.metaAds?.connected === false) {
              disconnectedServices.push('Meta Ads');
            }
            if (disconnectedServices.length > 0) {
              setMessages(prev => [...prev, {
                id: Date.now(),
                sender: "ai",
                content: `⚠️ ${disconnectedServices.join(' and ')} not connected. Connect them in Settings → Integrations to get personalized insights.`,
                timestamp: new Date()
              }]);
            }
          }
        } catch (error) {
          console.error("Error fetching business context:", error);
          setMessages(prev => [...prev, {
            id: Date.now(),
            sender: "ai",
            content: "⚠️ I'm having trouble fetching your business data right now. I'll continue without those metrics, but you may want to check your integrations.",
            timestamp: new Date()
          }]);
        } finally {
          setIsFetchingContext(false);
          setContextDescription("");
        }
      }

      const finalBusinessContext = businessContext || {};
      
      safeLogger.info('Success Partner: Sending message to backend', {
        userId: user.id,
        messageLength: userMessage.length,
        hasBusinessContext: !!businessContext
      });

      // Call edge function to process message in background
      const { data, error } = await supabase.functions.invoke('process-success-partner-message', {
        body: {
          message: userMessage,
          studentName,
          conversationHistory: messages
            .filter(m => m.sender !== 'loading')
            .map(m => ({
              role: m.sender === 'user' ? 'user' : 'assistant',
              content: m.content,
              timestamp: m.timestamp.toISOString()
            })),
          businessContext: {
            ...finalBusinessContext,
            currency: ENV_CONFIG.DEFAULT_CURRENCY,
            dateRangeDays
          },
          dateRangeDays
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        
        // Handle specific error types
        let errorMessage = "⚠️ I'm having trouble connecting to my services right now. Please try again in a moment.";
        
        if (error.status === 429 || error.message?.includes('rate limit')) {
          errorMessage = "⚠️ Daily message limit reached. Your credits will reset at midnight UTC. Please try again tomorrow.";
        } else if (error.status === 402) {
          errorMessage = "⚠️ Credit limit reached. Please contact support to increase your daily limit.";
        } else if (error.status === 403) {
          errorMessage = "⚠️ You don't have permission to use this feature. Please contact your administrator.";
        } else if (error.status === 408 || error.message?.includes('timeout')) {
          errorMessage = "⚠️ The request timed out. Please try with a shorter message or try again later.";
        } else if (error.message?.includes('token') && error.message?.includes('expired')) {
          errorMessage = "⚠️ Your session has expired. Please refresh the page and try again.";
        }
        
        setMessages(prev => {
          const withoutLoading = prev.filter(m => m.sender !== 'loading');
          return [...withoutLoading, {
            id: Date.now(),
            sender: "ai",
            content: errorMessage,
            timestamp: new Date()
          }];
        });
        setIsLoading(false);
        return;
      }

      console.log('Message sent to backend for processing:', data);
      
    } catch (error: any) {
      console.error('Backend call error:', error);
      
      // Handle specific error types
      let errorMessage = "⚠️ I'm having trouble connecting to my services right now. Please try again in a moment.";
      
      if (error.status === 429 || error.message?.includes('rate limit')) {
        errorMessage = "⚠️ Daily message limit reached. Your credits will reset at midnight UTC. Please try again tomorrow.";
      } else if (error.status === 402) {
        errorMessage = "⚠️ Credit limit reached. Please contact support to increase your daily limit.";
      } else if (error.status === 403) {
        errorMessage = "⚠️ You don't have permission to use this feature. Please contact your administrator.";
      } else if (error.status === 408 || error.message?.includes('timeout')) {
        errorMessage = "⚠️ The request timed out. Please try with a shorter message or try again later.";
      } else if (error.message?.includes('network') || error.message?.includes('connection')) {
        errorMessage = "⚠️ Network connection issue. Please check your internet and try again.";
      }
      
      // Add user-facing error message
      setMessages(prev => {
        const withoutLoading = prev.filter(m => m.sender !== 'loading');
        return [...withoutLoading, {
          id: Date.now(),
          sender: "ai",
          content: errorMessage,
          timestamp: new Date()
        }];
      });
      setIsLoading(false);
      throw error;
    }
  }, [user, integrationStatus, messages, dateRangeDays, explicitContextFlags]);
  const handleSendMessage = useCallback(async () => {
    // Prevent double-sends: block if already loading or message is empty
    if (!message.trim() || isLoading) {
      if (import.meta.env.DEV) {
        safeLogger.warn('Success Partner: Message sending blocked', {
          messageEmpty: !message.trim(),
          isLoading
        });
      }
      return;
    }

    const currentMessage = message.trim();
    
    // Clear input immediately to prevent accidental double-sends
    setMessage("");

    // Check if user has remaining credits
    if (credits && !credits.can_send_message) {
      toast({
        title: "Daily Limit Reached",
        description: `You've used all ${credits.daily_limit} credits for today. Credits reset at midnight UTC.`,
        variant: "destructive"
      });
      return;
    }

    // Validate integration requirements BEFORE sending - only block SPECIFIC service mentions
    const lowerMessage = message.toLowerCase();

    // Specific Shopify keywords (not general business terms)
    const shopifyKeywords = ['shopify', 'store', 'product', 'inventory', 'order'];
    const hasShopifyKeyword = shopifyKeywords.some(keyword => lowerMessage.includes(keyword));
    if (hasShopifyKeyword && !integrationStatus.shopify) {
      toast({
        title: "Shopify Not Connected",
        description: "To analyze your Shopify data, please connect your account first in Settings → Integrations",
        variant: "destructive"
      });
      return;
    }

    // Specific Meta Ads keywords (not general business terms)
    const metaKeywords = ['meta', 'facebook', 'instagram', 'ads', 'campaign', 'roas', 'cpc', 'ctr'];
    const hasMetaKeyword = metaKeywords.some(keyword => lowerMessage.includes(keyword));
    if (hasMetaKeyword && !integrationStatus.metaAds) {
      toast({
        title: "Meta Ads Not Connected",
        description: "To analyze your ad performance, please connect your Meta Ads account first in Settings → Integrations",
        variant: "destructive"
      });
      return;
    }
    const userMessage: Message = {
      id: Date.now(),
      sender: "user",
      content: currentMessage,
      timestamp: new Date()
    };
    const loadingMessage: Message = {
      id: Date.now() + 1,
      sender: "loading",
      content: isFetchingContext 
        ? contextDescription || "Analyzing your business data..." 
        : "Processing your message...",
      timestamp: new Date()
    };

    // Add user message and loading indicator
    setMessages(prev => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    // Save user message to database FIRST (await to ensure it completes even if modal closes)
    try {
      const { error: userInsertError } = await supabase.from('success_partner_messages').insert({
        user_id: user.id,
        role: 'user',
        content: userMessage.content,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      });
      
      if (userInsertError) {
        console.error('Failed to save user message to database:', userInsertError);
        toast({
          title: "Warning",
          description: "Your message may not persist after refresh. Please try again if needed.",
          variant: "destructive"
        });
        // Still continue to send to backend even if DB save fails
      } else {
        toast({
          title: "Message sent",
          description: "I'll reply shortly.",
        });
      }
    } catch (dbError) {
      console.error('Failed to save user message to database:', dbError);
    }
    
    // Fire-and-forget backend call (response comes via Realtime, so no need to await)
    const studentName = user.full_name || user.email.split('@')[0] || 'Student';
    
    // Don't await - let it run in background. Response will arrive via Realtime subscription
    sendMessageToBackend(userMessage.content, studentName).then(() => {
      console.log('Message sent to backend successfully');
      // Update credits after backend processes (fire-and-forget)
      updateCredits().catch(e => console.error('Failed to update credits:', e));
    }).catch(error => {
      console.error('Backend processing failed:', error);
      // Error handling is done inside sendMessageToBackend
    });

    // Set a safety timeout to remove loading state if no response after 60 seconds
    setTimeout(() => {
      setMessages(prev => {
        const hasAiResponse = prev.some(m => 
          m.sender === 'ai' && 
          m.timestamp.getTime() > userMessage.timestamp.getTime()
        );
        
        if (!hasAiResponse && prev.some(m => m.sender === 'loading')) {
          const withoutLoading = prev.filter(m => m.sender !== 'loading');
          return [...withoutLoading, {
            id: Date.now(),
            sender: "ai" as const,
            content: "⏱️ This is taking longer than expected. Your response should arrive shortly. If it doesn't, please try asking again.",
            timestamp: new Date()
          }];
        }
        return prev;
      });
      setIsLoading(false);
    }, 60000);

    // Note: AI response will be added via Realtime subscription
    // Loading state will be cleared when the response arrives
  }, [message, isLoading, sendMessageToBackend, updateCredits, credits, integrationStatus, toast, user]);
  return <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl h-[600px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-green-600 rounded-full flex items-center justify-center text-white font-bold">
                <Brain className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg">Success Partner</CardTitle>
                <p className="text-sm text-gray-600">Your AI Success Mentor</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {/* Conversation History Display */}
              
              
              {/* Credits Display */}
              {loadingCredits ? <Badge variant="outline" className="flex items-center space-x-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading...</span>
                </Badge> : credits ? <Badge variant={credits.credits_remaining <= 2 ? "destructive" : credits.credits_remaining <= 5 ? "secondary" : "outline"} className="flex items-center space-x-1">
                  <MessageSquare className="w-3 h-3" />
                  <span>{credits.credits_remaining}/{credits.daily_limit}</span>
                </Badge> : null}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          {/* Date Range Selector - only show when integrations are connected */}
          {(integrationStatus.shopify || integrationStatus.metaAds) && (
            <div className="mt-3 flex items-center gap-2 p-2 bg-muted/50 rounded-md">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Data period:</span>
              <select
                value={dateRangeDays}
                onChange={(e) => setDateRangeDays(Number(e.target.value))}
                className="px-3 py-1 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              >
                <option value={7}>Last 7 days</option>
                <option value={14}>Last 14 days</option>
                <option value={30}>Last 30 days</option>
                <option value={60}>Last 60 days</option>
                <option value={90}>Last 90 days</option>
              </select>
            </div>
          )}

          {/* Integration Warning Banner */}
          {!integrationStatus.loading && (!integrationStatus.shopify || !integrationStatus.metaAds) && <div className="mt-3 p-3 bg-amber-50 border-l-4 border-amber-400 rounded">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <p className="text-sm text-amber-800 font-medium">
                    {!integrationStatus.shopify && !integrationStatus.metaAds ? "Connect Shopify and Meta Ads to unlock business insights" : !integrationStatus.shopify ? "Connect Shopify to analyze your store performance" : "Connect Meta Ads to analyze your ad campaigns"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => window.location.href = '/connect'} className="text-xs shrink-0">
                  Go to Integrations
                </Button>
              </div>
            </div>}
          
          {/* Credits Warning */}
          {credits && credits.credits_remaining <= 2 && credits.credits_remaining > 0 && <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-yellow-800">
                <Clock className="w-4 h-4" />
                <span>Only {credits.credits_remaining} credits remaining today. Resets at midnight UTC.</span>
              </div>
            </div>}
          
          {/* No Credits Left */}
          {credits && credits.credits_remaining === 0 && <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-md">
              <div className="flex items-center space-x-2 text-sm text-red-800">
                <Clock className="w-4 h-4" />
                <span>Daily limit reached. Your {credits.daily_limit} credits will reset at midnight UTC.</span>
              </div>
            </div>}
        </CardHeader>

        {/* Context Fetching Indicator */}
        {isFetchingContext && contextDescription && <div className="mx-4 mb-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-2 text-sm text-blue-800">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{contextDescription}</span>
            </div>
          </div>}

        {/* Messages */}
        <CardContent className="flex-1 overflow-y-auto space-y-4">
          {messages.map(msg => <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] p-3 rounded-lg ${msg.sender === "user" ? "bg-primary text-primary-foreground" : msg.sender === "loading" ? "bg-muted text-muted-foreground animate-pulse" : "bg-muted/50 text-foreground italic"}`}>
                {msg.sender === "loading" && <div className="flex items-center space-x-2">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span className="text-sm">AI Assistant is thinking...</span>
                  </div>}
                {msg.sender !== "loading" && <>
                    {msg.sender === "ai" && <p className="text-xs font-medium mb-1 opacity-70">AI Assistant</p>}
                    <div className="text-sm prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground">
                      <ReactMarkdown
                        components={{
                          h3: ({node, ...props}) => <h3 className="text-base font-bold mt-3 mb-2" {...props} />,
                          h4: ({node, ...props}) => <h4 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                          p: ({node, ...props}) => <p className="mb-2 leading-relaxed" {...props} />,
                          ul: ({node, ...props}) => <ul className="list-disc ml-4 mb-2 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal ml-4 mb-2 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="leading-relaxed" {...props} />,
                          strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                          code: ({node, ...props}) => <code className="bg-black/10 dark:bg-white/10 px-1 py-0.5 rounded text-xs" {...props} />,
                        }}
                      >
                        {typeof msg.content === 'string' ? msg.content : String(msg.content)}
                      </ReactMarkdown>
                    </div>
                    <p className="text-xs opacity-70 mt-1">
                      {msg.timestamp.toLocaleTimeString()}
                    </p>
                  </>}
              </div>
            </div>)}
        </CardContent>

        {/* Input */}
        <div className="flex-shrink-0 p-4 border-t">
          <div className="flex space-x-2">
            <Input 
              placeholder="Ask about videos, assignments, or course content..." 
              value={message} 
              onChange={e => setMessage(e.target.value)} 
              onKeyPress={e => {
                if (e.key === "Enter" && !e.shiftKey && !isLoading) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              disabled={isLoading || (credits && !credits.can_send_message)}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={isLoading || !message.trim() || (credits && !credits.can_send_message)}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="sr-only">Sending...</span>
                </>
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          
          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${!integrationStatus.shopify || credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
            if (integrationStatus.shopify && credits && credits.can_send_message) {
              setMessage("Study my Shopify sales");
              setExplicitContextFlags({ includeShopify: true, includeMetaAds: false });
            } else if (!integrationStatus.shopify) {
              toast({
                title: "Shopify Not Connected",
                description: "Please connect your Shopify account first in Settings → Integrations",
                variant: "destructive"
              });
            }
          }} title={!integrationStatus.shopify ? "Connect Shopify first" : ""}>
              <TrendingUp className="w-3 h-3 mr-1" />
              Analyze Shopify
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${!integrationStatus.metaAds || credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
            if (integrationStatus.metaAds && credits && credits.can_send_message) {
              setMessage("Review my ad performance");
              setExplicitContextFlags({ includeShopify: false, includeMetaAds: true });
            } else if (!integrationStatus.metaAds) {
              toast({
                title: "Meta Ads Not Connected",
                description: "Please connect your Meta Ads account first in Settings → Integrations",
                variant: "destructive"
              });
            }
          }} title={!integrationStatus.metaAds ? "Connect Meta Ads first" : ""}>
              <BarChart3 className="w-3 h-3 mr-1" />
              Review Ads
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
              if (credits && credits.can_send_message) {
                setMessage("I'm stuck on the current assignment");
                setExplicitContextFlags(null); // No context needed for this
              }
            }}>
              Assignment Help
            </Badge>
            <Badge variant="outline" className={`cursor-pointer hover:bg-gray-100 ${credits && !credits.can_send_message ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={() => {
              if (credits && credits.can_send_message) {
                setMessage("I'm feeling demotivated");
                setExplicitContextFlags(null); // No context needed for this
              }
            }}>
              Need Motivation
            </Badge>
          </div>
        </div>
      </Card>
    </div>;
};
export default SuccessPartner;