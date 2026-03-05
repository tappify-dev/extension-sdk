import React from 'react';
import { cn } from '../utils/cn';

export interface TapPageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function TapPageHeader({
  title,
  description,
  actions,
  className,
}: TapPageHeaderProps) {
  return (
    <div
      className={cn('flex items-start justify-between gap-4 pb-6', className)}
    >
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </div>
  );
}
