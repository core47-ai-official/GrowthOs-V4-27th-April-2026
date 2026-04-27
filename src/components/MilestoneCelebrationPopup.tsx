import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { X, Share2, Trophy, Sparkles } from 'lucide-react';
import { useMilestoneCelebration } from '@/contexts/MilestoneCelebrationContext';
import { useToast } from '@/hooks/use-toast';

const ConfettiPiece: React.FC<{ delay: number }> = ({ delay }) => {
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-full opacity-80"
      style={{ backgroundColor: color }}
      initial={{ 
        x: Math.random() * window.innerWidth,
        y: -10,
        rotate: 0,
        opacity: 1 
      }}
      animate={{ 
        y: window.innerHeight + 10,
        rotate: 360,
        opacity: 0 
      }}
      transition={{ 
        duration: 3 + Math.random() * 2,
        delay: delay,
        ease: "easeOut" 
      }}
    />
  );
};

const Confetti: React.FC<{ active: boolean }> = ({ active }) => {
  const [pieces, setPieces] = useState<number[]>([]);

  useEffect(() => {
    if (active) {
      const newPieces = Array.from({ length: 50 }, (_, i) => i);
      setPieces(newPieces);
      
      // Clear pieces after animation
      setTimeout(() => setPieces([]), 5000);
    }
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]">
      {pieces.map((piece, index) => (
        <ConfettiPiece key={piece} delay={index * 0.1} />
      ))}
    </div>
  );
};

export const MilestoneCelebrationPopup: React.FC = () => {
  const { showCelebration, celebrationData, closeCelebration } = useMilestoneCelebration();
  const { toast } = useToast();
  const [soundPlayed, setSoundPlayed] = useState(false);

  // Play celebration sound (using Web Audio API for a simple tone)
  const playCelebrationSound = () => {
    if (soundPlayed) return;
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2); // G5
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      
      setSoundPlayed(true);
    } catch (error) {
      // Silently fail if audio is not supported
    }
  };

  const handleShare = () => {
    const text = `🎉 I just earned the "${celebrationData?.milestone_name}" milestone! ${celebrationData?.celebration_message}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Milestone Achievement!',
        text: text,
        url: window.location.href
      }).catch(() => {
        // Fallback to clipboard
        copyToClipboard(text);
      });
    } else {
      copyToClipboard(text);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Achievement copied!",
        description: "Your milestone achievement has been copied to clipboard.",
      });
    }).catch(() => {
      toast({
        title: "Share your achievement",
        description: text,
      });
    });
  };

  useEffect(() => {
    if (showCelebration && !soundPlayed) {
      playCelebrationSound();
    }
    if (!showCelebration) {
      setSoundPlayed(false);
    }
  }, [showCelebration, soundPlayed]);

  return (
    <>
      <Confetti active={showCelebration} />
      <AnimatePresence>
        {showCelebration && celebrationData && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeCelebration}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ scale: 0.5, rotateY: -180, opacity: 0 }}
              animate={{ scale: 1, rotateY: 0, opacity: 1 }}
              exit={{ scale: 0.5, rotateY: 180, opacity: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 300, 
                damping: 20,
                duration: 0.6 
              }}
              className="relative max-w-md w-full"
            >
              <Card className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-secondary/10 border-2 border-primary/20 shadow-2xl">
                {/* Background sparkles */}
                <div className="absolute inset-0 opacity-20">
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute"
                      style={{
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      animate={{
                        scale: [0, 1, 0],
                        rotate: [0, 180, 360],
                        opacity: [0, 1, 0],
                      }}
                      transition={{
                        duration: 2,
                        delay: i * 0.1,
                        repeat: Infinity,
                        repeatDelay: 3,
                      }}
                    >
                      <Sparkles className="w-3 h-3 text-primary" />
                    </motion.div>
                  ))}
                </div>

                {/* Close button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 z-10 text-muted-foreground hover:text-foreground"
                  onClick={closeCelebration}
                >
                  <X className="w-4 h-4" />
                </Button>

                <div className="p-6 text-center space-y-4 relative z-10">
                  {/* Icon with animation */}
                  <motion.div
                    className="relative mx-auto w-20 h-20 flex items-center justify-center"
                    animate={{
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      repeatType: "reverse",
                    }}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-xl" />
                    <div className="relative text-6xl">
                      {celebrationData.icon}
                    </div>
                  </motion.div>

                  {/* Celebration text */}
                  <div className="space-y-2">
                    <motion.h2 
                      className="text-2xl font-bold text-foreground"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                    >
                      🎉 Milestone Achieved!
                    </motion.h2>
                    
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.3 }}
                      className="space-y-2"
                    >
                      <h3 className="text-xl font-semibold text-primary">
                        {celebrationData.milestone_name}
                      </h3>
                      
                      {celebrationData.points > 0 && (
                        <Badge variant="secondary" className="text-sm">
                          <Trophy className="w-3 h-3 mr-1" />
                          {celebrationData.points} points
                        </Badge>
                      )}
                    </motion.div>

                    <motion.p
                      className="text-muted-foreground text-sm leading-relaxed max-w-xs mx-auto"
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      {celebrationData.celebration_message}
                    </motion.p>
                  </div>

                  {/* Action buttons */}
                  <motion.div
                    className="flex gap-2 justify-center pt-4"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5 }}
                  >
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleShare}
                      className="flex items-center gap-2"
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </Button>
                    <Button 
                      onClick={closeCelebration}
                      size="sm"
                      className="bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                    >
                      Continue Learning!
                    </Button>
                  </motion.div>
                </div>

                {/* Animated border glow */}
                <motion.div
                  className="absolute inset-0 border-2 border-primary/30 rounded-lg"
                  animate={{
                    boxShadow: [
                      "0 0 20px rgba(59, 130, 246, 0.3)",
                      "0 0 40px rgba(59, 130, 246, 0.6)",
                      "0 0 20px rgba(59, 130, 246, 0.3)",
                    ],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                  }}
                />
              </Card>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};