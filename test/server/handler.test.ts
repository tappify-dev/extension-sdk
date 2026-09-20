import { exportJWK, generateKeyPair, SignJWT, type JSONWebKeySet } from 'jose';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { TapServerError } from '../../src/client/errors';
import { SERVER_ERROR_CODES } from '../../src/server/codes';
import { createTappifyHandler } from '../../src/server/handler';
import type {
  MetricsInput,
  MetricsResponse,
  TappifyHandlerOptions,
  TappifyRouteHandler,
} from '../../src/server/types';

let jwks: JSONWebKeySet;
let sign: (claims?: Record<string, unknown>) => Promise<string>;

beforeAll(async () => {
  const { privateKey, publicKey } = await generateKeyPair('RS256', {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = 'test';
  publicJwk.alg = 'RS256';
  jwks = { keys: [publicJwk] };

  sign = (claims = {}) =>
    new SignJWT({
      installId: 'ins_1',
      extensionId: 'starter',
      projectId: 'prj_1',
      organizationId: 'org_1',
      scopes: ['ui:render'],
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setAudience('ext:starter')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
});

function body(input: unknown = {}, event?: unknown): string {
  return JSON.stringify({
    install: {
      id: 'ins_1',
      extensionId: 'starter',
      projectId: 'prj_1',
      organizationId: 'org_1',
    },
    context: {
      projectId: 'prj_1',
      platform: 'all',
      from: '2026-08-01',
      to: '2026-09-01',
      filters: {
        range: { from: '2026-08-01', to: '2026-09-01', preset: '30d' },
        platform: 'all',
        country: 'all',
      },
    },
    input,
    credentials: { apiKey: 'k' },
    documents: { settings: { refreshMinutes: 15 } },
    event,
  });
}

async function call(
  options: Partial<TappifyHandlerOptions>,
  path: string,
  init: RequestInit = {},
  withToken = true,
): Promise<Response> {
  const handler = createTappifyHandler({
    extensionId: 'starter',
    jwks,
    ...options,
  });

  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  headers.set('x-tappify-event-id', 'evt_1');
  if (withToken) headers.set('authorization', `Bearer ${await sign()}`);

  return handler(
    new Request(`https://api.funnel-lab.dev${path}`, { ...init, headers }),
  );
}

describe('createTappifyHandler', () => {
  it('answers health without a token', async () => {
    const response = await call(
      { health: () => ({ ok: true, version: '1.0.0' }) },
      '/tappify/health',
      {},
      false,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, version: '1.0.0' });
  });

  it('answers health with a default body when no handler is given', async () => {
    const response = await call({}, '/tappify/health', {}, false);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('rejects a missing token with 401', async () => {
    const response = await call(
      { procedures: { getSummary: () => ({ installs: 1 }) } },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: body() },
      false,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: {
        code: 'TAP_TOKEN_MISSING',
        message:
          'This route needs an install token. Tappify sends it as Authorization: Bearer <token>; forward the header unchanged from your framework.',
      },
    });
  });

  it('rejects a request without X-Tappify-Event-Id with 400', async () => {
    const handler = createTappifyHandler({
      extensionId: 'starter',
      jwks,
      procedures: { getSummary: () => ({ installs: 1 }) },
    });

    const response = await handler(
      new Request('https://api.funnel-lab.dev/tappify/procedures/getSummary', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${await sign()}`,
        },
        body: body(),
      }),
    );

    expect(response.status).toBe(400);
    const payload: unknown = await response.json();
    expect(payload).toMatchObject({ error: { code: 'TAP_EVENT_ID_MISSING' } });
  });

  it('rejects a token minted for another extension with 401', async () => {
    const handler = createTappifyHandler({
      extensionId: 'other-extension',
      jwks,
      procedures: { getSummary: () => ({ installs: 1 }) },
    });

    const response = await handler(
      new Request('https://api.funnel-lab.dev/tappify/procedures/getSummary', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tappify-event-id': 'evt_1',
          authorization: `Bearer ${await sign()}`,
        },
        body: body(),
      }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: 'TAP_TOKEN_AUDIENCE' },
    });
  });

  it('routes a procedure and passes the typed request through', async () => {
    const getSummary = vi.fn<TappifyRouteHandler>(() => ({ installs: 42 }));
    const response = await call(
      { procedures: { getSummary } },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: body({ days: 7 }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ installs: 42 });

    const received = getSummary.mock.calls[0][0];
    expect(received.input).toEqual({ days: 7 });
    expect(received.credentials).toEqual({ apiKey: 'k' });
    expect(received.documents.settings).toEqual({ refreshMinutes: 15 });
    expect(received.context.filters.range.preset).toBe('30d');
    expect(received.install.id).toBe('ins_1');
    expect(received.eventId).toBe('evt_1');
    expect(received.claims.installId).toBe('ins_1');
  });

  it('takes the install from the signed claims, not from the body', async () => {
    const getSummary = vi.fn<TappifyRouteHandler>(() => ({ installs: 1 }));
    const forged = JSON.stringify({
      install: {
        id: 'ins_other',
        extensionId: 'other',
        projectId: 'prj_other',
        organizationId: 'org_other',
      },
      input: {},
    });

    const response = await call(
      { procedures: { getSummary } },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: forged },
    );

    expect(response.status).toBe(200);
    expect(getSummary.mock.calls[0][0].install).toEqual({
      id: 'ins_1',
      extensionId: 'starter',
      projectId: 'prj_1',
      organizationId: 'org_1',
    });
  });

  it('falls back to the body install only where the token has no claim', async () => {
    const getSummary = vi.fn<TappifyRouteHandler>(() => ({ installs: 1 }));
    const handler = createTappifyHandler({
      extensionId: 'starter',
      jwks,
      procedures: { getSummary },
    });

    const response = await handler(
      new Request('https://api.funnel-lab.dev/tappify/procedures/getSummary', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tappify-event-id': 'evt_1',
          authorization: `Bearer ${await sign({ projectId: undefined })}`,
        },
        body: body(),
      }),
    );

    expect(response.status).toBe(200);
    expect(getSummary.mock.calls[0][0].install.projectId).toBe('prj_1');
  });

  it('routes tools, mentions, actions, context, work and events', async () => {
    const options: Partial<TappifyHandlerOptions> = {
      tools: { compare: () => ({ type: 'value', value: 1 }) },
      mentions: {
        funnels: request => ({ items: [{ id: '1', label: request.input.q }] }),
      },
      actions: { send_push: () => ({ sent: 3 }) },
      context: { glossary: () => ({ summary: 'Funnel means…' }) },
      work: { create: () => ({ id: 'ISS-1' }) },
      events: { 'release.shipped': vi.fn() },
    };

    expect(
      (
        await call(options, '/tappify/tools/compare', {
          method: 'POST',
          body: body(),
        })
      ).status,
    ).toBe(200);
    expect(
      await (
        await call(options, '/tappify/mentions/funnels?q=onboarding')
      ).json(),
    ).toEqual({ items: [{ id: '1', label: 'onboarding' }] });
    expect(
      (
        await call(options, '/tappify/actions/send_push', {
          method: 'POST',
          body: body(),
        })
      ).status,
    ).toBe(200);
    expect((await call(options, '/tappify/context/glossary')).status).toBe(200);
    expect(
      (
        await call(options, '/tappify/work/create', {
          method: 'POST',
          body: body(),
        })
      ).status,
    ).toBe(200);

    const events = await call(options, '/tappify/events', {
      method: 'POST',
      body: body({}, { name: 'release.shipped', payload: { version: '4.2' } }),
    });
    expect(events.status).toBe(204);
    expect(options.events?.['release.shipped']).toHaveBeenCalledTimes(1);
  });

  it('turns a thrown TapServerError into the wire shape', async () => {
    const response = await call(
      {
        procedures: {
          getSummary: () => {
            throw new TapServerError(
              'FUNNEL_UNAVAILABLE',
              'The funnel needs one shipped release. Ship a release, then retry.',
              503,
            );
          },
        },
      },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: body() },
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: 'FUNNEL_UNAVAILABLE',
        message:
          'The funnel needs one shipped release. Ship a release, then retry.',
      },
    });
  });

  it('hides an unexpected throw behind INTERNAL_ERROR', async () => {
    const response = await call(
      {
        procedures: {
          getSummary: () => {
            throw new Error('connection string: postgres://user:pw@host');
          },
        },
      },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: body() },
    );

    expect(response.status).toBe(500);
    const text = await response.text();
    expect(text).not.toContain('postgres://');
    expect(text).toContain(SERVER_ERROR_CODES.INTERNAL_ERROR);
  });

  it('separates a path with no route from a route with no handler', async () => {
    const outside = await call({}, '/nope');
    expect(outside.status).toBe(404);
    expect(await outside.json()).toMatchObject({
      error: { code: SERVER_ERROR_CODES.ROUTE_UNKNOWN },
    });

    const unknownKind = await call({}, '/tappify/bogus/thing', {
      method: 'POST',
      body: body(),
    });
    expect(unknownKind.status).toBe(404);
    expect(await unknownKind.json()).toMatchObject({
      error: { code: SERVER_ERROR_CODES.ROUTE_UNKNOWN },
    });

    const noHandler = await call(
      { procedures: {} },
      '/tappify/procedures/getSummary',
      { method: 'POST', body: body() },
    );
    expect(noHandler.status).toBe(404);
    expect(await noHandler.json()).toMatchObject({
      error: { code: SERVER_ERROR_CODES.HANDLER_MISSING },
    });
  });

  it('answers every failure with a code SERVER_ERROR_CODES declares', async () => {
    const codes = new Set<string>(Object.values(SERVER_ERROR_CODES));
    const failures = [
      await call({}, '/nope'),
      await call({}, '/tappify/procedures/getSummary', {
        method: 'POST',
        body: body(),
      }),
      await call(
        { procedures: { getSummary: () => ({ installs: 1 }) } },
        '/tappify/procedures/getSummary',
        { method: 'POST', body: body() },
        false,
      ),
      await call({}, '/tappify/procedures/getSummary', {
        method: 'POST',
        body: 'not json',
      }),
    ];

    for (const failure of failures) {
      const payload = (await failure.json()) as { error: { code: string } };
      expect(codes).toContain(payload.error.code);
    }
  });

  it('refuses a body over 1 MB with no content-length to trust', async () => {
    const oversized = JSON.stringify({
      input: { blob: 'x'.repeat(1_100_000) },
    });

    const response = await call(
      { metrics: () => ({ series: [] }) },
      '/tappify/metrics',
      { method: 'POST', body: oversized },
    );

    expect(response.status).toBe(413);
    expect(await response.json()).toMatchObject({
      error: { code: SERVER_ERROR_CODES.BODY_TOO_LARGE },
    });
  });

  it('routes metrics and answers the sync contract shape', async () => {
    const metrics = vi.fn<TappifyRouteHandler<MetricsInput, MetricsResponse>>(
      request => ({
        series: [
          {
            metric: request.input.metrics[0],
            unit: 'count',
            points: [[request.input.from, 42]],
          },
        ],
      }),
    );

    const response = await call({ metrics }, '/tappify/metrics', {
      method: 'POST',
      body: body({
        projectId: 'prj_1',
        platform: 'ios',
        metrics: ['active_users'],
        from: '2026-09-01T00:00:00Z',
        to: '2026-09-02T00:00:00Z',
      }),
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      series: [
        {
          metric: 'active_users',
          unit: 'count',
          points: [['2026-09-01T00:00:00Z', 42]],
        },
      ],
    });

    const received = metrics.mock.calls[0][0];
    expect(received.input.platform).toBe('ios');
    expect(received.input.metrics).toEqual(['active_users']);
  });

  it('honours basePath for a framework that mounts it under a prefix', async () => {
    const handler = createTappifyHandler({
      extensionId: 'starter',
      jwks,
      basePath: '/api',
      health: () => ({ ok: true }),
    });

    const response = await handler(
      new Request('https://api.funnel-lab.dev/api/tappify/health'),
    );

    expect(response.status).toBe(200);
  });
});
