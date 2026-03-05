import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapEmptyState } from '../../../src/frontend/components/TapEmptyState';

describe('TapEmptyState', () => {
  it('renders title', () => {
    render(<TapEmptyState title="No items" />);
    expect(screen.getByText('No items')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <TapEmptyState title="No items" description="Try adding some items" />,
    );
    expect(screen.getByText('Try adding some items')).toBeInTheDocument();
  });

  it('renders action when provided', () => {
    render(
      <TapEmptyState
        title="No items"
        action={<button data-testid="action-btn">Add item</button>}
      />,
    );
    expect(screen.getByTestId('action-btn')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    render(
      <TapEmptyState
        title="No items"
        icon={<span data-testid="icon">📦</span>}
      />,
    );
    expect(screen.getByTestId('icon')).toBeInTheDocument();
  });

  it('does not render description or action when not provided', () => {
    const { container } = render(<TapEmptyState title="Empty" />);
    expect(container.querySelectorAll('.mt-1').length).toBe(0);
    expect(container.querySelectorAll('.mt-4').length).toBe(0);
  });
});
