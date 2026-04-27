import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'npm:@supabase/supabase-js@2.55.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MotivationalMessage {
  type: string;
  title: string;
  message: string;
  action?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get all active students (those who have been active in the last 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    const { data: activeUsers, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, last_active_at')
      .eq('role', 'student')
      .eq('lms_status', 'active')
      .gte('last_active_at', fiveMinutesAgo);

    if (usersError) {
      console.error('Error fetching active users:', usersError);
      return new Response('Error fetching users', { status: 500, headers: corsHeaders });
    }

    if (!activeUsers || activeUsers.length === 0) {
      console.log('No active users found');
      return new Response('No active users', { status: 200, headers: corsHeaders });
    }

    console.log(`Found ${activeUsers.length} active users`);

    // For each active user, generate a contextual motivational message
    for (const user of activeUsers) {
      try {
        const message = await generateContextualMessage(supabase, user);
        
        if (message) {
          // Send the notification
          await supabase
            .from('notifications')
            .insert({
              user_id: user.id,
              type: 'motivation',
              channel: 'system',
              status: 'sent',
              sent_at: new Date().toISOString(),
              payload: {
                title: message.title,
                message: message.message,
                metadata: {
                  type: message.type,
                  action: message.action,
                  generated_at: new Date().toISOString()
                }
              }
            });

          console.log(`Sent motivational notification to ${user.full_name}: ${message.title}`);
        }
      } catch (error) {
        console.error(`Error processing user ${user.id}:`, error);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: activeUsers.length,
        message: 'Motivational notifications processed'
      }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in motivational-notifications function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function generateContextualMessage(supabase: any, user: any): Promise<MotivationalMessage | null> {
  try {
    // Get user's assignment status
    const { data: pendingAssignments } = await supabase
      .from('assignment')
      .select(`
        assignment_id,
        assignment_title,
        due_date,
        assignment_submissions!left(status)
      `)
      .order('sequence_order');

    // Get user's recent activity
    const { data: recentActivity } = await supabase
      .from('user_activity_logs')
      .select('activity_type, occurred_at')
      .eq('user_id', user.id)
      .order('occurred_at', { ascending: false })
      .limit(10);

    // Get user's progress
    const { data: moduleProgress } = await supabase
      .from('user_module_progress')
      .select('module_id, is_completed')
      .eq('user_id', user.id);

    const completedModules = moduleProgress?.filter(p => p.is_completed).length || 0;
    const totalModules = moduleProgress?.length || 0;

    // Find pending assignments (not submitted or rejected)
    const userPendingAssignments = pendingAssignments?.filter(assignment => {
      const userSubmission = assignment.assignment_submissions?.find(sub => sub.user_id === user.id);
      return !userSubmission || userSubmission.status === 'rejected';
    }) || [];

    // Generate contextual messages based on user state
    const messages: MotivationalMessage[] = [];

    // Assignment-related messages
    if (userPendingAssignments.length > 0) {
      const overdueAssignments = userPendingAssignments.filter(a => 
        a.due_date && new Date(a.due_date) < new Date()
      );
      
      if (overdueAssignments.length > 0) {
        messages.push({
          type: 'assignment_overdue',
          title: '📝 Assignment Alert!',
          message: `You have ${overdueAssignments.length} overdue assignment${overdueAssignments.length > 1 ? 's' : ''}. Need help getting back on track?`,
          action: 'view_assignments'
        });
      } else {
        messages.push({
          type: 'assignment_pending',
          title: '💪 Keep Going!',
          message: `You have ${userPendingAssignments.length} pending assignment${userPendingAssignments.length > 1 ? 's' : ''}. You're doing great - are you stuck on something?`,
          action: 'view_assignments'
        });
      }
    }

    // Progress-based messages
    if (totalModules > 0) {
      const progressPercentage = Math.round((completedModules / totalModules) * 100);
      
      if (progressPercentage < 25) {
        messages.push({
          type: 'early_progress',
          title: '🚀 Great Start!',
          message: `You've completed ${completedModules} module${completedModules !== 1 ? 's' : ''} so far. Every expert was once a beginner. Keep pushing forward!`
        });
      } else if (progressPercentage < 50) {
        messages.push({
          type: 'quarter_progress',
          title: '🎯 You\'re on Fire!',
          message: `${progressPercentage}% complete! You're building real momentum. What's your next learning goal?`
        });
      } else if (progressPercentage < 75) {
        messages.push({
          type: 'half_progress',
          title: '⭐ Halfway Hero!',
          message: `Amazing! You're ${progressPercentage}% through your journey. The finish line is getting closer!`
        });
      } else if (progressPercentage < 100) {
        messages.push({
          type: 'almost_complete',
          title: '🏆 Almost There!',
          message: `You're ${progressPercentage}% complete! You're so close to achieving something incredible. Don't stop now!`
        });
      }
    }

    // Activity-based messages
    const lastActivity = recentActivity?.[0];
    if (lastActivity) {
      const timeSinceLastActivity = new Date().getTime() - new Date(lastActivity.occurred_at).getTime();
      const hoursSinceActivity = timeSinceLastActivity / (1000 * 60 * 60);

      if (hoursSinceActivity > 24 && hoursSinceActivity < 48) {
        messages.push({
          type: 'comeback',
          title: '👋 Welcome Back!',
          message: 'Great to see you again! Ready to continue your learning journey where you left off?'
        });
      }
    }

    // General motivational messages
    const generalMessages: MotivationalMessage[] = [
      {
        type: 'general_motivation',
        title: '💡 Did You Know?',
        message: 'Every small step you take today builds the foundation for your success tomorrow. Keep going!'
      },
      {
        type: 'general_motivation',
        title: '🌟 You\'re Amazing!',
        message: 'Your dedication to learning is inspiring. Remember, growth happens outside your comfort zone.'
      },
      {
        type: 'general_motivation',
        title: '🎯 Stay Focused!',
        message: 'Success isn\'t just about speed, it\'s about consistency. You\'re building something great!'
      },
      {
        type: 'general_motivation',
        title: '🚀 Keep Pushing!',
        message: 'The difference between ordinary and extraordinary is that little "extra". You\'ve got this!'
      },
      {
        type: 'question',
        title: '🤔 Quick Check-in',
        message: 'How are you feeling about your progress today? Remember, we\'re here to support you!'
      },
      {
        type: 'tip',
        title: '💪 Pro Tip',
        message: 'Break big tasks into smaller ones. Celebrate each small win - they add up to big achievements!'
      }
    ];

    // Combine contextual and general messages
    const allMessages = [...messages, ...generalMessages];
    
    // Randomly select a message (with bias toward contextual messages)
    if (allMessages.length === 0) return null;
    
    // 70% chance for contextual messages, 30% for general
    const useContextual = messages.length > 0 && Math.random() < 0.7;
    const selectedMessages = useContextual ? messages : generalMessages;
    
    const randomIndex = Math.floor(Math.random() * selectedMessages.length);
    return selectedMessages[randomIndex];

  } catch (error) {
    console.error('Error generating contextual message:', error);
    return null;
  }
}