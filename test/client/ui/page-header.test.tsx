import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button, PageHeader } from '../../../src/ui';

describe('PageHeader', () => {
  it('uses an h2 because the host owns the page h1', () => {
    render(<PageHeader title="RevenueCat" />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'RevenueCat' }),
    ).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();
  });

  it('renders optional description and actions in stackable slots', () => {
    render(
      <PageHeader
        title="RevenueCat"
        description="Subscription performance"
        actions={<Button>Refresh</Button>}
        className="custom-header"
      />,
    );

    const header = screen.getByRole('banner');
    expect(header).toHaveAttribute('data-slot', 'page-header');
    expect(header).toHaveClass('tap-page-header', 'custom-header');
    expect(screen.getByText('Subscription performance')).toHaveAttribute(
      'data-slot',
      'page-header-description',
    );
    expect(
      screen.getByRole('button', { name: 'Refresh' }).parentElement,
    ).toHaveAttribute('data-slot', 'page-header-actions');
  });
});
