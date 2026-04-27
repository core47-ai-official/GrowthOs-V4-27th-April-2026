import React from 'react';
import { DashboardSkeleton, TableSkeleton, CardSkeleton } from './SkeletonLoader';

interface PageSkeletonProps {
  type: 'dashboard' | 'table' | 'form' | 'profile' | 'settings';
  className?: string;
}

export function PageSkeleton({ type, className }: PageSkeletonProps) {
  const skeletonComponents = {
    dashboard: <DashboardSkeleton />,
    table: <TableSkeleton rows={10} columns={5} />,
    form: <FormSkeleton />,
    profile: <ProfileSkeleton />,
    settings: <SettingsSkeleton />
  };

  return (
    <div className={className}>
      {skeletonComponents[type]}
    </div>
  );
}

function FormSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="space-y-2">
        <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        <div className="h-4 w-full bg-muted rounded animate-pulse" />
      </div>
      
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="space-y-2">
          <div className="h-4 w-24 bg-muted rounded animate-pulse" />
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        </div>
      ))}
      
      <div className="flex gap-3 pt-4">
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
        <div className="h-10 w-24 bg-muted rounded animate-pulse" />
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <div className="h-20 w-20 bg-muted rounded-full animate-pulse" />
        <div className="space-y-2">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-4 w-24 bg-muted rounded animate-pulse" />
            <div className="h-6 w-full bg-muted rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, sectionIndex) => (
        <div key={sectionIndex} className="space-y-4">
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, itemIndex) => (
              <div key={itemIndex} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-1">
                  <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  <div className="h-3 w-48 bg-muted rounded animate-pulse" />
                </div>
                <div className="h-6 w-12 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}