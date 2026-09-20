import {
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { useTap } from './context';
import { TapError } from './errors';
import { useTapFilters } from './hooks';
import type {
  Tap,
  TapFilters,
  TapHostEvents,
  TapProcedureInput,
  TapProcedureName,
  TapProcedureOutput,
  TapQuery,
  TapResult,
  TapSingleton,
  TapSingletonDocument,
  TapSingletonName,
} from './types';

const STALE_TIME_MS = 30_000;

/** The third argument of `useTapQuery` and `useTapServer`. */
export interface TapQueryOptions {
  /** Holds the call back while this is `false`. Defaults to `true`. */
  enabled?: boolean;
  /** Tappify events that mark this result stale and refetch it when they arrive. */
  invalidateOn?: (keyof TapHostEvents)[];
}

/** What `useTapQuery` and `useTapServer` return. */
export interface TapQueryResult<T> {
  /**
   * `undefined` until the first answer for this key arrives. A later call that
   * fails leaves the last answer in place and only sets `error`, so branch on
   * `error` to detect a failure, never on `data`.
   */
  data: T | undefined;
  error: Error | null;
  /** `true` only while the first answer for this key is in flight. */
  isLoading: boolean;
  /** Asks again now, whether or not the cached answer has gone stale. */
  refetch(): void;
}

/** What `useTapStorage` returns: a read of the document, plus the two writes. */
export interface TapStorageResult<T> extends TapQueryResult<T | null> {
  /** Replaces the whole document. */
  save(document: T): Promise<void>;
  /** Merges the fields in and resolves to the merged document. */
  patch(partial: Partial<T>): Promise<T>;
}

/**
 * Builds the cache key `useTapQuery` reads a Tappify data query under.
 *
 * @remarks
 * The key carries the install, the query and the filters behind it, so two mounts
 * asking for the same numbers share one request. Call it only to reach the query
 * cache directly; the hooks build their own keys.
 *
 * @example
 * ```ts
 * import { dataQueryKey } from '@tappify/extension-sdk';
 *
 * const key = dataQueryKey('ins_test', { kind: 'keywords' }, {
 *   range: { from: '2026-09-01', to: '2026-09-08' },
 *   platform: 'all',
 *   country: 'all',
 * });
 * ```
 */
export function dataQueryKey(
  installId: string,
  query: TapQuery,
  filters: TapFilters,
): unknown[] {
  return ['ext', installId, 'data', query, filters];
}

/**
 * Builds the cache key `useTapServer` reads one procedure call under.
 *
 * @remarks
 * The input and the filters are part of the key, so the same procedure called
 * with different input caches separately. Call it only to reach the query cache
 * directly.
 *
 * @example
 * ```ts
 * import { procedureQueryKey } from '@tappify/extension-sdk';
 *
 * const key = procedureQueryKey('ins_test', 'getSummary', { days: 7 }, {
 *   range: { from: '2026-09-01', to: '2026-09-08' },
 *   platform: 'all',
 *   country: 'all',
 * });
 * ```
 */
export function procedureQueryKey(
  installId: string,
  name: string,
  input: unknown,
  filters: TapFilters,
): unknown[] {
  return ['ext', installId, 'proc', name, input, filters];
}

/**
 * Builds the cache key `useTapStorage` reads one collection's document under.
 *
 * @remarks
 * The filters are not part of the key, because a stored document does not depend
 * on them. Call it only to reach the query cache directly.
 *
 * @example
 * ```ts
 * import { storageQueryKey } from '@tappify/extension-sdk';
 *
 * const key = storageQueryKey('ins_test', 'preferences');
 * ```
 */
export function storageQueryKey(
  installId: string,
  collection: string,
): unknown[] {
  return ['ext', installId, 'storage', collection];
}

/**
 * Builds the key prefix every cached answer of one install sits under.
 *
 * @remarks
 * This is the prefix `tap.invalidate()` with no name invalidates.
 *
 * @example
 * ```ts
 * import { installPrefix } from '@tappify/extension-sdk';
 *
 * const prefix = installPrefix('ins_test');
 * ```
 */
export function installPrefix(installId: string): unknown[] {
  return ['ext', installId];
}

/**
 * Builds the key prefix every cached call of one procedure sits under, whatever
 * its input.
 *
 * @remarks
 * This is the prefix `tap.invalidate(name)` invalidates.
 *
 * @example
 * ```ts
 * import { procedurePrefix } from '@tappify/extension-sdk';
 *
 * const prefix = procedurePrefix('ins_test', 'getSummary');
 * ```
 */
export function procedurePrefix(installId: string, name: string): unknown[] {
  return ['ext', installId, 'proc', name];
}

function useInvalidateOn(
  tap: Tap,
  client: QueryClient,
  queryKey: unknown[],
  events: (keyof TapHostEvents)[] | undefined,
): void {
  const eventsRef = useRef(events);
  const keyRef = useRef(queryKey);

  useEffect(() => {
    eventsRef.current = events;
    keyRef.current = queryKey;
  });

  const eventSignature = (events ?? []).join(',');

  useEffect(() => {
    const names = eventsRef.current ?? [];
    if (names.length === 0) return;

    const unsubscribes = names.map(name =>
      tap.data.subscribe(name, () => {
        void client.invalidateQueries({ queryKey: keyRef.current });
      }),
    );

    return () => {
      for (const unsubscribe of unsubscribes) unsubscribe();
    };
  }, [tap, client, eventSignature]);
}

function useHostQueryClient(): QueryClient {
  try {
    return useQueryClient();
  } catch {
    throw new TapError(
      'TAP_NO_QUERY_CLIENT',
      'The Tappify host provides the query client. This hook runs only inside a Tappify mount — render the component from an entry declared in tappify.extension.json, or wrap it in renderWithTap() from @tappify/extension-sdk/testing.',
    );
  }
}

/**
 * Reads one query's worth of the owner's Tappify data, cached per install, query
 * and filter bar.
 *
 * @remarks
 * Each kind needs its own scope — `project` needs `projects:read`, `series` needs
 * `analytics:read`, `keywords` and `listing` need `store.metadata:read`, and
 * `reviews`, `crashes` and `revenue` need their own. A kind the install has not
 * granted comes back as a `TapError` with code `TAP_SCOPE_MISSING` in `error`. An
 * answer stays fresh for 30 seconds and a failed read is not retried, so
 * `refetch` is yours to call. The host adds only the country filter to the read:
 * pass `range` into a `series`, `reviews`, `crashes` or `revenue` query yourself,
 * and `platform` into a `series` query, which is the only kind that takes one.
 * Throws `TAP_NO_QUERY_CLIENT` when no Tappify mount provides the query client.
 *
 * @example
 * ```tsx
 * import { TapStat, useTapFilters, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Downloads() {
 *   const filters = useTapFilters();
 *   const downloads = useTapQuery(
 *     { kind: 'series', metric: 'downloads', range: filters.range },
 *     { invalidateOn: ['release.shipped'] },
 *   );
 *   const points = downloads.data?.points ?? [];
 *   const total = points.reduce((sum, point) => sum + point.value, 0);
 *   return <TapStat label="Downloads" value={total} />;
 * }
 * ```
 *
 * @example
 * ```tsx
 * import { TapTable, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Keywords() {
 *   const keywords = useTapQuery({ kind: 'keywords' });
 *   return (
 *     <TapTable
 *       columns={[
 *         { key: 'term', label: 'Term' },
 *         { key: 'position', label: 'Rank', align: 'end' },
 *       ]}
 *       rows={keywords.data?.keywords ?? []}
 *       rowKey={keyword => keyword.id}
 *     />
 *   );
 * }
 * ```
 */
export function useTapQuery<Q extends TapQuery>(
  query: Q,
  options: TapQueryOptions = {},
): TapQueryResult<TapResult<Q>> {
  const tap = useTap();
  const client = useHostQueryClient();
  const filters = useTapFilters();
  const queryKey = dataQueryKey(tap.extension.installId, query, filters);

  const result = useQuery({
    queryKey,
    queryFn: () => tap.data.query(query),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME_MS,
    retry: false,
  });

  useInvalidateOn(tap, client, queryKey, options.invalidateOn);

  const resultRefetch = result.refetch;
  const refetch = useCallback(() => {
    void resultRefetch();
  }, [resultRefetch]);

  return {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    refetch,
  };
}

/**
 * Calls one procedure on your own server, cached per install, name, input and
 * filter bar.
 *
 * @remarks
 * The name and the input are narrowed by the `TapProcedureMap` augmentation
 * `tappify extension types` writes, so a procedure the manifest does not declare
 * does not compile; at runtime a name the host has no route for throws
 * `TAP_UNKNOWN_PROCEDURE`. The call carries the whole filter bar for you. An
 * answer stays fresh for 30 seconds and a failure is not retried; an error your
 * server threw arrives as a `TapServerError` with your own `code`. Throws
 * `TAP_NO_QUERY_CLIENT` when no Tappify mount provides the query client.
 *
 * @example
 * ```tsx
 * import { TapButton, TapErrorState, useTapFilters, useTapServer } from '@tappify/extension-sdk';
 *
 * function Summary() {
 *   const filters = useTapFilters();
 *   const summary = useTapServer(
 *     'getSummary',
 *     { days: 7, platform: filters.platform },
 *     { invalidateOn: ['settings.changed'] },
 *   );
 *   if (summary.error !== null) {
 *     return <TapErrorState title="The summary did not load" description={summary.error.message} />;
 *   }
 *   return <TapButton loading={summary.isLoading} onClick={summary.refetch}>Refresh</TapButton>;
 * }
 * ```
 */
export function useTapServer<N extends TapProcedureName>(
  name: N,
  input: TapProcedureInput<N>,
  options: TapQueryOptions = {},
): TapQueryResult<TapProcedureOutput<N>> {
  const tap = useTap();
  const client = useHostQueryClient();
  const filters = useTapFilters();
  const queryKey = procedureQueryKey(
    tap.extension.installId,
    name,
    input,
    filters,
  );
  const procedure = tap.server[name];

  if (typeof procedure !== 'function') {
    throw new TapError(
      'TAP_UNKNOWN_PROCEDURE',
      `Procedure "${name}" is not declared. Add it under server.procedures in tappify.extension.json, then run \`tappify extension types\`.`,
    );
  }

  const result = useQuery({
    queryKey,
    queryFn: () => procedure(input),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME_MS,
    retry: false,
  });

  useInvalidateOn(tap, client, queryKey, options.invalidateOn);

  const resultRefetch = result.refetch;
  const refetch = useCallback(() => {
    void resultRefetch();
  }, [resultRefetch]);

  return {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    refetch,
  };
}

function isSingletonHandle<T>(value: unknown): value is TapSingleton<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'get' in value &&
    'set' in value &&
    'patch' in value &&
    typeof value.get === 'function' &&
    typeof value.set === 'function' &&
    typeof value.patch === 'function'
  );
}

function asSingleton<T>(handle: unknown, collection: string): TapSingleton<T> {
  if (isSingletonHandle<T>(handle)) return handle;

  throw new TapError(
    'TAP_UNKNOWN_COLLECTION',
    `useTapStorage("${collection}") reads a singleton collection. Declare it with "singleton": true in tappify.extension.json, or read an id-keyed collection with tap.storage.${collection}.list().`,
  );
}

/**
 * Reads and writes the one document a singleton storage collection holds.
 *
 * @remarks
 * The argument is a collection name from the `TapStorageMap` augmentation
 * `tappify extension types` writes, and the collection has to be declared with
 * `"singleton": true`; an id-keyed collection throws `TAP_UNKNOWN_COLLECTION`,
 * with the `tap.storage.<name>.list()` path in the message. `data` is `undefined`
 * while the first read is in flight and `null` until the document is first
 * written. Every storage call needs the `storage:write` scope, reads included, and
 * rejects with `TAP_SCOPE_MISSING` without it. A write from another mount or
 * another browser tab of the same install refetches this one.
 *
 * @example
 * ```tsx
 * import { TapButton, useTapStorage } from '@tappify/extension-sdk';
 *
 * function CompactToggle() {
 *   const preferences = useTapStorage('preferences');
 *   return (
 *     <TapButton
 *       loading={preferences.isLoading}
 *       onClick={() => void preferences.patch({ compact: true })}
 *     >
 *       Compact
 *     </TapButton>
 *   );
 * }
 * ```
 */
export function useTapStorage<C extends TapSingletonName>(
  collection: C,
): TapStorageResult<TapSingletonDocument<C>> {
  type Document = TapSingletonDocument<C>;

  const tap = useTap();
  const client = useHostQueryClient();
  const queryKey = storageQueryKey(tap.extension.installId, collection);
  const handle = asSingleton<Document>(tap.storage[collection], collection);

  const result = useQuery({
    queryKey,
    queryFn: () => handle.get(),
    staleTime: STALE_TIME_MS,
    retry: false,
  });

  const installId = tap.extension.installId;
  const invalidate = useCallback(() => {
    void client.invalidateQueries({
      queryKey: storageQueryKey(installId, collection),
    });
  }, [client, installId, collection]);

  useEffect(
    () => tap.__subscribe(`storage:${collection}`, invalidate),
    [tap, collection, invalidate],
  );

  const save = useCallback(
    async (document: Document) => {
      await handle.set(document);
    },
    [handle],
  );

  const patch = useCallback(
    async (partial: Partial<Document>) => handle.patch(partial),
    [handle],
  );

  const resultRefetch = result.refetch;
  const refetch = useCallback(() => {
    void resultRefetch();
  }, [resultRefetch]);

  return {
    data: result.data,
    error: result.error,
    isLoading: result.isLoading,
    refetch,
    save,
    patch,
  };
}
