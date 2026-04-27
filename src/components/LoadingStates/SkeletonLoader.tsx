import React from 'react';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'card' | 'avatar' | 'button' | 'text' | 'table-row';
  count?: number;
  height?: string;
  width?: string;
}

const skeletonVariants = {
  default: "h-4 w-full",
  card: "h-32 w-full rounded-lg",
  avatar: "h-10 w-10 rounded-full",
  button: "h-10 w-24 rounded-md",
  text: "h-4 w-3/4",
  'table-row': "h-12 w-full"
};

export function SkeletonLoader({ 
  className, 
  variant = 'default', 
  count = 1,
  height,
  width,
  ...props 
}: SkeletonProps) {
  const baseClasses = "animate-pulse bg-muted rounded-md";
  const variantClasses = skeletonVariants[variant];
  
  const style = {
    ...(height && { height }),
    ...(width && { width })
  };

  if (count === 1) {
    return (
      <div 
        className={cn(baseClasses, variantClasses, className)} 
        style={style}
        {...props} 
      />
    );
  }

  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, index) => (
        <div 
          key={index}
          className={cn(baseClasses, variantClasses, className)} 
          style={style}
          {...props} 
        />
      ))}
    </div>
  );
}

// Specialized skeleton components for common UI patterns
export function CardSkeleton({ className, ...props }: Omit<SkeletonProps, 'variant'>) {
  return (
    <div className={cn("border rounded-lg p-6 space-y-4", className)} {...props}>
      <SkeletonLoader variant="text" className="w-1/2" />
      <SkeletonLoader variant="text" count={3} />
      <SkeletonLoader variant="button" className="w-full" />
    </div>
  );
}

export function TableSkeleton({ 
  rows = 5, 
  columns = 4, 
  className,
  ...props 
}: { rows?: number; columns?: number } & Omit<SkeletonProps, 'variant' | 'count'>) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonLoader key={`header-${index}`} variant="text" className="h-6" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={`row-${rowIndex}`} 
          className="grid gap-4" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <SkeletonLoader key={`cell-${rowIndex}-${colIndex}`} variant="text" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <SkeletonLoader className="h-8 w-48" />
        <SkeletonLoader variant="button" />
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
      
      {/* Main content */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <SkeletonLoader className="h-6 w-32" />
          <TableSkeleton rows={8} columns={3} />
        </div>
        <div className="space-y-4">
          <SkeletonLoader className="h-6 w-32" />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}