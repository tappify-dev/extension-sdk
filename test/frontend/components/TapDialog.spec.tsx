import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TapDialog } from '../../../src/frontend/components/TapDialog';

describe('TapDialog', () => {
  it('renders title', () => {
    render(
      <TapDialog open={true} onClose={vi.fn()} title="Test Dialog">
        <p>Body</p>
      </TapDialog>,
    );
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <TapDialog
        open={true}
        onClose={vi.fn()}
        title="Title"
        description="A description"
      >
        <p>Body</p>
      </TapDialog>,
    );
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('renders children', () => {
    render(
      <TapDialog open={true} onClose={vi.fn()} title="Title">
        <p data-testid="body">Dialog body</p>
      </TapDialog>,
    );
    expect(screen.getByTestId('body')).toHaveTextContent('Dialog body');
  });

  it('does not render description when not provided', () => {
    const { container } = render(
      <TapDialog open={true} onClose={vi.fn()} title="Title">
        <p>Body</p>
      </TapDialog>,
    );
    const paragraphs = container.querySelectorAll('p.mt-1');
    expect(paragraphs.length).toBe(0);
  });

  it('applies custom className', () => {
    const { container } = render(
      <TapDialog
        open={true}
        onClose={vi.fn()}
        title="Title"
        className="my-class"
      >
        <p>Body</p>
      </TapDialog>,
    );
    const dialog = container.querySelector('dialog');
    expect(dialog?.className).toContain('my-class');
  });
});
