import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapPageHeader } from '../../../src/frontend/components/TapPageHeader';

describe('TapPageHeader', () => {
  it('renders title', () => {
    render(<TapPageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders description when provided', () => {
    render(
      <TapPageHeader
        title="Dashboard"
        description="Welcome to your dashboard"
      />,
    );
    expect(screen.getByText('Welcome to your dashboard')).toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <TapPageHeader
        title="Dashboard"
        actions={<button data-testid="action">New</button>}
      />,
    );
    expect(screen.getByTestId('action')).toBeInTheDocument();
  });

  it('does not render description or actions when not provided', () => {
    const { container } = render(<TapPageHeader title="Title" />);
    const description = container.querySelector('p');
    expect(description).toBeNull();
  });
});
