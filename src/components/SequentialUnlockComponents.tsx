import React from 'react';
import { Lock, Unlock, Eye, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

interface SequentialLockIndicatorProps {
  isLocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentStatus: 'pending' | 'approved' | 'declined' | 'not_submitted';
  unlockReason?: string;
  className?: string;
}

export const SequentialLockIndicator: React.FC<SequentialLockIndicatorProps> = ({
  isLocked,
  isWatched,
  hasAssignment,
  assignmentStatus,
  unlockReason,
  className = ''
}) => {
  // Determine the primary status
  const getStatusInfo = () => {
    if (isLocked) {
      // Check if it's a payment-related lock
      const isPaymentRequired = unlockReason?.includes('Payment required') || unlockReason?.includes('fees');
      
      return {
        icon: Lock,
        text: isPaymentRequired ? 'Payment Required' : 'Locked',
        variant: isPaymentRequired ? 'destructive' as const : 'secondary' as const,
        description: isPaymentRequired 
          ? 'Clear fees to unlock first recording' 
          : 'Complete previous requirements to unlock'
      };
    }
    
    if (isWatched) {
      if (hasAssignment) {
        switch (assignmentStatus) {
          case 'approved':
            return {
              icon: CheckCircle,
              text: 'Completed',
              variant: 'default' as const,
              description: 'Assignment approved - ready for next'
            };
          case 'pending':
            return {
              icon: Eye,
              text: 'Under Review',
              variant: 'outline' as const,
              description: 'Assignment submitted, awaiting review'
            };
          case 'declined':
            return {
              icon: Eye,
              text: 'Needs Resubmission',
              variant: 'destructive' as const,
              description: 'Assignment needs to be resubmitted'
            };
          case 'not_submitted':
            return {
              icon: Eye,
              text: 'Assignment Ready',
              variant: 'outline' as const,
              description: 'Video watched - submit assignment to continue'
            };
        }
      } else {
        return {
          icon: CheckCircle,
          text: 'Watched',
          variant: 'default' as const,
          description: 'Video completed - ready for next'
        };
      }
    }
    
    return {
      icon: Unlock,
      text: 'Available',
      variant: 'outline' as const,
      description: 'Ready to watch'
    };
  };

  const { icon: StatusIcon, text, variant, description } = getStatusInfo();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="flex items-center gap-1">
        <StatusIcon className="w-4 h-4" />
        <Badge variant={variant} className="text-xs">
          {text}
        </Badge>
      </div>
      
      {unlockReason && !isLocked && (
        <span className="text-xs text-muted-foreground">
          {unlockReason}
        </span>
      )}
      
      <span className="text-xs text-muted-foreground" title={description}>
        {description}
      </span>
    </div>
  );
};

interface SequentialProgressCardProps {
  recordingTitle: string;
  sequenceOrder: number;
  isLocked: boolean;
  isWatched: boolean;
  hasAssignment: boolean;
  assignmentStatus: 'pending' | 'approved' | 'declined' | 'not_submitted';
  unlockReason?: string;
  onWatch?: () => void;
  onAssignment?: () => void;
  className?: string;
}

export const SequentialProgressCard: React.FC<SequentialProgressCardProps> = ({
  recordingTitle,
  sequenceOrder,
  isLocked,
  isWatched,
  hasAssignment,
  assignmentStatus,
  unlockReason,
  onWatch,
  onAssignment,
  className = ''
}) => {
  return (
    <Card className={`${className} ${isLocked ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">
                #{sequenceOrder}
              </span>
              <h3 className="font-semibold">{recordingTitle}</h3>
            </div>
            
            <SequentialLockIndicator
              isLocked={isLocked}
              isWatched={isWatched}
              hasAssignment={hasAssignment}
              assignmentStatus={assignmentStatus}
              unlockReason={unlockReason}
            />
          </div>
          
          <div className="flex flex-col gap-2 ml-4">
            {!isLocked && (
              <button
                onClick={onWatch}
                disabled={isLocked}
                className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {isWatched ? 'Watch Again' : 'Watch Now'}
              </button>
            )}
            
            {hasAssignment && isWatched && !isLocked && (
              <button
                onClick={onAssignment}
                disabled={assignmentStatus === 'approved'}
                className="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded hover:bg-secondary/90 disabled:opacity-50"
              >
                {assignmentStatus === 'approved' 
                  ? 'Completed' 
                  : assignmentStatus === 'declined'
                  ? 'Resubmit'
                  : assignmentStatus === 'pending'
                  ? 'View Status'
                  : 'Submit Assignment'
                }
              </button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};