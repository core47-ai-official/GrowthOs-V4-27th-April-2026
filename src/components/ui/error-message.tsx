import { AlertCircle, RefreshCw, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserError } from "@/lib/error-handler";

interface ErrorMessageProps {
  error?: UserError | string;
  className?: string;
  showIcon?: boolean;
  showRetry?: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  inline?: boolean;
}

export function ErrorMessage({
  error,
  className,
  showIcon = true,
  showRetry = false,
  onRetry,
  onDismiss,
  inline = false
}: ErrorMessageProps) {
  if (!error) return null;

  const errorText = typeof error === 'string' ? error : error.message;
  const actionText = typeof error === 'object' ? error.action : undefined;

  return (
    <Alert 
      variant="destructive" 
      className={cn(
        "border-destructive/20 bg-destructive/5",
        inline && "border-l-4 border-l-destructive border-y-0 border-r-0 bg-transparent pl-4 py-2",
        className
      )}
    >
      <div className="flex items-start gap-2">
        {showIcon && (
          <AlertCircle className="h-4 w-4 mt-0.5 text-destructive flex-shrink-0" />
        )}
        
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-sm text-destructive">
            {errorText}
            {actionText && (
              <span className="block mt-1 text-muted-foreground">
                {actionText}
              </span>
            )}
          </AlertDescription>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {showRetry && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRetry}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDismiss}
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </Alert>
  );
}

// Field-level error message for forms
interface FieldErrorProps {
  error?: string;
  className?: string;
}

export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  return (
    <p className={cn("text-sm text-destructive mt-1", className)}>
      {error}
    </p>
  );
}