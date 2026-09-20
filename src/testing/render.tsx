import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  render,
  type RenderOptions,
  type RenderResult,
} from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { installPrefix, procedurePrefix } from '../client/query';
import type { Tap } from '../client/types';
import { TapHostProvider } from '../host/provider';
import { createTapMock, type CreateTapMockOptions, type TapMock } from './mock';

/**
 * What `renderWithTap` takes: its own three options, plus every
 * `CreateTapMockOptions` member it forwards to the mock.
 */
export interface RenderWithTapOptions extends CreateTapMockOptions {
  /** A mock you built yourself. Given, every mock option here is ignored. */
  mock?: TapMock;
  /** Your own client, for a test that reads the cache. Defaults to a fresh one. */
  queryClient?: QueryClient;
  /** Passed to Testing Library's `render`, for a mount point of your own. */
  container?: RenderOptions['container'];
}

/** What `renderWithTap` returns: Testing Library's result plus the bridge. */
export interface RenderWithTapResult extends RenderResult {
  /** The same object `useTap` returns inside the component. */
  tap: Tap;
  /** The mock behind the bridge, which the matchers take. */
  mock: TapMock;
  /** The client the render used, whether it was passed in or built here. */
  queryClient: QueryClient;
}

/**
 * Renders a component against the mock bridge, so a widget, tab, page, row action
 * or settings panel is testable outside Tappify.
 *
 * @remarks
 * It builds a mock from the same options `createTapMock` takes unless you pass
 * `mock`, wraps the component in the host provider and a `QueryClient` that does
 * not retry and does not cache between tests, and appends the mock's portal to the
 * rendered document so `TapDialog` has somewhere to go. It rewires
 * `tap.invalidate` onto that client, so a component calling it drops the right
 * cache entries. Scopes default to all of them, so pass `scopes` to cover the
 * refused path; a `handler` has to be built with `jwks: await testJwks()` and the
 * same `extensionId` the mock reports. Load
 * `@tappify/extension-sdk/testing/vitest` or `.../testing/jest` as a setup file
 * first: that installs the host CSS variables, registers the matchers and clears
 * the portal between tests.
 *
 * @example
 * ```tsx
 * import { TapStat, useTapQuery } from '@tappify/extension-sdk';
 * import { renderWithTap } from '@tappify/extension-sdk/testing';
 * import { screen, waitFor } from '@testing-library/react';
 * import { expect, it } from 'vitest';
 *
 * function Crashes() {
 *   const crashes = useTapQuery({
 *     kind: 'crashes',
 *     range: { from: '2026-09-01', to: '2026-09-08' },
 *   });
 *   return <TapStat label="Issues" value={crashes.data?.issues.length ?? 0} />;
 * }
 *
 * it('renders the issues the fixtures answer with', async () => {
 *   renderWithTap(<Crashes />, { scopes: ['ui:render', 'crashes:read'] });
 *   await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
 * });
 * ```
 */
export function renderWithTap(
  ui: ReactElement,
  options: RenderWithTapOptions = {},
): RenderWithTapResult {
  const mock = options.mock ?? createTapMock(options);
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });

  const installId = mock.tap.extension.installId;
  mock.tap.invalidate = name => {
    void queryClient.invalidateQueries({
      queryKey:
        name === undefined
          ? installPrefix(installId)
          : procedurePrefix(installId, name),
    });
  };

  function Wrapper({ children }: { children: ReactNode }): ReactElement {
    return (
      <QueryClientProvider client={queryClient}>
        <TapHostProvider tap={mock.tap}>{children}</TapHostProvider>
      </QueryClientProvider>
    );
  }

  const result = render(ui, { wrapper: Wrapper, container: options.container });
  result.baseElement.append(mock.portal);

  return { ...result, tap: mock.tap, mock, queryClient };
}
