import { useEffect } from 'react';
import { X, Info, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAnnouncementBanner } from '@/hooks/useAnnouncementBanner';

const colorStyles = {
  blue: {
    bg: 'bg-blue-600',
    text: 'text-white',
    icon: Info,
    hoverBg: 'hover:bg-blue-700'
  },
  yellow: {
    bg: 'bg-yellow-500',
    text: 'text-yellow-900',
    icon: AlertTriangle,
    hoverBg: 'hover:bg-yellow-600'
  },
  red: {
    bg: 'bg-red-600',
    text: 'text-white',
    icon: AlertCircle,
    hoverBg: 'hover:bg-red-700'
  },
  green: {
    bg: 'bg-green-600',
    text: 'text-white',
    icon: CheckCircle,
    hoverBg: 'hover:bg-green-700'
  }
};

interface AnnouncementBannerProps {
  onVisibilityChange?: (visible: boolean) => void;
}

export function AnnouncementBanner({ onVisibilityChange }: AnnouncementBannerProps) {
  const { settings, isVisible, dismiss } = useAnnouncementBanner();

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  const handleDismiss = () => {
    dismiss();
  };

  if (!isVisible || !settings) {
    return null;
  }

  const style = colorStyles[settings.background_color] || colorStyles.blue;
  const IconComponent = style.icon;

  return (
    <div className={cn(
      'fixed top-16 left-0 right-0 py-3 px-4',
      style.bg,
      style.text
    )} style={{ zIndex: 35 }}>
      <div className="max-w-7xl mx-auto flex items-center justify-center gap-3">
        <IconComponent className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium text-center flex-1">
          {settings.message}
        </p>
        {settings.dismissible && (
          <button
            onClick={handleDismiss}
            className={cn(
              'p-1 rounded-full transition-colors flex-shrink-0',
              style.hoverBg
            )}
            aria-label="Dismiss announcement"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Export hook for use in Layout
export { useAnnouncementBanner };
