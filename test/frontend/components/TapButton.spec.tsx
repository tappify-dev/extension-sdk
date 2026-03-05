import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TapButton } from '../../../src/frontend/components/TapButton';

describe('TapButton', () => {
  it('renders button text', () => {
    render(<TapButton>Click me</TapButton>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });

  it('applies primary variant classes by default', () => {
    render(<TapButton>Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-blue-600');
  });

  it('applies secondary variant classes', () => {
    render(<TapButton variant="secondary">Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-white');
  });

  it('applies destructive variant classes', () => {
    render(<TapButton variant="destructive">Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('bg-red-600');
  });

  it('applies ghost variant classes', () => {
    render(<TapButton variant="ghost">Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('text-neutral-700');
  });

  it('handles onClick', () => {
    const onClick = vi.fn();
    render(<TapButton onClick={onClick}>Test</TapButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('supports disabled state', () => {
    render(<TapButton disabled>Test</TapButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies size classes', () => {
    render(<TapButton size="lg">Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('px-6');
  });

  it('merges custom className', () => {
    render(<TapButton className="custom-class">Test</TapButton>);
    const button = screen.getByRole('button');
    expect(button.className).toContain('custom-class');
  });
});
