import { describe, expect, it } from 'vitest';
import { TapError, TapServerError } from '../../src/client/errors';
import { SERVER_ERROR_CODES } from '../../src/server/codes';
import {
  createTappifyHandler,
  type TappifyFetchHandler,
} from '../../src/server/handler';
import type {
  MetricsInput,
  TappifyHandlerOptions,
} from '../../src/server/types';
import {
  createTestClient,
  signTestToken,
  testJwks,
} from '../../src/testing/client';
import { createTapMock } from '../../src/testing/mock';
import {
  validateMetricsResponse,
  validateToolResponse,
} from '../../src/testing/validators';

describe('signTestToken and testJwks', () => {
  it('signs a token the handler verifies against the test key set', async () => {
    const token = await signTestToken();
    const jwks = await testJwks();

    expect(token.split('.')).toHaveLength(3);
    expect(jwks.keys[0].kty).toBe('RSA');
    expect(jwks.keys[0].kid).toBe('tappify-test-key');
  });
});

describe('createTestClient', () => {
  const options: TappifyHandlerOptions = {
    extensionId: 'starter',
    health: () => ({ ok: true }),
    procedures: {
      getSummary: (request: { input: unknown }) => ({ echoed: request.input }),
      failing: () => {
        throw new TapServerError(
          'SUMMARY_UNAVAILABLE',
          'Connect a store first, then retry.',
          503,
        );
      },
    },
    metrics: () => ({
      series: [
        {
          metric: 'active_users',
          unit: 'count' as const,
          points: [['2026-09-01T00:00:00Z', 42] as [string, number]],
        },
      ],
    }),
    tools: { compare: () => ({ label: 'x', left: {}, right: {} }) },
    mentions: {
      funnels: (request: { input: { q: string } }) => ({
        items: [{ id: '1', label: request.input.q }],
      }),
    },
    context: { release_notes: () => ({ summary: 'Shipped 4.2.0' }) },
    events: { 'release.shipped': () => undefined },
  };

  it('drives every route the way the host does', async () => {
    const client = createTestClient(options);

    expect(await client.health()).toEqual({ ok: true });
    expect(await client.procedure('getSummary', { days: 7 })).toEqual({
      echoed: { days: 7 },
    });
    expect(await client.tool('compare', {})).toMatchObject({ label: 'x' });
    expect(await client.mention('funnels', 'onboarding')).toEqual({
      items: [{ id: '1', label: 'onboarding' }],
    });
    expect(await client.context('release_notes')).toEqual({
      summary: 'Shipped 4.2.0',
    });
    await expect(
      client.event('release.shipped', { version: '4.2.0' }),
    ).resolves.toBeUndefined();
  });

  it('sends the metrics pull body nested under input', async () => {
    const input: MetricsInput = {
      projectId: 'prj_north',
      platform: 'ios',
      metrics: ['active_users'],
      from: '2026-09-01',
      to: '2026-09-08',
    };
    let received: unknown = null;

    const client = createTestClient({
      extensionId: 'starter',
      metrics: request => {
        received = request.input;
        return { series: [] };
      },
    });

    expect(await client.metrics(input)).toEqual({ series: [] });
    expect(received).toEqual(input);
  });

  it('rethrows a vendor error as TapServerError with its status', async () => {
    const client = createTestClient(options);

    await expect(client.procedure('failing')).rejects.toMatchObject({
      name: 'TapServerError',
      code: 'SUMMARY_UNAVAILABLE',
      status: 503,
    });
  });

  it('surfaces the wire code when the handler has no such route', async () => {
    const client = createTestClient(options);

    await expect(client.procedure('missing')).rejects.toMatchObject({
      code: SERVER_ERROR_CODES.HANDLER_MISSING,
      status: 404,
    });
    await expect(client.raw('GET', '/elsewhere')).resolves.toMatchObject({
      status: 404,
    });
  });

  it('gives every call its own idempotency key unless one is pinned', async () => {
    const seen: (string | null)[] = [];
    const recording: TappifyHandlerOptions = {
      extensionId: 'starter',
      events: {
        'release.shipped': request => {
          seen.push(request.request.headers.get('x-tappify-event-id'));
        },
      },
    };

    const client = createTestClient(recording);
    await client.event('release.shipped', { version: '4.2.0' });
    await client.event('release.shipped', { version: '4.3.0' });

    const pinned = createTestClient(recording, { eventId: 'evt_fixed' });
    await pinned.event('release.shipped', { version: '4.4.0' });

    expect(seen).toEqual([
      'evt_/tappify/events_1',
      'evt_/tappify/events_2',
      'evt_fixed',
    ]);
  });

  it('refuses a built handler and names the options object instead', () => {
    const handler: TappifyFetchHandler = () =>
      Promise.resolve(new Response(null, { status: 204 }));
    const target: TappifyHandlerOptions = Object.assign(handler, {
      extensionId: 'starter',
    });

    let thrown: unknown;
    try {
      createTestClient(target);
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_TEST_TARGET_INVALID');
    expect(thrown.message).toContain('createTestClient(handlerOptions)');
    expect(thrown.message).toContain('testJwks()');
  });

  it('builds the handler against the test key set', async () => {
    const client = createTestClient(options);
    const response = await client.raw('GET', '/tappify/health');

    expect(response.status).toBe(200);
  });

  it('reports a non-JSON failure instead of throwing a SyntaxError', async () => {
    const mock = createTapMock({
      handler: () =>
        Promise.resolve(
          new Response('<html>502 Bad Gateway</html>', { status: 502 }),
        ),
    });

    await expect(mock.tap.server.getSummary({})).rejects.toMatchObject({
      name: 'TapServerError',
      code: SERVER_ERROR_CODES.INTERNAL_ERROR,
      status: 502,
    });
  });

  it('signs a token for createTapMock when the vendor passes only a handler', async () => {
    const mock = createTapMock({
      handler: createTappifyHandler({ ...options, jwks: await testJwks() }),
    });

    await expect(mock.tap.server.getSummary({ days: 7 })).resolves.toEqual({
      echoed: { days: 7 },
    });
  });

  it('lets createTapMock drive the same handler from tap.server', async () => {
    const mock = createTapMock({
      handler: createTappifyHandler({ ...options, jwks: await testJwks() }),
      handlerToken: await signTestToken({}, { extensionId: 'starter' }),
    });

    await expect(mock.tap.server.getSummary({ days: 7 })).resolves.toEqual({
      echoed: { days: 7 },
    });
    await expect(mock.tap.server.failing({})).rejects.toMatchObject({
      name: 'TapServerError',
      code: 'SUMMARY_UNAVAILABLE',
      status: 503,
    });
  });
});

describe('response validators', () => {
  it('checks a metrics response against the declared metrics', () => {
    const declared = [
      {
        key: 'active_users',
        label: 'Active users',
        unit: 'count' as const,
        kind: 'gauge' as const,
      },
    ];

    expect(
      validateMetricsResponse(
        {
          series: [
            { metric: 'active_users', unit: 'count', points: [['t', 1]] },
          ],
        },
        declared,
      ),
    ).toEqual([]);

    expect(
      validateMetricsResponse(
        { series: [{ metric: 'ghost', unit: 'count', points: [] }] },
        declared,
      )[0],
    ).toContain('not declared');

    expect(
      validateMetricsResponse(
        { series: [{ metric: 'active_users', unit: 'ratio', points: [] }] },
        declared,
      )[0],
    ).toContain('declared as "count"');

    expect(
      validateMetricsResponse(
        {
          series: [{ metric: 'active_users', unit: 'count', points: [['t']] }],
        },
        declared,
      )[0],
    ).toContain('[timestamp, value] pair');

    expect(validateMetricsResponse({}, declared)[0]).toContain('"series"');
  });

  it('checks a tool response against its declared card', () => {
    expect(validateToolResponse({ label: 'a', value: 1 }, 'value')).toEqual([]);
    expect(validateToolResponse({ label: 'a' }, 'value')[0]).toContain(
      '"value"',
    );
    expect(validateToolResponse('nope', 'list')[0]).toContain('an object');
  });
});
