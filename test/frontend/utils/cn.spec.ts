import { describe, expect, it } from 'vitest';
import { cn } from '../../../src/frontend/utils/cn';

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes (falsy values)', () => {
    const showBar = false;
    expect(cn('foo', showBar && 'bar', null, undefined, 'baz')).toBe('foo baz');
  });

  it('deduplicates conflicting Tailwind classes', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('merges Tailwind color variants correctly', () => {
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });
});
