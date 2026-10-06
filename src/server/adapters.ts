import type { IncomingMessage, ServerResponse } from 'node:http';
import { TapServerError } from '../client/errors';
import { SERVER_ERROR_CODES } from './codes';
import type { TappifyFetchHandler } from './handler';
import { INTERNAL_MESSAGE, wireError } from './wire';

/**
 * The part of a Node readable stream the adapters use, so neither adapter has to
 * name a framework's own request type.
 */
export interface BodyStream {
  /** Each chunk of the body, in order. */
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  /** The body is complete. */
  on(event: 'end', listener: () => void): unknown;
  /** The stream failed; the adapter rejects with the error. */
  on(event: 'error', listener: (error: Error) => void): unknown;
}

/** The part of an Express request `toExpress` reads. */
export interface ExpressLikeRequest {
  method: string;
  /** Preferred over `url`, so a router-mounted path keeps its prefix. */
  originalUrl?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  /** A parsed body from `express.json()`, or a raw string. */
  body?: unknown;
  /** Used as the scheme of the url handed to the handler. Defaults to `https`. */
  protocol?: string;
  /** Present when no parser has consumed the stream, which is then read as-is. */
  on?: BodyStream['on'];
}

/** The part of an Express response `toExpress` writes. */
export interface ExpressLikeResponse {
  /** Sets the status and returns the response, so the call chains into `send`. */
  status(code: number): ExpressLikeResponse;
  /** Called once per header the handler's response carries. */
  setHeader(name: string, value: string): void;
  /** Called once, with the handler's response body as text. */
  send(body: string): void;
}

/** What `toExpress` returns: an Express middleware over the three arguments. */
export type ExpressMiddleware = (
  request: ExpressLikeRequest,
  response: ExpressLikeResponse,
  next: (error?: unknown) => void,
) => void;

/** What `toNode` returns: a listener for `http.createServer`. */
export type NodeRequestListener = (
  request: IncomingMessage,
  response: ServerResponse,
) => void;

function toHeaders(
  raw: Record<string, string | string[] | undefined>,
): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(','));
  }
  return headers;
}

function originOf(
  headers: Record<string, string | string[] | undefined>,
  protocol: string,
): string {
  const host = headers.host;
  return `${protocol}://${typeof host === 'string' ? host : 'localhost'}`;
}

function hasBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function readStream(stream: BodyStream): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0;

    stream.on('data', chunk => {
      chunks.push(chunk);
      size += chunk.byteLength;
    });

    stream.on('end', () => {
      const body = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        body.set(chunk, offset);
        offset += chunk.byteLength;
      }
      resolve(body.buffer);
    });

    stream.on('error', reject);
  });
}

function isReadable(
  request: ExpressLikeRequest,
): request is ExpressLikeRequest & BodyStream {
  return typeof request.on === 'function';
}

async function expressBody(
  request: ExpressLikeRequest,
): Promise<BodyInit | undefined> {
  if (typeof request.body === 'string') return request.body;
  if (request.body !== undefined && request.body !== null) {
    return JSON.stringify(request.body);
  }

  if (!isReadable(request)) {
    throw new TapServerError(
      SERVER_ERROR_CODES.BODY_INVALID,
      'The Express request carried no parsed body and no readable stream, so the call would have run against an empty body. Mount express.json() before the Tappify middleware, or mount the middleware before any parser that consumes the stream.',
      400,
    );
  }

  const bytes = await readStream(request);
  return bytes.byteLength > 0 ? bytes : undefined;
}

async function write(
  response: ExpressLikeResponse,
  webResponse: Response,
): Promise<void> {
  webResponse.headers.forEach((value, name) => {
    response.setHeader(name, value);
  });
  response.status(webResponse.status).send(await webResponse.text());
}

/**
 * Wraps the handler as Express middleware, for a server that speaks Express
 * rather than `fetch`.
 *
 * @remarks
 * It builds the url from `originalUrl` and the `host` header, forwards every
 * header, and takes the body from `request.body` when a parser has already read
 * it or from the stream when none has. A request with neither — a parser that
 * consumed the stream without leaving a body — fails with a `TapServerError`
 * carrying `TAP_BODY_INVALID` rather than calling your handler against an empty
 * body, so mount `express.json()` before this middleware or mount this one first.
 * A `TapServerError` is written as the handler's own JSON error; anything else
 * goes to `next`, so your own error middleware sees it.
 *
 * @example
 * ```ts
 * import { createTappifyHandler, toExpress } from '@tappify/extension-sdk/server';
 *
 * const middleware = toExpress(
 *   createTappifyHandler({ extensionId: 'starter', health: () => ({ ok: true }) }),
 * );
 * ```
 */
export function toExpress(handler: TappifyFetchHandler): ExpressMiddleware {
  return (request, response, next) => {
    void (async () => {
      const url = new URL(
        request.originalUrl ?? request.url ?? '/',
        originOf(request.headers, request.protocol ?? 'https'),
      );

      const init: RequestInit = {
        method: request.method,
        headers: toHeaders(request.headers),
      };

      if (hasBody(request.method)) {
        init.body = await expressBody(request);
      }

      await write(response, await handler(new Request(url, init)));
    })().catch((error: unknown) => {
      if (TapServerError.is(error)) {
        void write(
          response,
          wireError(error.code, error.message, error.status ?? 400),
        );
        return;
      }
      next(error);
    });
  };
}

/**
 * Wraps the handler as a listener for Node's own `http.createServer`, with no
 * framework in between.
 *
 * @remarks
 * It builds the url from `request.url` and the `host` header over `http`, forwards
 * every header, and reads the body straight off the stream, so nothing may have
 * consumed it first. It answers the whole response itself: a `TapServerError`
 * becomes its own code and status, and anything else becomes 500
 * `TAP_INTERNAL_ERROR`. Put it behind a TLS-terminating proxy in production; the
 * scheme it builds is only what the handler sees in `request.url`.
 *
 * @example
 * ```ts
 * import { createTappifyHandler, toNode } from '@tappify/extension-sdk/server';
 * import { createServer } from 'node:http';
 *
 * const listener = toNode(
 *   createTappifyHandler({ extensionId: 'starter', health: () => ({ ok: true }) }),
 * );
 * const server = createServer(listener);
 * ```
 */
export function toNode(handler: TappifyFetchHandler): NodeRequestListener {
  return (request, response) => {
    void (async () => {
      const method = request.method ?? 'GET';
      const url = new URL(
        request.url ?? '/',
        originOf(request.headers, 'http'),
      );

      const init: RequestInit = {
        method,
        headers: toHeaders(request.headers),
      };

      if (hasBody(method)) {
        const bytes = await readStream(request);
        if (bytes.byteLength > 0) init.body = bytes;
      }

      const webResponse = await handler(new Request(url, init));
      const headers: Record<string, string> = {};
      webResponse.headers.forEach((value, name) => {
        headers[name] = value;
      });

      response.writeHead(webResponse.status, headers);
      response.end(await webResponse.text());
    })().catch((error: unknown) => {
      const wire = TapServerError.is(error)
        ? {
            code: error.code,
            message: error.message,
            status: error.status ?? 400,
          }
        : {
            code: SERVER_ERROR_CODES.INTERNAL_ERROR,
            message: INTERNAL_MESSAGE,
            status: 500,
          };

      response.writeHead(wire.status, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({ error: { code: wire.code, message: wire.message } }),
      );
    });
  };
}
