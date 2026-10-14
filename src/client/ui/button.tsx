import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'inverse'
  | 'destructive';

export type ButtonSize =
  | 'default'
  | 'compact'
  | 'xs'
  | 'sm'
  | 'lg'
  | 'icon'
  | 'icon-xs'
  | 'icon-sm'
  | 'icon-lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  size?: ButtonSize;
  variant?: ButtonVariant;
}

export function Button({
  'aria-busy': ariaBusy,
  children,
  className,
  disabled,
  loading = false,
  size = 'default',
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      aria-busy={ariaBusy ?? (loading || undefined)}
      className={cn('tap-button', className)}
      data-loading={loading || undefined}
      data-size={size}
      data-slot="button"
      data-variant={variant}
      disabled={loading ? true : disabled}
      type={type}
    >
      {loading ? (
        <span aria-hidden="true" className="tap-button__spinner" />
      ) : null}
      {children}
    </button>
  );
}
