import clsx, { type ClassValue as ClsxClassValue } from 'clsx';

/**
 * Anything `cn` accepts: a class string, a number, an array of these, a map of
 * class name to condition, or a value to drop.
 */
export type ClassValue = ClsxClassValue;

/**
 * Joins class names, dropping the ones that are `false`, `null` or `undefined`.
 *
 * @remarks
 * This is `clsx`, re-exported so a vendor surface needs no class-name dependency
 * of its own. It does not merge conflicting utility classes.
 *
 * @example
 * ```tsx
 * import { cn } from '@tappify/extension-sdk';
 *
 * function Row({ compact }: { compact: boolean }) {
 *   return <div className={cn('starter-row', compact && 'starter-row--compact')} />;
 * }
 * ```
 */
export function cn(...values: ClassValue[]): string {
  return clsx(values);
}
