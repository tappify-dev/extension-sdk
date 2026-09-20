import {
  exportJWK,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
  type JSONWebKeySet,
} from 'jose';
import { TapError } from '../client/errors';
import type { TapFilters } from '../client/types';
import { createTappifyHandler } from '../server/handler';
import type {
  ContextBlock,
  MentionItems,
  MetricsInput,
  MetricsResponse,
  TappifyClaims,
  TappifyHandlerOptions,
  TappifyHealth,
  TappifyInstall,
  WorkOperation,
} from '../server/types';
import {
  callEnvelope,
  DEFAULT_FILTERS,
  readEnvelopeResponse,
} from './envelope';

const TEST_KID = 'tappify-test-key';
const TEST_ISSUER = 'https://api.tappify.ai';

interface TestKeys {
  privateKey: CryptoKey;
  jwks: JSONWebKeySet;
}

let keys: Promise<TestKeys> | null = null;

function ensureKeys(): Promise<TestKeys> {
  keys ??= (async () => {
    const pair = await generateKeyPair('RS256', { extractable: true });
    const publicJwk = await exportJWK(pair.publicKey);
    return {
      privateKey: pair.privateKey,
      jwks: {
        keys: [{ ...publicJwk, kid: TEST_KID, alg: 'RS256', use: 'sig' }],
      },
    };
  })();

  return keys;
}

/**
 * Returns the public key set that verifies the tokens `signTestToken` signs.
 *
 * @remarks
 * The pair is generated once per process and cached, so every call in a suite
 * returns the same set. Pass it as `jwks` to `createTappifyHandler` when a test
 * drives the handler itself; `createTestClient` does that for you.
 *
 * @example
 * ```ts
 * import { createTappifyHandler } from '@tappify/extension-sdk/server';
 * import { testJwks } from '@tappify/extension-sdk/testing';
 *
 * async function buildHandler() {
 *   return createTappifyHandler({ extensionId: 'starter', jwks: await testJwks() });
 * }
 * ```
 */
export async function testJwks(): Promise<JSONWebKeySet> {
  return (await ensureKeys()).jwks;
}

/**
 * Signs an install token a handler built against `testJwks` accepts.
 *
 * @remarks
 * Every claim has a default — install `ins_test`, extension `starter`, project
 * `prj_north`, organization `org_test`, no scopes — and the audience is
 * `ext:<extensionId>`, taken from `options.extensionId`, then from the claims, then
 * `starter`. It expires in five minutes unless `expiresIn` says otherwise, which is
 * how a test covers an expired token. `createTestClient` and `createTapMock` sign
 * their own tokens, so reach for this only when a test verifies a token itself.
 *
 * @example
 * ```ts
 * import { verifyTappifyToken } from '@tappify/extension-sdk/server';
 * import { signTestToken, testJwks } from '@tappify/extension-sdk/testing';
 *
 * async function claimsOfTestToken() {
 *   const token = await signTestToken({ scopes: ['analytics:read'] });
 *   return verifyTappifyToken(token, {
 *     extensionId: 'starter',
 *     jwks: await testJwks(),
 *   });
 * }
 * ```
 */
export async function signTestToken(
  claims: Partial<TappifyClaims> = {},
  options: { extensionId?: string; expiresIn?: string } = {},
): Promise<string> {
  const { privateKey } = await ensureKeys();
  const extensionId = options.extensionId ?? claims.extensionId ?? 'starter';

  return new SignJWT({
    installId: claims.installId ?? 'ins_test',
    extensionId,
    projectId: claims.projectId ?? 'prj_north',
    organizationId: claims.organizationId ?? 'org_test',
    scopes: claims.scopes ?? [],
    ...(claims.userId === undefined ? {} : { userId: claims.userId }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: TEST_KID })
    .setIssuer(TEST_ISSUER)
    .setAudience(`ext:${extensionId}`)
    .setIssuedAt()
    .setExpirationTime(options.expiresIn ?? '5m')
    .sign(privateKey);
}

/** What every call a `TestClient` makes carries, unless a call overrides it. */
export interface TestClientDefaults {
  /** Merged over the default install, whose id is `ins_test`. */
  install?: Partial<TappifyInstall>;
  /** The scopes the token claims. Defaults to none. */
  scopes?: string[];
  /** What the handler reads as `credentials`. Defaults to empty. */
  credentials?: Record<string, unknown>;
  /** What the handler reads as `documents`, including `settings`. */
  documents?: Record<string, unknown>;
  /** The filter bar behind the call. Defaults to a seven-day September range. */
  filters?: TapFilters;
  /** One fixed idempotency key. Left out, each call gets its own. */
  eventId?: string;
  /** The origin the request url is built on. Defaults to `https://vendor.test`. */
  origin?: string;
}

/** One method per route Tappify calls, plus `raw` for the response itself. */
export interface TestClient {
  /** Calls the health route, which carries no token. */
  health(): Promise<TappifyHealth>;
  /** Calls the connector's metrics route. */
  metrics(input: MetricsInput): Promise<MetricsResponse>;
  /** Calls one tool by id and returns the card it answered with. */
  tool(id: string, input: unknown): Promise<unknown>;
  /** Calls one mention by id, with the query as the `q` parameter. */
  mention(id: string, query: string): Promise<MentionItems>;
  /** Calls one action by id. */
  action(id: string, input: unknown): Promise<unknown>;
  /** Calls one procedure by name; the input defaults to an empty object. */
  procedure(name: string, input?: unknown): Promise<unknown>;
  /** Calls one context block by id. */
  context(id: string): Promise<ContextBlock>;
  /** Posts one Tappify event, which the handler answers with 204. */
  event(name: string, payload: Record<string, unknown>): Promise<void>;
  /** Calls one work operation. */
  work(operation: WorkOperation, input: unknown): Promise<unknown>;
  /**
   * Sends any method and path and returns the `Response`, for a test that asserts
   * on a status rather than a body.
   */
  raw(method: string, path: string, body?: unknown): Promise<Response>;
}

const HEALTH_PATH = '/tappify/health';

/**
 * Drives a vendor server the way Tappify does, so a route is tested without a
 * running Tappify.
 *
 * @remarks
 * Pass the options object you hand `createTappifyHandler`, not the handler it
 * returns: the client rebuilds the handler around `testJwks` and signs each call
 * with a matching token. A built handler throws a `TapError` carrying
 * `TAP_TEST_TARGET_INVALID`, because it would verify against the live Tappify key
 * set and answer 401. Every call carries a fresh event id and the envelope Tappify
 * sends, and every call but `health` a signed token, so the handler reads the same
 * `install`, `context`, `credentials` and `documents` it will read in production. A route that
 * answers an error rejects with a `TapServerError` carrying the code, message and
 * status from the body, which is what a test asserts on; use `raw` when the status
 * itself is the assertion. Every method calls the unprefixed path — `/tappify/…` —
 * whatever `basePath` the options carry, so a `basePath` the handler strips off
 * something else is not exercised here, and one that is itself a prefix of
 * `/tappify`, such as `/tap`, makes every call 404 `TAP_ROUTE_UNKNOWN`. Reach a
 * prefixed path through `raw` when that is what you need to cover.
 *
 * @example
 * ```ts
 * import type { TappifyHandlerOptions } from '@tappify/extension-sdk/server';
 * import { createTestClient } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * const handlerOptions: TappifyHandlerOptions = {
 *   extensionId: 'starter',
 *   health: () => ({ ok: true, version: '0.1.0' }),
 * };
 * const client = createTestClient(handlerOptions, { scopes: ['analytics:read'] });
 *
 * it('answers the health check', async () => {
 *   await expect(client.health()).resolves.toEqual({ ok: true, version: '0.1.0' });
 * });
 * ```
 */
export function createTestClient(
  target: TappifyHandlerOptions,
  defaults: TestClientDefaults = {},
): TestClient {
  if (typeof target === 'function') {
    throw new TapError(
      'TAP_TEST_TARGET_INVALID',
      'createTestClient() was handed a built handler instead of the options object. A handler from createTappifyHandler() verifies install tokens against the live Tappify key set, so every call the test client makes would come back 401. Pass the options themselves — createTestClient(handlerOptions) — or, when you need the handler, build it with createTappifyHandler({ ...handlerOptions, jwks: await testJwks() }) and drive it through createTapMock({ handler, extensionId: handlerOptions.extensionId }) so the test token carries the audience the handler expects.',
    );
  }

  const extensionId = target.extensionId;
  const handlerPromise = testJwks().then(jwks =>
    createTappifyHandler({ ...target, jwks }),
  );

  const install: TappifyInstall = {
    id: 'ins_test',
    extensionId,
    projectId: 'prj_north',
    organizationId: 'org_test',
    ...defaults.install,
  };

  const filters = defaults.filters ?? DEFAULT_FILTERS;
  const origin = defaults.origin ?? 'https://vendor.test';

  let sent = 0;

  function envelope(input: unknown, event?: unknown): string {
    return callEnvelope({
      install,
      filters,
      input,
      credentials: defaults.credentials,
      documents: defaults.documents,
      event,
    });
  }

  async function send(
    method: string,
    path: string,
    body?: string,
  ): Promise<Response> {
    const handler = await handlerPromise;
    sent += 1;
    const headers = new Headers({
      'content-type': 'application/json',
      'x-tappify-event-id': defaults.eventId ?? `evt_${path}_${String(sent)}`,
    });

    if (path !== HEALTH_PATH) {
      const token = await signTestToken(
        {
          installId: install.id,
          extensionId: install.extensionId,
          projectId: install.projectId,
          organizationId: install.organizationId,
          scopes: defaults.scopes ?? [],
        },
        { extensionId },
      );
      headers.set('authorization', `Bearer ${token}`);
    }

    return handler(
      new Request(`${origin}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body }),
      }),
    );
  }

  async function call(
    method: string,
    path: string,
    body?: string,
  ): Promise<unknown> {
    return readEnvelopeResponse(
      await send(method, path, body),
      `${method} ${path}`,
    );
  }

  return {
    health: async () => (await call('GET', HEALTH_PATH)) as TappifyHealth,
    metrics: async input =>
      (await call(
        'POST',
        '/tappify/metrics',
        envelope(input),
      )) as MetricsResponse,
    tool: (id, input) => call('POST', `/tappify/tools/${id}`, envelope(input)),
    mention: async (id, query) =>
      (await call(
        'GET',
        `/tappify/mentions/${id}?q=${encodeURIComponent(query)}`,
      )) as MentionItems,
    action: (id, input) =>
      call('POST', `/tappify/actions/${id}`, envelope(input)),
    procedure: (name, input = {}) =>
      call('POST', `/tappify/procedures/${name}`, envelope(input)),
    context: async id =>
      (await call('GET', `/tappify/context/${id}`)) as ContextBlock,
    event: async (name, payload) => {
      await call('POST', '/tappify/events', envelope({}, { name, payload }));
    },
    work: (operation, input) =>
      call('POST', `/tappify/work/${operation}`, envelope(input)),
    raw: (method, path, body) =>
      send(method, path, body === undefined ? undefined : JSON.stringify(body)),
  };
}
