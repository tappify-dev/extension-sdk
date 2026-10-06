import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TapError, TapServerError } from '../../src/client/errors';
import {
  dataQueryKey,
  installPrefix,
  procedurePrefix,
  procedureQueryKey,
  storageQueryKey,
  useTapQuery,
  useTapServer,
  useTapStorage,
} from '../../src/client/query';
import type {
  HostEventName,
  Tap,
  TapFilters,
  TapKeywordsResult,
} from '../../src/client/types';
import { TapHostProvider } from '../../src/host/provider';
import { createTapMock } from '../../src/testing/mock';
import { createStubTap, stubSingleton } from '../support/tap';

const filters: TapFilters = {
  range: { from: '2026-08-01', to: '2026-09-01', preset: '30d' },
  platform: 'all',
  country: 'all',
};

function wrapper(tap: Tap): (props: { children: ReactNode }) => ReactElement {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={client}>
      <TapHostProvider tap={tap}>{children}</TapHostProvider>
    </QueryClientProvider>
  );
}

function retryingWrapper(
  tap: Tap,
): (props: { children: ReactNode }) => ReactElement {
  const client = new QueryClient();
  return ({ children }) => (
    <QueryClientProvider client={client}>
      <TapHostProvider tap={tap}>{children}</TapHostProvider>
    </QueryClientProvider>
  );
}

describe('query keys', () => {
  it('namespaces every cache entry by install and by the host filters', () => {
    expect(dataQueryKey('ins_1', { kind: 'keywords' }, filters)).toEqual([
      'ext',
      'ins_1',
      'data',
      { kind: 'keywords' },
      filters,
    ]);
    expect(
      procedureQueryKey('ins_1', 'getSummary', { days: 7 }, filters),
    ).toEqual(['ext', 'ins_1', 'proc', 'getSummary', { days: 7 }, filters]);
    expect(storageQueryKey('ins_1', 'preferences')).toEqual([
      'ext',
      'ins_1',
      'storage',
      'preferences',
    ]);
    expect(procedurePrefix('ins_1', 'getSummary')).toEqual([
      'ext',
      'ins_1',
      'proc',
      'getSummary',
    ]);
    expect(installPrefix('ins_1')).toEqual(['ext', 'ins_1']);
  });
});

describe('useTapQuery', () => {
  it('resolves through tap.data.query', async () => {
    const result: TapKeywordsResult = {
      keywords: [
        {
          id: 'kw_1',
          term: 'photo editor',
          platform: 'ios',
          country: 'US',
          position: 4,
          popularity: 62,
        },
      ],
    };
    const query = vi.fn().mockResolvedValue(result);
    const tap = createStubTap({
      data: { query, subscribe: vi.fn(() => () => undefined) },
    }).tap;

    function Probe(): ReactElement {
      const { data, isLoading } = useTapQuery({ kind: 'keywords' });
      if (isLoading) return <span>loading</span>;
      return <span data-testid="term">{data?.keywords[0].term}</span>;
    }

    render(<Probe />, { wrapper: wrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('term')).toHaveTextContent('photo editor'),
    );
    expect(query).toHaveBeenCalledWith({ kind: 'keywords' });
  });

  it('subscribes to the events named in invalidateOn', () => {
    const subscribe = vi.fn(
      (
        _event: HostEventName,
        _handler: (payload: Record<string, unknown>) => void,
      ) =>
        (): void =>
          undefined,
    );
    const tap = createStubTap({
      data: { query: vi.fn().mockResolvedValue({ keywords: [] }), subscribe },
    }).tap;

    function Probe(): ReactElement {
      useTapQuery(
        { kind: 'keywords' },
        { invalidateOn: ['release.shipped', 'settings.changed'] },
      );
      return <span>ok</span>;
    }

    render(<Probe />, { wrapper: wrapper(tap) });

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(subscribe.mock.calls.map(call => call[0])).toEqual([
      'release.shipped',
      'settings.changed',
    ]);
  });

  it('serves two mounts of the same key from one fetch', async () => {
    const query = vi.fn().mockResolvedValue({ keywords: [] });
    const tap = createStubTap({
      data: { query, subscribe: vi.fn(() => () => undefined) },
    }).tap;

    function Probe(): ReactElement {
      const { isLoading } = useTapQuery({ kind: 'keywords' });
      return <span data-testid="state">{isLoading ? 'loading' : 'ready'}</span>;
    }

    render(
      <>
        <Probe />
        <Probe />
      </>,
      { wrapper: wrapper(tap) },
    );

    await waitFor(() =>
      expect(screen.getAllByTestId('state')[1]).toHaveTextContent('ready'),
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('refetches when the host replaces the filters', async () => {
    const query = vi.fn().mockResolvedValue({ keywords: [] });
    const harness = createStubTap({
      data: { query, subscribe: vi.fn(() => () => undefined) },
    });

    function Probe(): ReactElement {
      const { isLoading } = useTapQuery({ kind: 'keywords' });
      return <span data-testid="state">{isLoading ? 'loading' : 'ready'}</span>;
    }

    render(<Probe />, { wrapper: wrapper(harness.tap) });

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('ready'),
    );
    expect(query).toHaveBeenCalledTimes(1);

    act(() => {
      harness.tap.filters = {
        range: { from: '2026-09-01', to: '2026-09-08', preset: '7d' },
        platform: 'ios',
        country: 'US',
      };
      harness.emit('filters');
    });

    await waitFor(() => expect(query).toHaveBeenCalledTimes(2));
  });

  it('surfaces a rejected read after one call to the bridge', async () => {
    const query = vi
      .fn()
      .mockRejectedValue(
        new TapError('TAP_SCOPE_MISSING', 'This install has not granted x.'),
      );
    const tap = createStubTap({
      data: { query, subscribe: vi.fn(() => () => undefined) },
    }).tap;

    function Probe(): ReactElement {
      const { error } = useTapQuery({ kind: 'keywords' });
      return (
        <span data-testid="error">
          {error === null ? 'none' : error.message}
        </span>
      );
    }

    render(<Probe />, { wrapper: retryingWrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent(
        'has not granted x.',
      ),
    );
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('throws TAP_NO_QUERY_CLIENT without the host query client', () => {
    const tap = createStubTap().tap;

    function Bare(): ReactElement {
      useTapQuery({ kind: 'keywords' });
      return <span>never</span>;
    }

    let thrown: unknown;
    try {
      render(
        <TapHostProvider tap={tap}>
          <Bare />
        </TapHostProvider>,
      );
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_NO_QUERY_CLIENT');
    expect(thrown.message).toContain('renderWithTap()');
  });
});

describe('useTapServer', () => {
  it('calls the declared procedure through the bridge', async () => {
    const getSummary = vi.fn().mockResolvedValue({ installs: 42 });
    const tap = createStubTap({ server: { getSummary } }).tap;

    function Probe(): ReactElement {
      const { data } = useTapServer('getSummary', { days: 7 });
      const value = data;
      return (
        <span data-testid="installs">
          {typeof value === 'object' && value !== null && 'installs' in value
            ? String(value.installs)
            : '-'}
        </span>
      );
    }

    render(<Probe />, { wrapper: wrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('installs')).toHaveTextContent('42'),
    );
    expect(getSummary).toHaveBeenCalledWith({ days: 7 });
  });

  it('surfaces the vendor server error instance through error', async () => {
    const failure = new TapServerError(
      'rate_limited',
      'Too many requests',
      429,
    );
    const getSummary = vi.fn().mockRejectedValue(failure);
    const tap = createStubTap({ server: { getSummary } }).tap;

    function Probe(): ReactElement {
      const { error } = useTapServer('getSummary', { days: 7 });
      return (
        <span data-testid="error">{error === failure ? 'same' : 'other'}</span>
      );
    }

    render(<Probe />, { wrapper: wrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('error')).toHaveTextContent('same'),
    );
  });

  it('calls a failing procedure once instead of retrying the relay', async () => {
    const getSummary = vi
      .fn()
      .mockRejectedValue(
        new TapServerError(
          'SUMMARY_UNAVAILABLE',
          'Connect a store first.',
          503,
        ),
      );
    const tap = createStubTap({ server: { getSummary } }).tap;

    function Probe(): ReactElement {
      const { error } = useTapServer('getSummary', { days: 7 });
      return (
        <span data-testid="state">{error === null ? 'waiting' : 'failed'}</span>
      );
    }

    render(<Probe />, { wrapper: retryingWrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('failed'),
    );
    expect(getSummary).toHaveBeenCalledTimes(1);
  });

  it('throws TAP_UNKNOWN_PROCEDURE for a procedure the manifest never declared', () => {
    const tap = createStubTap().tap;

    function Probe(): ReactElement {
      useTapServer('getSummary', { days: 7 });
      return <span>never</span>;
    }

    let thrown: unknown;
    try {
      render(<Probe />, { wrapper: wrapper(tap) });
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_UNKNOWN_PROCEDURE');
    expect(thrown.message).toContain('server.procedures');
    expect(thrown.message).toContain('tappify extension types');
  });
});

describe('useTapStorage', () => {
  it('reads a singleton and writes through save and patch, refetching once per write', async () => {
    const mock = createTapMock();
    const preferences = mock.tap.storage.preferences;
    if (!('patch' in preferences)) {
      throw new Error('expected a singleton handle');
    }

    const get = vi.spyOn(preferences, 'get');
    const patch = vi.spyOn(preferences, 'patch');
    const set = vi.spyOn(preferences, 'set');

    function Probe(): ReactElement {
      const stored = useTapStorage('preferences');
      return (
        <button
          type="button"
          data-testid="value"
          onClick={() => void stored.patch({ compact: true })}
        >
          {typeof stored.data === 'object' && stored.data !== null
            ? 'loaded'
            : 'empty'}
        </button>
      );
    }

    render(<Probe />, { wrapper: wrapper(mock.tap) });

    await waitFor(() => expect(get).toHaveBeenCalledTimes(1));

    screen.getByTestId('value').click();
    await waitFor(() =>
      expect(screen.getByTestId('value')).toHaveTextContent('loaded'),
    );
    await act(() => new Promise(resolve => setTimeout(resolve, 25)));

    expect(patch).toHaveBeenCalledWith({ compact: true });
    expect(set).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('reads a rejected collection once instead of retrying', async () => {
    const preferences = stubSingleton<{ compact: boolean }>(null);
    const get = vi
      .spyOn(preferences, 'get')
      .mockRejectedValue(
        new TapError('TAP_SCOPE_MISSING', 'This install has not granted x.'),
      );
    const tap = createStubTap({ storage: { preferences } }).tap;

    function Probe(): ReactElement {
      const { error } = useTapStorage('preferences');
      return (
        <span data-testid="state">{error === null ? 'waiting' : 'failed'}</span>
      );
    }

    render(<Probe />, { wrapper: retryingWrapper(tap) });

    await waitFor(() =>
      expect(screen.getByTestId('state')).toHaveTextContent('failed'),
    );
    expect(get).toHaveBeenCalledTimes(1);
  });
});
