import type { Tap, TapChangeKey, TapSingleton } from '../../src/client/types';

export interface TapStub {
  tap: Tap;
  emit(key: TapChangeKey): void;
  listenerCount(key: TapChangeKey): number;
}

export function createStubTap(overrides: Partial<Tap> = {}): TapStub {
  const listeners = new Map<TapChangeKey, Set<() => void>>();
  const state = new Map<string, unknown>();

  const emit = (key: TapChangeKey): void => {
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

  const base: Tap = {
    extension: {
      id: 'starter',
      name: 'Starter',
      installId: 'ins_1',
      projectId: 'prj_1',
    },
    env: 'dev',
    host: { version: '2026.9.9', sdkMajors: [2] },
    auth: {
      token: 'token',
      user: { id: 'usr_1', role: 'admin' },
      organizationId: 'org_1',
      scopes: ['ui:render'],
      can: () => true,
    },
    project: {
      id: 'prj_1',
      name: 'Sandbox',
      platforms: ['ios'],
      apps: [],
      releases: [],
      keywords: [],
    },
    filters: {
      range: { from: '2026-08-01', to: '2026-09-01', preset: '30d' },
      platform: 'all',
      country: 'all',
    },
    theme: { mode: 'light' },
    locale: 'en-US',
    timezone: 'UTC',
    format: {
      number: value => String(value),
      currency: (value, code) => `${code} ${String(value)}`,
      date: value => String(value),
      relative: value => String(value),
    },
    nav: {
      push: () => undefined,
      setSearch: () => undefined,
      openSettings: () => undefined,
      openChat: () => undefined,
      openExternal: () => undefined,
    },
    data: {
      query: () => Promise.reject(new Error('no data source in this stub')),
      subscribe: () => () => undefined,
    },
    server: {},
    state: {
      get: <T>(key: string): T | undefined => {
        const value = state.get(key);
        return value === undefined ? undefined : (value as T);
      },
      set: (key, value) => {
        state.set(key, value);
        emit(`state:${key}`);
      },
      subscribe: (key, handler) => subscribe(`state:${key}`, handler),
    },
    ui: {
      size: 'slot',
      toast: () => undefined,
      confirm: () => Promise.resolve(true),
      openInChat: () => undefined,
      expand: () => undefined,
      download: () => undefined,
      copy: () => Promise.resolve(),
    },
    context: {},
    params: {},
    storage: {},
    telemetry: { event: () => undefined },
    actions: {
      run: () =>
        Promise.resolve({
          id: 'run_1',
          actionId: 'noop',
          status: 'pending' as const,
          requestedAt: '2026-09-09T00:00:00Z',
        }),
    },
    invalidate: () => undefined,
    __portal: null,
    __subscribe: subscribe,
  };

  const tap: Tap = Object.assign(base, overrides);

  return {
    tap,
    emit,
    listenerCount: key => listeners.get(key)?.size ?? 0,
  };
}

export function stubSingleton<T>(initial: T | null): TapSingleton<T> {
  let document = initial;
  return {
    get: () => Promise.resolve(document),
    set: next => {
      document = next;
      return Promise.resolve();
    },
    patch: partial => {
      document = { ...(document ?? ({} as T)), ...partial };
      return Promise.resolve(document);
    },
  };
}
