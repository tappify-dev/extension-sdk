import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapCard } from '../../../src/frontend/components/TapCard';

describe('TapCard', () => {
  it('renders children', () => {
    render(
      <TapCard>
        <span data-testid="content">Card content</span>
      </TapCard>,
    );
    expect(screen.getByTestId('content')).toHaveTextContent('Card content');
  });

  it('applies custom className', () => {
    const { container } = render(
      <TapCard className="extra-class">Content</TapCard>,
    );
    expect(container.firstChild).toHaveClass('extra-class');
  });

  it('has default styling classes', () => {
    const { container } = render(<TapCard>Content</TapCard>);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('rounded-lg');
    expect(el.className).toContain('border');
    expect(el.className).toContain('bg-white');
  });
});
