import { cn } from '../utils/cn';

export interface TapSkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
}

export function TapSkeleton({
  className,
  variant = 'text',
  width,
  height,
}: TapSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-neutral-200',
        variant === 'text' && 'h-4 w-full rounded',
        variant === 'circular' && 'rounded-full',
        variant === 'rectangular' && 'rounded-md',
        className,
      )}
      style={{ width, height }}
    />
  );
}
