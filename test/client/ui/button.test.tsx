import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../../../src/ui';

describe('Button', () => {
  it.each([
    'primary',
    'secondary',
    'tertiary',
    'inverse',
    'destructive',
  ] as const)('exposes the %s visual variant', variant => {
    render(<Button variant={variant}>{variant}</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-variant', variant);
  });

  it.each([
    'default',
    'compact',
    'xs',
    'sm',
    'lg',
    'icon',
    'icon-xs',
    'icon-sm',
    'icon-lg',
  ] as const)('exposes the %s size', size => {
    render(<Button size={size}>{size}</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('data-size', size);
  });

  it('defaults to a non-submitting primary button and composes custom classes', () => {
    render(<Button className="custom-button">Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-variant',
      'primary',
    );
    expect(screen.getByRole('button')).toHaveClass(
      'tap-button',
      'custom-button',
    );
  });

  it.each([
    ['disabled', { disabled: true }],
    ['loading', { loading: true }],
  ] as const)('suppresses clicks while %s', (_state, props) => {
    const onClick = vi.fn();
    render(
      <Button {...props} onClick={onClick}>
        Save
      </Button>,
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('announces loading state without replacing the accessible name', () => {
    render(<Button loading>Save changes</Button>);
    const button = screen.getByRole('button', { name: 'Save changes' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('data-loading', 'true');
  });
});
