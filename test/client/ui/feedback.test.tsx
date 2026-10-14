import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, Metric, Skeleton } from '../../../src/ui';

describe('data and feedback primitives', () => {
  it.each([
    [0.124, '+12%'],
    [-0.084, '-8%'],
    [0, '0%'],
  ] as const)('formats metric ratio %s as %s', (delta, expected) => {
    render(
      <Metric
        label="Revenue"
        value="$4,820"
        delta={delta}
        description="This month"
      />,
    );
    expect(screen.getByText('Revenue')).toBeVisible();
    expect(screen.getByText('$4,820')).toBeVisible();
    expect(screen.getByText(expected)).toHaveAttribute(
      'data-direction',
      delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    );
    expect(screen.getByText('This month')).toBeVisible();
  });

  it('renders the requested skeleton lines and explicit width', () => {
    const { container } = render(
      <Skeleton lines={3} width="60%" className="custom-skeleton" />,
    );
    expect(
      container.querySelectorAll('[data-slot="skeleton-line"]'),
    ).toHaveLength(3);
    expect(container.firstChild).toHaveClass('tap-skeleton', 'custom-skeleton');
    expect(container.querySelector('[data-slot="skeleton-line"]')).toHaveStyle({
      width: '60%',
    });
  });

  it('renders empty actions and actionable alert errors', async () => {
    const action = <button type="button">Create</button>;
    const onRetry = vi.fn();
    render(
      <>
        <EmptyState
          title="Nothing here"
          description="Start by adding one."
          action={action}
        />
        <ErrorState
          title="Could not load"
          description="Try again."
          code="E_LOAD"
          onRetry={onRetry}
        />
      </>,
    );
    expect(screen.getByRole('button', { name: 'Create' })).toBeVisible();
    expect(screen.getByRole('alert')).toHaveTextContent('E_LOAD');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('stops skeleton motion for reduced-motion users', () => {
    const css = readFileSync(
      resolve(__dirname, '../../../src/client/ui/styles.css'),
      'utf8',
    );
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('.tap-skeleton__line');
  });
});
