import { act, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it } from 'vitest';
import { useTap } from '../../src/client/context';
import { TapError } from '../../src/client/errors';
import {
  useTapFilters,
  useTapParams,
  useTapProject,
  useTapSize,
  useTapState,
  useTapTheme,
} from '../../src/client/hooks';
import type { TapFilters } from '../../src/client/types';
import { TapHostProvider } from '../../src/host/provider';
import { createStubTap } from '../support/tap';

function Probe(): ReactElement {
  const filters = useTapFilters();
  const project = useTapProject();
  const theme = useTapTheme();
  const size = useTapSize();
  const params = useTapParams();
  const [count, setCount] = useTapState<number>('count');

  return (
    <div>
      <span data-testid="preset">{filters.range.preset}</span>
      <span data-testid="project">{project.name}</span>
      <span data-testid="theme">{theme.mode}</span>
      <span data-testid="size">{size}</span>
      <span data-testid="pageId">{params.pageId ?? '-'}</span>
      <span data-testid="count">{count ?? 0}</span>
      <button type="button" onClick={() => setCount((count ?? 0) + 1)}>
        add
      </button>
    </div>
  );
}

describe('reactive hooks', () => {
  it('re-renders when the host replaces a slice and emits its key', () => {
    const harness = createStubTap();

    render(
      <TapHostProvider tap={harness.tap}>
        <Probe />
      </TapHostProvider>,
    );

    expect(screen.getByTestId('preset')).toHaveTextContent('30d');

    act(() => {
      const next: TapFilters = {
        range: { from: '2026-09-01', to: '2026-09-08', preset: '7d' },
        platform: 'ios',
        country: 'US',
      };
      harness.tap.filters = next;
      harness.emit('filters');
    });

    expect(screen.getByTestId('preset')).toHaveTextContent('7d');
  });

  it('reads params and size from the mount', () => {
    const harness = createStubTap({ params: { pageId: 'explore' } });

    render(
      <TapHostProvider tap={harness.tap}>
        <Probe />
      </TapHostProvider>,
    );

    expect(screen.getByTestId('pageId')).toHaveTextContent('explore');
    expect(screen.getByTestId('size')).toHaveTextContent('slot');
  });

  it('shares state between mounts of the same install', () => {
    const harness = createStubTap();

    render(
      <TapHostProvider tap={harness.tap}>
        <Probe />
        <Probe />
      </TapHostProvider>,
    );

    act(() => {
      screen.getAllByRole('button')[0].click();
    });

    const counters = screen.getAllByTestId('count');
    expect(counters[0]).toHaveTextContent('1');
    expect(counters[1]).toHaveTextContent('1');
  });
});

describe('useTap outside a mount', () => {
  it('throws TAP_OUTSIDE_HOST with a fix', () => {
    function Bare(): ReactElement {
      useTap();
      return <span>never</span>;
    }

    let thrown: unknown;
    try {
      render(<Bare />);
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_OUTSIDE_HOST');
    expect(thrown.message).toContain('tappify.extension.json');
  });
});
