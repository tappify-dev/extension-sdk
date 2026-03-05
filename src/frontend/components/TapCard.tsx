import React from 'react';
import { cn } from '../utils/cn';

export interface TapCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function TapCard({ className, children, ...props }: TapCardProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-neutral-200 bg-white p-6 shadow-sm',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
