import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export interface CardProps extends ComponentPropsWithoutRef<'div'> {
  size?: 'default' | 'sm';
}

export function Card({ className, size = 'default', ...props }: CardProps) {
  return (
    <div
      {...props}
      className={cn('tap-card', className)}
      data-size={size}
      data-slot="card"
    />
  );
}

export function CardHeader({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__header', className)}
      data-slot="card-header"
    />
  );
}

export function CardTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__title', className)}
      data-slot="card-title"
    />
  );
}

export function CardDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__description', className)}
      data-slot="card-description"
    />
  );
}

export function CardAction({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__action', className)}
      data-slot="card-action"
    />
  );
}

export function CardContent({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__content', className)}
      data-slot="card-content"
    />
  );
}

export function CardFooter({
  className,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      {...props}
      className={cn('tap-card__footer', className)}
      data-slot="card-footer"
    />
  );
}
