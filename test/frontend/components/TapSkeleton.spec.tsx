import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapSkeleton } from '../../../src/frontend/components/TapSkeleton';

describe('TapSkeleton', () => {
  it('renders with default text variant', () => {
    const { container } = render(<TapSkeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('w-full');
  });

  it('renders circular variant', () => {
    const { container } = render(<TapSkeleton variant="circular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-full');
  });

  it('renders rectangular variant', () => {
    const { container } = render(<TapSkeleton variant="rectangular" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-md');
  });

  it('applies width and height styles', () => {
    const { container } = render(<TapSkeleton width={100} height={50} />);
    const el = container.firstChild as HTMLElement;
    expect(el.style.width).toBe('100px');
    expect(el.style.height).toBe('50px');
  });

  it('applies custom className', () => {
    const { container } = render(<TapSkeleton className="my-class" />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('my-class');
  });
});
