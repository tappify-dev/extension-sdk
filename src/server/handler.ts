import { TapError, TapServerError } from '../client/errors';
import type { TapCredentialValues, TapDateRange } from '../client/types';
import { EVENTS } from '../manifest/constants';
import { SERVER_ERROR_CODES, type TapServerErrorCode } from './codes';
import { verifyTappifyToken } from './token';
import type {
  ContextBlock,
  MentionItems,
  MetricsInput,
  MetricsResponse,
  TappifyCallContext,
  TappifyClaims,
  TappifyDocuments,
  TappifyHandlerOptions,
  TappifyHealth,
  TappifyInstall,
  TappifyRequest,
  WorkOperation,
} from './types';
import {
  INTERNAL_MESSAGE,
  failure,
  json,
  readRecord,
  readText,
  readUnknown,
  wireError,
} from './wire';

/**
 * What `createTappifyHandler` returns: a `fetch` handler, which is what Cloudflare
 * Workers, Vercel and the two adapters all take.
 */
export type TappifyFetchHandler = (request: Request) => Promise<Response>;

const MAX_BODY_BYTES = 1_048_576;

const WORK_OPERATIONS: readonly WorkOperation[] = [
  'list_containers',
  'create',
  'attach',
  'comment',
  'status',
  'resolve',
];

const TOKEN_FAILURES: readonly TapServerErrorCode[] = [
  SERVER_ERROR_CODES.TOKEN_INVALID,
  SERVER_ERROR_CODES.TOKEN_AUDIENCE,
];

/**
 * The token is signed by Tappify and the body is not, so the claims win wherever
 * they carry a value and the body only fills what the token leaves out.
 */
function toInstall(payload: unknown, claims: TappifyClaims): TappifyInstall {
  const raw = readRecord(payload, 'install');
  return {
    id: claims.installId,
    extensionId: claims.extensionId,
    projectId: claims.projectId ?? readText(raw, 'projectId'),
    organizationId: claims.organizationId,
  };
}

function toPlatform(value: string | null): TappifyCallContext['platform'] {
  return value === 'ios' || value === 'android' ? value : 'all';
}

function toPreset(value: string | null): TapDateRange['preset'] {
  return value === '7d' || value === '30d' || value === '90d'
    ? value
    : undefined;
}

function toContext(payload: unknown): TappifyCallContext {
  const raw = readRecord(payload, 'context');
  const filters = readRecord(raw, 'filters');
  const rawRange = readRecord(filters, 'range');
  const from = readText(raw, 'from') ?? readText(rawRange, 'from') ?? '';
  const to = readText(raw, 'to') ?? readText(rawRange, 'to') ?? '';

  const range: TapDateRange = {
    from: readText(rawRange, 'from') ?? from,
    to: readText(rawRange, 'to') ?? to,
  };

  const preset = toPreset(readText(rawRange, 'preset'));
  if (preset !== undefined) range.preset = preset;

  return {
    projectId: readText(raw, 'projectId'),
    platform: toPlatform(readText(raw, 'platform')),
    from,
    to,
    filters: {
      range,
      platform: toPlatform(readText(filters, 'platform')),
      country: readText(filters, 'country') ?? 'all',
    },
  };
}

function toCredentials(payload: unknown): TapCredentialValues {
  const raw = readRecord(payload, 'credentials');
  const credentials: Record<string, string> = {};
  for (const [name, value] of Object.entries(raw)) {
    if (typeof value === 'string') credentials[name] = value;
  }
  return credentials;
}

function tooLarge(): TapServerError {
  return new TapServerError(
    SERVER_ERROR_CODES.BODY_TOO_LARGE,
    'A Tappify request body is at most 1 MB. Return a cursor or an id the host can follow instead of inlining the payload.',
    413,
  );
}

async function readBody(request: Request): Promise<unknown> {
  if (request.method === 'GET' || request.method === 'HEAD') return {};

  const length = request.headers.get('content-length');
  if (length !== null && Number(length) > MAX_BODY_BYTES) throw tooLarge();

  const bytes = await request.arrayBuffer();
  if (bytes.byteLength > MAX_BODY_BYTES) throw tooLarge();
  if (bytes.byteLength === 0) return {};

  const text = new TextDecoder().decode(bytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new TapServerError(
      SERVER_ERROR_CODES.BODY_INVALID,
      'The request body was not JSON. Do not parse or re-encode the body before handing the Request to createTappifyHandler().',
      400,
    );
  }
}

/**
 * The route table holds handlers whose declared input and event types the
 * manifest augmentations narrow. Method syntax keeps the parameter bivariant,
 * so a narrowed handler still fits a table the wire types as `unknown`.
 */
type AnyRouteHandler = {
  route(request: TappifyRequest<unknown, unknown>): unknown;
}['route'];

interface Route {
  handler: AnyRouteHandler | undefined;
  input: unknown;
  event: unknown;
  noContent: boolean;
}

function route(
  handler: AnyRouteHandler | undefined,
  input: unknown,
  event?: unknown,
  noContent = false,
): Route {
  return { handler, input, event, noContent };
}

function handlerFor(
  map: Partial<Record<string, AnyRouteHandler>> | undefined,
  name: string,
): AnyRouteHandler | undefined {
  return map?.[name];
}

function resolveRoute(
  options: TappifyHandlerOptions,
  method: string,
  segments: string[],
  url: URL,
  payload: unknown,
): Route | null {
  const [head, name] = segments;
  const bodyInput = readUnknown(payload, 'input') ?? {};

  if (head === 'metrics' && method === 'POST') {
    return route(options.metrics, bodyInput);
  }
  if (head === 'tools' && method === 'POST' && name !== undefined) {
    return route(handlerFor(options.tools, name), bodyInput);
  }
  if (head === 'mentions' && method === 'GET' && name !== undefined) {
    return route(handlerFor(options.mentions, name), {
      q: url.searchParams.get('q') ?? '',
    });
  }
  if (head === 'actions' && method === 'POST' && name !== undefined) {
    return route(handlerFor(options.actions, name), bodyInput);
  }
  if (head === 'procedures' && method === 'POST' && name !== undefined) {
    return route(handlerFor(options.procedures, name), bodyInput);
  }
  if (head === 'context' && method === 'GET' && name !== undefined) {
    return route(handlerFor(options.context, name), undefined);
  }
  if (head === 'work' && method === 'POST' && name !== undefined) {
    const operation = WORK_OPERATIONS.find(candidate => candidate === name);
    return route(
      operation === undefined ? undefined : options.work?.[operation],
      bodyInput,
    );
  }
  if (head === 'events' && method === 'POST') {
    const envelope = readRecord(payload, 'event');
    const eventName = readText(envelope, 'name');
    if (eventName === null) {
      throw new TapServerError(
        SERVER_ERROR_CODES.BODY_INVALID,
        'The events body has no event.name. Post the envelope Tappify sends unchanged, with the event name under "event".',
        400,
      );
    }
    const declared = EVENTS.find(candidate => candidate === eventName);
    return route(
      declared === undefined ? undefined : options.events?.[declared],
      undefined,
      readUnknown(envelope, 'payload') ?? {},
      true,
    );
  }

  return null;
}

/**
 * Builds the one `fetch` handler that answers every route Tappify calls on your
 * server.
 *
 * @remarks
 * It routes the paths under `/tappify`, minus `basePath` when your framework mounts
 * it under a prefix, and hands each matched handler a `TappifyRequest`. Every
 * route but `GET /tappify/health` needs a bearer install token, which it verifies
 * with `verifyTappifyToken`, and an `X-Tappify-Event-Id` header; a missing token is
 * 401 `TAP_TOKEN_MISSING`, a missing id 400 `TAP_EVENT_ID_MISSING`, an unknown path
 * 404 `TAP_ROUTE_UNKNOWN` and a declared name with no handler 404
 * `TAP_HANDLER_MISSING`. A body that is not JSON is 400 `TAP_BODY_INVALID` and one
 * over 1 MB is 413 `TAP_BODY_TOO_LARGE`. A `TapServerError` a handler throws is
 * answered with its own code and status, and a `TapError` other than the two token
 * failures with its own code and 400; anything else becomes 500
 * `TAP_INTERNAL_ERROR` with a fixed message, so an internal failure never reaches
 * the owner. An events route answers 204 with no body, and every other route
 * answers the handler's return value as JSON. Export the options object as well as
 * the handler: `createTestClient` takes the options.
 *
 * @example
 * ```ts
 * import {
 *   createTappifyHandler,
 *   type TappifyHandlerOptions,
 * } from '@tappify/extension-sdk/server';
 *
 * const handlerOptions: TappifyHandlerOptions = {
 *   extensionId: 'starter',
 *   health: () => ({ ok: true, version: '0.1.0' }),
 *   procedures: {
 *     getSummary: () => ({ installs: 1260, delta: 0.087, topKeyword: 'photo editor' }),
 *   },
 * };
 *
 * const handler = createTappifyHandler(handlerOptions);
 * ```
 */
export function createTappifyHandler(
  options: TappifyHandlerOptions,
): TappifyFetchHandler {
  const basePath = options.basePath ?? '';

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.startsWith(basePath)
      ? url.pathname.slice(basePath.length)
      : url.pathname;

    const segments = path.split('/').filter(segment => segment !== '');
    if (segments[0] !== 'tappify') {
      return failure(
        SERVER_ERROR_CODES.ROUTE_UNKNOWN,
        `Nothing is mounted at ${path}. Tappify calls paths under /tappify; set basePath if your framework mounts the handler under a prefix.`,
        404,
      );
    }

    const rest = segments.slice(1);

    if (rest[0] === 'health' && request.method === 'GET') {
      const health: TappifyHealth = options.health
        ? await options.health()
        : { ok: true };
      return json(health);
    }

    const authorization = request.headers.get('authorization') ?? '';
    const token = authorization.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length)
      : '';

    if (token === '') {
      return failure(
        SERVER_ERROR_CODES.TOKEN_MISSING,
        'This route needs an install token. Tappify sends it as Authorization: Bearer <token>; forward the header unchanged from your framework.',
        401,
      );
    }

    const eventId = request.headers.get('x-tappify-event-id');
    if (eventId === null || eventId === '') {
      return failure(
        SERVER_ERROR_CODES.EVENT_ID_MISSING,
        'Every Tappify call carries X-Tappify-Event-Id for idempotency. Forward the header unchanged, and use it as the key when you deduplicate.',
        400,
      );
    }

    try {
      const claims = await verifyTappifyToken(token, {
        extensionId: options.extensionId,
        jwksUrl: options.jwksUrl,
        jwks: options.jwks,
      });

      const payload = await readBody(request);
      const matched = resolveRoute(options, request.method, rest, url, payload);

      if (matched === null) {
        return failure(
          SERVER_ERROR_CODES.ROUTE_UNKNOWN,
          `Tappify has no ${request.method} ${path} route. The paths it calls are listed under "Vendor server endpoints" in the reference; check the method and the spelling.`,
          404,
        );
      }

      if (matched.handler === undefined) {
        return failure(
          SERVER_ERROR_CODES.HANDLER_MISSING,
          `No handler is registered for ${request.method} ${path}. Add it to createTappifyHandler(), or remove the contribution from tappify.extension.json.`,
          404,
        );
      }

      const documents = readRecord(payload, 'documents');

      const typed: TappifyRequest<unknown, unknown> = {
        install: toInstall(payload, claims),
        context: toContext(payload),
        input: matched.input,
        credentials: toCredentials(payload),
        documents: documents as TappifyDocuments,
        event: matched.event,
        eventId,
        claims,
        request,
      };

      const result = await matched.handler(typed);
      return matched.noContent
        ? new Response(null, { status: 204 })
        : json(result);
    } catch (error) {
      if (TapServerError.is(error)) {
        return wireError(error.code, error.message, error.status ?? 400);
      }
      if (TapError.is(error)) {
        const tokenFailure = TOKEN_FAILURES.find(
          candidate => candidate === error.code,
        );
        if (tokenFailure !== undefined) {
          return failure(tokenFailure, error.message, 401);
        }
        return wireError(error.code, error.message, 400);
      }
      return failure(SERVER_ERROR_CODES.INTERNAL_ERROR, INTERNAL_MESSAGE, 500);
    }
  };
}

export type {
  ContextBlock,
  MentionItems,
  MetricsInput,
  MetricsResponse,
  TappifyClaims,
};
