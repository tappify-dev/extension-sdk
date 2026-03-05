import React from 'react';
import { cn } from '../utils/cn';

export interface TapEmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function TapEmptyState({
  title,
  description,
  action,
  icon,
  className,
}: TapEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && <div className="mb-4 text-neutral-400">{icon}</div>}
      <h3 className="text-base font-medium text-neutral-900">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
