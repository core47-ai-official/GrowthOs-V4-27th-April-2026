import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OnboardingStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'RETRY';

interface StatusBadgeProps {
  status: OnboardingStatus;
  step: 'EMAIL' | 'INVOICE';
  className?: string;
}

export function StatusBadge({ status, step, className }: StatusBadgeProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'SUCCESS':
        return {
          variant: 'default' as const,
          icon: CheckCircle,
          className: 'bg-green-100 text-green-800 hover:bg-green-100',
          ariaLabel: `${step.toLowerCase()} sent successfully`,
        };
      case 'PENDING':
        return {
          variant: 'secondary' as const,
          icon: Clock,
          className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
          ariaLabel: `${step.toLowerCase()} pending`,
        };
      case 'RETRY':
        return {
          variant: 'secondary' as const,
          icon: RotateCcw,
          className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
          ariaLabel: `${step.toLowerCase()} retrying`,
        };
      case 'FAILED':
        return {
          variant: 'destructive' as const,
          icon: XCircle,
          className: 'bg-red-100 text-red-800 hover:bg-red-100',
          ariaLabel: `${step.toLowerCase()} failed`,
        };
      default:
        return {
          variant: 'outline' as const,
          icon: Clock,
          className: '',
          ariaLabel: `${step.toLowerCase()} unknown status`,
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn('flex items-center gap-1 text-xs', config.className, className)}
      aria-label={config.ariaLabel}
    >
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}