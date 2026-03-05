import React from 'react';
import { cn } from '../utils/cn';

export interface TapButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
}

const variantStyles: Record<NonNullable<TapButtonProps['variant']>, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary:
    'bg-white text-neutral-900 border border-neutral-300 hover:bg-neutral-50',
  ghost: 'text-neutral-700 hover:bg-neutral-100',
  destructive: 'bg-red-600 text-white hover:bg-red-700',
};

const sizeStyles: Record<NonNullable<TapButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function TapButton({
  variant = 'primary',
  size = 'md',
  className,
  disabled,
  ...props
}: TapButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
        variantStyles[variant],
        sizeStyles[size],
        className,
      )}
      disabled={disabled}
      {...props}
    />
  );
}
