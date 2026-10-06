import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { TapContext } from '../client/context';
import type { Tap } from '../client/types';

export interface TapHostProviderProps {
  tap: Tap;
  children: ReactNode;
  /**
   * A host that already renders a QueryClientProvider leaves this out; a
   * standalone host such as the local preview passes one from
   * `createHostQueryClient()` so the data hooks find a client.
   */
  queryClient?: QueryClient;
}

export function TapHostProvider({
  tap,
  children,
  queryClient,
}: TapHostProviderProps): ReactElement {
  const provided = (
    <TapContext.Provider value={tap}>{children}</TapContext.Provider>
  );

  return queryClient === undefined ? (
    provided
  ) : (
    <QueryClientProvider client={queryClient}>{provided}</QueryClientProvider>
  );
}

/** The query client a standalone host hands to `TapHostProvider`; reads never retry. */
export function createHostQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}
