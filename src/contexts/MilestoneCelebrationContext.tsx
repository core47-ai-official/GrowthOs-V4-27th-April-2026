import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { safeLogger } from '@/lib/safe-logger';

interface CelebrationData {
  milestone_id: string;
  milestone_name: string;
  celebration_message: string;
  points: number;
  icon: string;
}

interface MilestoneCelebrationContextType {
  showCelebration: boolean;
  celebrationData: CelebrationData | null;
  triggerCelebration: (data: CelebrationData) => void;
  closeCelebration: () => void;
}

const MilestoneCelebrationContext = createContext<MilestoneCelebrationContextType | undefined>(undefined);

export const useMilestoneCelebration = () => {
  const context = useContext(MilestoneCelebrationContext);
  if (!context) {
    throw new Error('useMilestoneCelebration must be used within a MilestoneCelebrationProvider');
  }
  return context;
};

export const MilestoneCelebrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<CelebrationData | null>(null);

  const triggerCelebration = (data: CelebrationData) => {
    setCelebrationData(data);
    setShowCelebration(true);
    
    // Add confetti effect to body
    document.body.classList.add('celebration-active');
    
    // Auto-close after 8 seconds if user doesn't close manually
    setTimeout(() => {
      closeCelebration();
    }, 8000);
  };

  const closeCelebration = () => {
    setShowCelebration(false);
    setCelebrationData(null);
    document.body.classList.remove('celebration-active');
  };

  // Listen for milestone celebration notifications
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to notifications for milestone celebrations
    const channel = supabase
      .channel('milestone-celebrations')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          const notification = payload.new;
          if (notification.type === 'milestone_celebration') {
            const data = notification.payload;
            if (data.data) {
              triggerCelebration({
                milestone_id: data.data.milestone_id,
                milestone_name: data.data.milestone_name,
                celebration_message: data.data.celebration_message,
                points: data.data.points,
                icon: data.data.icon
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <MilestoneCelebrationContext.Provider
      value={{
        showCelebration,
        celebrationData,
        triggerCelebration,
        closeCelebration
      }}
    >
      {children}
    </MilestoneCelebrationContext.Provider>
  );
};