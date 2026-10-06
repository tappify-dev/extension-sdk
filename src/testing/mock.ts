import { TapError } from '../client/errors';
import type {
  Tap,
  TapChangeKey,
  TapChatCard,
  TapCollection,
  TapConfirmOptions,
  TapFilters,
  TapHostEvents,
  TapProcedures,
  TapSingleton,
  TapSize,
  TapStorage,
  TapToastTone,
} from '../client/types';
import { QUERY_SCOPES, SCOPE_KEYS, type ScopeKey } from '../manifest/constants';
import type { TappifyFetchHandler } from '../server/handler';
import { signTestToken } from './client';
import {
  callEnvelope,
  DEFAULT_FILTERS,
  readEnvelopeResponse,
} from './envelope';
import { answerFixtureQuery } from './fixtures';

/**
 * Everything the component asked the host to do, in call order, for a test to
 * assert on.
 */
export interface TapMockCalls {
  /** One entry per `tap.nav.push`. */
  navigations: string[];
  /** One entry per `tap.nav.setSearch`. */
  searches: Record<string, string | null>[];
  /** One entry per `tap.ui.toast`; the tone defaults to `neutral`. */
  toasts: { message: string; tone: TapToastTone }[];
  /** One entry per `tap.ui.confirm`, whatever the mock answered. */
  confirms: TapConfirmOptions[];
  /** One entry per `tap.actions.run`, which the mock records rather than refuses. */
  actions: { actionId: string; input: unknown }[];
  /** One entry per `tap.telemetry.event`. */
  telemetry: {
    name: string;
    props?: Record<string, string | number | boolean>;
  }[];
  /** One entry per `tap.nav.openChat`. */
  chats: { prompt: string; context?: Record<string, unknown> }[];
  /** One url per `tap.nav.openExternal`, with no confirmation asked. */
  externals: string[];
  /** The filename and byte size per `tap.ui.download`, not the blob itself. */
  downloads: { filename: string; size: number }[];
  /** One entry per `tap.ui.copy`, with no clipboard touched. */
  copies: string[];
  /** One card per `tap.ui.openInChat`, unformatted. */
  cards: TapChatCard[];
  /** How many times `tap.ui.expand` was called. */
  expands: number;
  /** How many times `tap.nav.openSettings` was called. */
  settingsOpens: number;
}

/**
 * How the mock bridge is built, and the options `renderWithTap` forwards to it.
 */
export interface CreateTapMockOptions {
  /** Defaults to `ins_test`. */
  installId?: string;
  /** Defaults to `starter`, and has to match `handler`'s own extension id. */
  extensionId?: string;
  /** Defaults to `Starter`. */
  extensionName?: string;
  /** What the install granted. Defaults to every scope. */
  scopes?: ScopeKey[];
  /** What `tap.ui.size` reports. Defaults to `slot`. */
  size?: TapSize;
  /** Merged over the fixture filter bar. */
  filters?: Partial<TapFilters>;
  /** Merged over the fixture Northlight project. */
  project?: Partial<Tap['project']>;
  /** What `tap.context` holds. Defaults to empty. */
  context?: Record<string, unknown>;
  /** What `tap.params` holds, in the host's positional shape. Defaults to empty. */
  params?: Record<string, string>;
  /** What `useTapTheme` reports. Defaults to `light`. */
  theme?: 'light' | 'dark';
  /** What `tap.ui.confirm` resolves to. Defaults to `true`. */
  confirmAnswer?: boolean;
  /** The collections to expose, and the kind of each. Left out, every name works. */
  storage?: Record<string, 'singleton' | 'collection'>;
  /** One function per procedure, answering `tap.server.<name>` in process. */
  server?: Record<string, (input: unknown) => unknown>;
  /** Your own handler, so `tap.server.<name>` goes through its real routes. */
  handler?: TappifyFetchHandler;
  /** A token to send to `handler`. Defaults to one the mock signs itself. */
  handlerToken?: string;
}

/** The mock bridge, with the recorded calls and the handles that drive it. */
export interface TapMock {
  /** The bridge itself, which `renderWithTap` puts above the component. */
  tap: Tap;
  calls: TapMockCalls;
  /** The node `TapDialog` renders into, appended to the document by `renderWithTap`. */
  portal: HTMLElement;
  /** What a collection holds now, or just the one document under `documentId`. */
  documents(collection: string, documentId?: string): unknown[];
  /** Delivers a Tappify event to everything subscribed through `tap.data.subscribe`. */
  emit<E extends keyof TapHostEvents>(
    event: E,
    payload: TapHostEvents[E],
  ): void;
  /** Replaces the whole filter bar and re-renders the hooks that read it. */
  setFilters(filters: TapFilters): void;
  /** Moves the mount between slot, panel and page. */
  setSize(size: TapSize): void;
  /** Switches the theme `useTapTheme` reports. */
  setTheme(mode: 'light' | 'dark'): void;
  /** Replaces the route `useTapParams` reports, in the host's own positional shape. */
  setParams(params: Record<string, string>): void;
}

interface StoredDocument {
  id: string;
  data: unknown;
}

type StorageHandle = TapSingleton<unknown> & TapCollection<unknown>;

type ExposedHandle = TapSingleton<unknown> | TapCollection<unknown>;

const SINGLETON_ID = 'singleton';

const PROBE_KEYS = new Set([
  'then',
  'toJSON',
  '$$typeof',
  'constructor',
  'prototype',
  'valueOf',
  'toString',
  'inspect',
  'asymmetricMatch',
  'nodeType',
]);

function unknownCollectionError(collection: string): TapError {
  return new TapError(
    'TAP_UNKNOWN_COLLECTION',
    `This mock exposes no storage collection called "${collection}". createTapMock({ storage: … }) was given an explicit map, so only the collections it names exist. Add "${collection}" to that map, or drop the storage option to expose every collection.`,
  );
}

function singletonView(handle: StorageHandle): TapSingleton<unknown> {
  return {
    get: () => handle.get(),
    set: document => handle.set(document),
    patch: partial => handle.patch(partial),
  };
}

function collectionView(handle: StorageHandle): TapCollection<unknown> {
  return {
    list: listOptions => handle.list(listOptions),
    get: id => handle.get(id),
    put: (id, document) => handle.put(id, document),
    delete: id => handle.delete(id),
  };
}

function scopeError(scope: ScopeKey): TapError {
  return new TapError(
    'TAP_SCOPE_MISSING',
    `This install has not granted ${scope}. Declare it under "scopes" in tappify.extension.json, or pass scopes: ["${scope}"] to renderWithTap() to test the granted path.`,
  );
}

function asObject(value: unknown): object {
  return typeof value === 'object' && value !== null ? value : {};
}

/**
 * Builds the bridge a component talks to in a test, without rendering anything.
 *
 * @remarks
 * Data queries answer from the sandbox fixtures, storage is an in-memory store, and
 * everything else the host would do is recorded in `calls`. Scopes default to all of
 * them: pass `scopes` to test the refused path, where a data query rejects with
 * `TAP_SCOPE_MISSING` for the kind's own scope and every storage call, reads
 * included, needs `storage:write`. A procedure needs either `server`, which answers
 * in process, or `handler`, which is called over a real `Request` with a token the
 * mock signs — so that handler has to be built with `jwks: await testJwks()` and the
 * same `extensionId` — and without either, `tap.server.<name>` rejects with
 * `TAP_UNKNOWN_PROCEDURE`. With `storage` given, a collection the map does not name
 * throws `TAP_UNKNOWN_COLLECTION`. Unlike the host, this mock records
 * `tap.actions.run` and resolves it as pending rather than refusing it, so a test
 * can assert on the call today. Use `renderWithTap` when there is a component to
 * render.
 *
 * @example
 * ```ts
 * import { createTapMock } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers a keyword query from the fixtures', async () => {
 *   const mock = createTapMock({ scopes: ['store.metadata:read'] });
 *   const keywords = await mock.tap.data.query({ kind: 'keywords' });
 *   expect(keywords.keywords).toHaveLength(3);
 * });
 * ```
 */
export function createTapMock(options: CreateTapMockOptions = {}): TapMock {
  const granted = new Set<ScopeKey>(options.scopes ?? SCOPE_KEYS);
  const listeners = new Map<TapChangeKey, Set<() => void>>();
  const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
  const state = new Map<string, unknown>();
  const store = new Map<string, StoredDocument[]>();

  const portal = document.createElement('div');
  portal.dataset.tapPortal = 'true';

  const calls: TapMockCalls = {
    navigations: [],
    searches: [],
    toasts: [],
    confirms: [],
    actions: [],
    telemetry: [],
    chats: [],
    externals: [],
    downloads: [],
    copies: [],
    cards: [],
    expands: 0,
    settingsOpens: 0,
  };

  const emitChange = (key: TapChangeKey): void => {
    for (const listener of listeners.get(key) ?? []) listener();
  };

  const subscribe = (key: TapChangeKey, listener: () => void): (() => void) => {
    const set = listeners.get(key) ?? new Set<() => void>();
    set.add(listener);
    listeners.set(key, set);
    return () => {
      set.delete(listener);
    };
  };

  const withStorage = <T>(run: () => T): Promise<T> =>
    granted.has('storage:write')
      ? Promise.resolve(run())
      : Promise.reject(scopeError('storage:write'));

  const bucket = (collection: string): StoredDocument[] => {
    const existing = store.get(collection);
    if (existing) return existing;
    const created: StoredDocument[] = [];
    store.set(collection, created);
    return created;
  };

  function buildHandle(collection: string): StorageHandle {
    const find = (id: string): StoredDocument | undefined =>
      bucket(collection).find(entry => entry.id === id);

    const write = (id: string, data: unknown): void => {
      const items = bucket(collection);
      const index = items.findIndex(entry => entry.id === id);
      if (index === -1) items.push({ id, data });
      else items[index] = { id, data };
      emitChange(`storage:${collection}`);
    };

    return {
      get: (id?: string) =>
        withStorage(() => find(id ?? SINGLETON_ID)?.data ?? null),
      set: document =>
        withStorage(() => {
          write(SINGLETON_ID, document);
        }),
      patch: partial =>
        withStorage(() => {
          const merged = { ...asObject(find(SINGLETON_ID)?.data), ...partial };
          write(SINGLETON_ID, merged);
          return merged;
        }),
      list: () =>
        withStorage(() => ({
          items: bucket(collection)
            .filter(entry => entry.id !== SINGLETON_ID)
            .map(entry => ({ ...asObject(entry.data), id: entry.id })),
        })),
      put: (id, document) =>
        withStorage(() => {
          write(id, document);
        }),
      delete: id =>
        withStorage(() => {
          const items = bucket(collection);
          const index = items.findIndex(entry => entry.id === id);
          if (index !== -1) {
            items.splice(index, 1);
            emitChange(`storage:${collection}`);
          }
        }),
    };
  }

  const handles = new Map<string, ExposedHandle>();
  const kinds = options.storage;

  const exposeHandle = (collection: string): ExposedHandle => {
    const kind = kinds?.[collection];
    if (kinds !== undefined && kind === undefined) {
      throw unknownCollectionError(collection);
    }

    const handle = buildHandle(collection);
    if (kind === 'singleton') return singletonView(handle);
    if (kind === 'collection') return collectionView(handle);
    return handle;
  };

  const handleFor = (collection: string): ExposedHandle | undefined => {
    if (PROBE_KEYS.has(collection)) return undefined;

    const existing = handles.get(collection);
    if (existing) return existing;
    const created = exposeHandle(collection);
    handles.set(collection, created);
    return created;
  };

  const storageTarget: TapStorage = {};
  const storage = new Proxy(storageTarget, {
    get: (_target, property) =>
      typeof property === 'string' ? handleFor(property) : undefined,
    has: () => true,
    ownKeys: () => [...store.keys()],
    getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
  });

  let calledProcedures = 0;
  let signedToken: Promise<string> | null = null;

  function handlerToken(): Promise<string> {
    if (options.handlerToken !== undefined) {
      return Promise.resolve(options.handlerToken);
    }
    signedToken ??= signTestToken(
      {
        installId: tap.extension.installId,
        extensionId: tap.extension.id,
        projectId: tap.extension.projectId,
        organizationId: tap.auth.organizationId,
        scopes: [...granted],
      },
      { extensionId: tap.extension.id },
    );
    return signedToken;
  }

  async function callProcedure(name: string, input: unknown): Promise<unknown> {
    const local = options.server?.[name];
    if (local) return local(input);

    if (options.handler) {
      const path = `/tappify/procedures/${name}`;
      calledProcedures += 1;
      const response = await options.handler(
        new Request(`https://vendor.test${path}`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-tappify-event-id': `evt_${name}_${String(calledProcedures)}`,
            authorization: `Bearer ${await handlerToken()}`,
          },
          body: callEnvelope({
            install: {
              id: tap.extension.installId,
              extensionId: tap.extension.id,
              projectId: tap.extension.projectId,
              organizationId: tap.auth.organizationId,
            },
            filters: tap.filters,
            input,
          }),
        }),
      );

      return readEnvelopeResponse(response, `POST ${path}`);
    }

    throw new TapError(
      'TAP_UNKNOWN_PROCEDURE',
      `No handler is registered for the procedure "${name}". Pass server: { ${name}: input => … } or handler: <your createTappifyHandler handler> to createTapMock().`,
    );
  }

  const serverTarget: TapProcedures = {};

  const tap: Tap = {
    extension: {
      id: options.extensionId ?? 'starter',
      name: options.extensionName ?? 'Starter',
      installId: options.installId ?? 'ins_test',
      projectId: 'prj_north',
    },
    env: 'dev',
    host: { version: 'test', sdkMajors: [2] },
    auth: {
      token: 'test-token',
      user: { id: 'usr_test', role: 'admin' },
      organizationId: 'org_test',
      scopes: [...granted],
      can: scope => granted.has(scope),
    },
    project: {
      id: 'prj_north',
      name: 'Northlight',
      platforms: ['ios', 'android'],
      apps: [],
      releases: [],
      keywords: [],
      ...options.project,
    },
    filters: { ...DEFAULT_FILTERS, ...options.filters },
    theme: { mode: options.theme ?? 'light' },
    locale: 'en-US',
    timezone: 'UTC',
    format: {
      number: (value, formatOptions) =>
        new Intl.NumberFormat('en-US', formatOptions).format(value),
      currency: (value, code) =>
        new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: code,
        }).format(value),
      date: value => new Date(value).toISOString().slice(0, 10),
      relative: value => new Date(value).toISOString(),
    },
    nav: {
      push: path => calls.navigations.push(path),
      setSearch: params => calls.searches.push(params),
      openSettings: () => {
        calls.settingsOpens += 1;
      },
      openChat: (prompt, context) => calls.chats.push({ prompt, context }),
      openExternal: url => calls.externals.push(url),
    },
    data: {
      query: query => {
        const scope = QUERY_SCOPES[query.kind];
        if (!granted.has(scope)) return Promise.reject(scopeError(scope));
        return Promise.resolve(answerFixtureQuery(query));
      },
      subscribe: <E extends keyof TapHostEvents>(
        event: E,
        handler: (payload: TapHostEvents[E]) => void,
      ): (() => void) => {
        const key = String(event);
        const set = eventHandlers.get(key) ?? new Set<(p: unknown) => void>();
        const wrapped = (payload: unknown): void => {
          handler(payload as TapHostEvents[E]);
        };
        set.add(wrapped);
        eventHandlers.set(key, set);
        return () => {
          set.delete(wrapped);
        };
      },
    },
    server: new Proxy(serverTarget, {
      get:
        (_target, property) =>
        (input: unknown): Promise<unknown> =>
          callProcedure(String(property), input),
      has: () => true,
    }),
    state: {
      get: <T>(key: string): T | undefined => {
        const value = state.get(key);
        return value === undefined ? undefined : (value as T);
      },
      set: (key, value) => {
        state.set(key, value);
        emitChange(`state:${key}`);
      },
      subscribe: (key, handler) => subscribe(`state:${key}`, handler),
    },
    ui: {
      size: options.size ?? 'slot',
      toast: (message, tone = 'neutral') =>
        calls.toasts.push({ message, tone }),
      confirm: confirmOptions => {
        calls.confirms.push(confirmOptions);
        return Promise.resolve(options.confirmAnswer ?? true);
      },
      openInChat: card => calls.cards.push(card),
      expand: () => {
        calls.expands += 1;
      },
      download: (blob, filename) =>
        calls.downloads.push({ filename, size: blob.size }),
      copy: text => {
        calls.copies.push(text);
        return Promise.resolve();
      },
    },
    context: options.context ?? {},
    params: options.params ?? {},
    storage,
    telemetry: {
      event: (name, props) => calls.telemetry.push({ name, props }),
    },
    actions: {
      run: (actionId, input) => {
        calls.actions.push({ actionId, input });
        return Promise.resolve({
          id: `run_${String(calls.actions.length)}`,
          actionId,
          status: 'pending' as const,
          requestedAt: new Date(0).toISOString(),
        });
      },
    },
    invalidate: () => undefined,
    __portal: portal,
    __subscribe: subscribe,
  };

  return {
    tap,
    calls,
    portal,
    documents: (collection, documentId) =>
      bucket(collection)
        .filter(entry => documentId === undefined || entry.id === documentId)
        .map(entry => entry.data),
    emit: (event, payload) => {
      for (const handler of eventHandlers.get(String(event)) ?? []) {
        handler(payload);
      }
    },
    setFilters: filters => {
      tap.filters = filters;
      emitChange('filters');
    },
    setSize: size => {
      tap.ui = { ...tap.ui, size };
      emitChange('size');
    },
    setTheme: mode => {
      tap.theme = { mode };
      emitChange('theme');
    },
    setParams: params => {
      tap.params = params;
      emitChange('params');
    },
  };
}
