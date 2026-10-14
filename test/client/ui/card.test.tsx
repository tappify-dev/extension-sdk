import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../src/ui';

describe('Card', () => {
  it('exposes every compound slot and native attributes', () => {
    render(
      <Card data-testid="card" className="custom-card" size="sm">
        <CardHeader data-testid="header">
          <CardTitle>Revenue</CardTitle>
          <CardDescription>Last 30 days</CardDescription>
          <CardAction data-testid="action">Open</CardAction>
        </CardHeader>
        <CardContent data-testid="content">$12,304</CardContent>
        <CardFooter data-testid="footer">Updated now</CardFooter>
      </Card>,
    );

    expect(screen.getByTestId('card')).toHaveAttribute('data-slot', 'card');
    expect(screen.getByTestId('card')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('card')).toHaveClass(
      'tap-ui-card',
      'custom-card',
    );
    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-slot',
      'card-header',
    );
    expect(screen.getByText('Revenue')).toHaveAttribute(
      'data-slot',
      'card-title',
    );
    expect(screen.getByText('Last 30 days')).toHaveAttribute(
      'data-slot',
      'card-description',
    );
    expect(screen.getByTestId('action')).toHaveAttribute(
      'data-slot',
      'card-action',
    );
    expect(screen.getByTestId('content')).toHaveAttribute(
      'data-slot',
      'card-content',
    );
    expect(screen.getByTestId('footer')).toHaveAttribute(
      'data-slot',
      'card-footer',
    );
  });

  it('ships the connected Home extension surface defaults', () => {
    const css = readFileSync(
      resolve(__dirname, '../../../src/client/ui/styles.css'),
      'utf8',
    );
    expect(css).toContain('background: var(--tappify-bg-paper)');
    expect(css).toContain('border-radius: var(--tappify-radius-card)');
    expect(css).toContain('padding: var(--tappify-space-24)');
    expect(css).toContain('gap: var(--tappify-space-16)');
  });
});
