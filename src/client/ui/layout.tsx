import type { ComponentPropsWithoutRef } from 'react';
import { cn } from './cn';

/** Spacing values supported by the layout primitives. */
export type Space = 4 | 8 | 12 | 16 | 24 | 32 | 40;

/** Props for a vertical stack layout. */
export interface StackProps extends ComponentPropsWithoutRef<'div'> {
  'data-slot'?: string;
  gap?: Space;
}

/** Arranges children vertically with a tokenized gap. */
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

/** Cross-axis alignment values supported by {@link Inline}. */
export type InlineAlign = 'start' | 'center' | 'end' | 'stretch';
/** Main-axis distribution values supported by {@link Inline}. */
export type InlineJustify = 'start' | 'center' | 'end' | 'between';

/** Props for a horizontal inline layout. */
export interface InlineProps extends ComponentPropsWithoutRef<'div'> {
  'data-slot'?: string;
  align?: InlineAlign;
  gap?: Space;
  justify?: InlineJustify;
}

/** Arranges children horizontally with tokenized alignment and spacing. */
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

/** Props for a responsive grid of equal columns. */
export interface GridProps extends ComponentPropsWithoutRef<'div'> {
  gap?: Space;
  /** The narrowest a column may get, in pixels, before the grid wraps. */
  minColumnWidth?: number;
}

/**
 * Lays children out in equal columns that wrap when the surface gets narrow.
 *
 * @example
 * ```tsx
 * import { Grid, Metric, Panel } from '@tappify/extension-sdk/ui';
 *
 * function Figures() {
 *   return (
 *     <Grid minColumnWidth={200}>
 *       <Panel>
 *         <Metric label="MRR" value="$24,860" />
 *       </Panel>
 *       <Panel>
 *         <Metric label="Active trials" value="164" />
 *       </Panel>
 *     </Grid>
 *   );
 * }
 * ```
 */
export function Grid({
  className,
  gap = 16,
  minColumnWidth = 220,
  style,
  ...props
}: GridProps) {
  return (
    <div
      {...props}
      className={cn('tap-grid', className)}
      data-gap={gap}
      data-slot="grid"
      style={{
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minColumnWidth}px, 100%), 1fr))`,
        ...style,
      }}
    />
  );
}
