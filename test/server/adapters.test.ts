import { createServer, request as nodeRequest } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  toExpress,
  toNode,
  type ExpressLikeRequest,
  type ExpressLikeResponse,
  type NodeRequestListener,
} from '../../src/server/adapters';
import { SERVER_ERROR_CODES } from '../../src/server/codes';
import type { TappifyFetchHandler } from '../../src/server/handler';

const echo: TappifyFetchHandler = async request =>
  new Response(
    JSON.stringify({
      method: request.method,
      path: new URL(request.url).pathname,
      query: new URL(request.url).search,
      eventId: request.headers.get('x-tappify-event-id'),
      body: await request.text(),
    }),
    {
      status: 201,
      headers: {
        'content-type': 'application/json',
        'x-tappify-probe': 'yes',
      },
    },
  );

const explode: TappifyFetchHandler = () => {
  throw new Error('connection string: postgres://user:pw@host');
};

function mockResponse() {
  const sent = {
    status: 0,
    headers: {} as Record<string, string>,
    body: '',
  };

  const response: ExpressLikeResponse = {
    status(code) {
      sent.status = code;
      return response;
    },
    setHeader(name, value) {
      sent.headers[name] = value;
    },
    send(payload) {
      sent.body = payload;
    },
  };

  return { response, sent };
}

function settled(sent: { status: number }): Promise<void> {
  return vi.waitFor(() => {
    expect(sent.status).not.toBe(0);
  });
}

describe('toExpress', () => {
  it('posts a body express.json() already parsed', async () => {
    const { response, sent } = mockResponse();

    toExpress(echo)(
      {
        method: 'POST',
        originalUrl: '/tappify/procedures/getSummary?days=7',
        headers: {
          host: 'api.funnel-lab.dev',
          'x-tappify-event-id': 'evt_1',
        },
        protocol: 'https',
        body: { input: { days: 7 } },
      },
      response,
      () => {
        throw new Error('next() should not run');
      },
    );

    await settled(sent);

    expect(sent.status).toBe(201);
    expect(sent.headers['x-tappify-probe']).toBe('yes');
    expect(JSON.parse(sent.body)).toEqual({
      method: 'POST',
      path: '/tappify/procedures/getSummary',
      query: '?days=7',
      eventId: 'evt_1',
      body: '{"input":{"days":7}}',
    });
  });

  it('reads the raw stream when no parser has run', async () => {
    const { response, sent } = mockResponse();
    const payload = '{"input":{"days":7}}';

    const stream = Readable.from([Buffer.from(payload)]);
    const request: ExpressLikeRequest = {
      method: 'POST',
      url: '/tappify/procedures/getSummary',
      headers: { host: 'api.funnel-lab.dev' },
      on: stream.on.bind(stream),
    };

    toExpress(echo)(request, response, () => {
      throw new Error('next() should not run');
    });

    await settled(sent);

    expect(sent.status).toBe(201);
    const received: { body: string } = JSON.parse(sent.body);
    expect(received.body).toBe(payload);
  });

  it('refuses to run a handler on a body it could not read', async () => {
    const { response, sent } = mockResponse();

    toExpress(echo)(
      {
        method: 'POST',
        url: '/tappify/procedures/getSummary',
        headers: { host: 'api.funnel-lab.dev' },
      },
      response,
      () => {
        throw new Error('next() should not run');
      },
    );

    await settled(sent);

    expect(sent.status).toBe(400);
    expect(JSON.parse(sent.body)).toMatchObject({
      error: { code: SERVER_ERROR_CODES.BODY_INVALID },
    });
    expect(sent.body).toContain('express.json()');
  });

  it('sends a GET through without touching the body', async () => {
    const { response, sent } = mockResponse();

    toExpress(echo)(
      {
        method: 'GET',
        url: '/tappify/health',
        headers: { host: 'api.funnel-lab.dev' },
      },
      response,
      () => {
        throw new Error('next() should not run');
      },
    );

    await settled(sent);

    expect(sent.status).toBe(201);
    expect(JSON.parse(sent.body)).toMatchObject({
      method: 'GET',
      path: '/tappify/health',
      body: '',
    });
  });

  it('hands an unexpected failure to next()', async () => {
    const { response } = mockResponse();
    const next = vi.fn();

    toExpress(explode)(
      {
        method: 'GET',
        url: '/tappify/health',
        headers: { host: 'api.funnel-lab.dev' },
      },
      response,
      next,
    );

    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});

interface Served {
  url: string;
  close(): Promise<void>;
}

const running: Served[] = [];

async function serve(listener: NodeRequestListener): Promise<Served> {
  const server = createServer(listener);
  await new Promise<void>(resolve => {
    server.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address() as AddressInfo;
  const served: Served = {
    url: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise<void>(resolve => {
        server.close(() => {
          resolve();
        });
      }),
  };

  running.push(served);
  return served;
}

function send(
  url: string,
  init: { method: string; body?: string; headers?: Record<string, string> },
): Promise<{ status: number; headers: Record<string, unknown>; body: string }> {
  return new Promise((resolve, reject) => {
    const call = nodeRequest(
      url,
      { method: init.method, headers: init.headers },
      response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => (text += chunk));
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: text,
          });
        });
      },
    );

    call.on('error', reject);
    if (init.body !== undefined) call.write(init.body);
    call.end();
  });
}

afterEach(async () => {
  await Promise.all(running.splice(0).map(served => served.close()));
});

describe('toNode', () => {
  it('round-trips a POST over a real server, with status and headers', async () => {
    const served = await serve(toNode(echo));

    const response = await send(
      `${served.url}/tappify/procedures/getSummary?days=7`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-tappify-event-id': 'evt_1',
        },
        body: '{"input":{"days":7}}',
      },
    );

    expect(response.status).toBe(201);
    expect(response.headers['x-tappify-probe']).toBe('yes');
    expect(JSON.parse(response.body)).toEqual({
      method: 'POST',
      path: '/tappify/procedures/getSummary',
      query: '?days=7',
      eventId: 'evt_1',
      body: '{"input":{"days":7}}',
    });
  });

  it('sends a GET through with no body', async () => {
    const served = await serve(toNode(echo));

    const response = await send(`${served.url}/tappify/health`, {
      method: 'GET',
    });

    expect(response.status).toBe(201);
    expect(JSON.parse(response.body)).toMatchObject({
      method: 'GET',
      path: '/tappify/health',
      body: '',
    });
  });

  it('answers an unexpected failure with 500 and no stack', async () => {
    const served = await serve(toNode(explode));

    const response = await send(`${served.url}/tappify/health`, {
      method: 'GET',
    });

    expect(response.status).toBe(500);
    expect(response.body).not.toContain('postgres://');
    expect(JSON.parse(response.body)).toEqual({
      error: {
        code: SERVER_ERROR_CODES.INTERNAL_ERROR,
        message:
          'The extension server failed to handle this call. Check your own logs; Tappify records the failure against your extension.',
      },
    });
  });
});
