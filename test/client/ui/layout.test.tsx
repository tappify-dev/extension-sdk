import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Inline, Stack } from '../../../src/ui';

describe('One UI layout primitives', () => {
  it('renders a vertical stack with a tokenized gap', () => {
    render(
      <Stack gap={24} className="custom-stack">
        <span>First</span>
        <span>Second</span>
      </Stack>,
    );

    const stack = screen.getByText('First').parentElement;
    expect(stack).toHaveAttribute('data-slot', 'stack');
    expect(stack).toHaveAttribute('data-gap', '24');
    expect(stack).toHaveClass('tap-stack', 'custom-stack');
  });

  it('renders an inline layout with alignment and distribution controls', () => {
    render(
      <Inline
        gap={8}
        align="center"
        justify="between"
        className="custom-inline"
      >
        <span>Left</span>
        <span>Right</span>
      </Inline>,
    );

    const inline = screen.getByText('Left').parentElement;
    expect(inline).toHaveAttribute('data-slot', 'inline');
    expect(inline).toHaveAttribute('data-gap', '8');
    expect(inline).toHaveAttribute('data-align', 'center');
    expect(inline).toHaveAttribute('data-justify', 'between');
    expect(inline).toHaveClass('tap-inline', 'custom-inline');
  });
});
