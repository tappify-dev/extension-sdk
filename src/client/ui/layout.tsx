import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

export type Space = 4 | 8 | 12 | 16 | 24 | 32 | 40;

export interface StackProps extends ComponentPropsWithoutRef<'div'> {
  'data-slot'?: string;
  gap?: Space;
}

export function Stack({
  gap = 16,
  className,
  'data-slot': slot = 'stack',
  ...props
}: StackProps) {
  return (
    <div
      {...props}
      className={cn('tap-stack', className)}
      data-gap={gap}
      data-slot={slot}
    />
  );
}

export type InlineAlign = 'start' | 'center' | 'end' | 'stretch';
export type InlineJustify = 'start' | 'center' | 'end' | 'between';

export interface InlineProps extends ComponentPropsWithoutRef<'div'> {
  'data-slot'?: string;
  align?: InlineAlign;
  gap?: Space;
  justify?: InlineJustify;
}

export function Inline({
  align = 'center',
  gap = 8,
  justify = 'start',
  className,
  'data-slot': slot = 'inline',
  ...props
}: InlineProps) {
  return (
    <div
      {...props}
      className={cn('tap-inline', className)}
      data-align={align}
      data-gap={gap}
      data-justify={justify}
      data-slot={slot}
    />
  );
}
