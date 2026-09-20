import type { JSONWebKeySet } from 'jose';
import type {
  ActionId,
  ActionInput,
  TapCredentialValues,
  TapFilters,
  TapHostEvents,
  TapPlatformFilter,
  TapProcedureInput,
  TapProcedureName,
  TapProcedureOutput,
  TapSettingsValues,
  ToolId,
  ToolInput,
} from '../client/types';

/** Which install made the call, as the token's claims name it. */
export interface TappifyInstall {
  /** The install id, which is the key to scope anything you store yourself by. */
  id: string;
  extensionId: string;
  /** `null` for an install on the workspace rather than one project. */
  projectId: string | null;
  organizationId: string;
}

/** The project and the filter bar the call was made from. */
export interface TappifyCallContext {
  projectId: string | null;
  /** The same value as `filters.platform`, hoisted for convenience. */
  platform: TapPlatformFilter;
  /** The range start, as `YYYY-MM-DD`, or an empty string when none was sent. */
  from: string;
  /** The range end, as `YYYY-MM-DD`, or an empty string when none was sent. */
  to: string;
  filters: TapFilters;
}

/**
 * The install- and organization-scoped storage documents Tappify passes to the
 * server on every call, keyed by collection name.
 */
export type TappifyDocuments = Record<string, unknown> & {
  /** The settings contribution's document, or `null` before it is first saved. */
  settings?: TapSettingsValues | null;
};

/** The verified claims of an install token, as `verifyTappifyToken` returns them. */
export interface TappifyClaims {
  iss: string;
  /** Always `ext:<extensionId>`, which is what the verifier checked. */
  aud: string;
  exp: number;
  iat: number;
  installId: string;
  extensionId: string;
  projectId: string | null;
  organizationId: string;
  /** The scopes the install granted, as strings. */
  scopes: string[];
  /** Present when the token carries one, naming the teammate behind the call. */
  userId?: string;
}

/** The single argument every route handler receives. */
export interface TappifyRequest<TInput = unknown, TEvent = unknown> {
  install: TappifyInstall;
  context: TappifyCallContext;
  /**
   * The call's `input`, or `{}` when the body carried none, and `undefined` on a
   * context or events route, which take no input.
   */
  input: TInput;
  credentials: TapCredentialValues;
  documents: TappifyDocuments;
  /** The event payload on an events route, and `undefined` on every other. */
  event: TEvent | undefined;
  /** The idempotency key from `X-Tappify-Event-Id`; deduplicate writes on it. */
  eventId: string;
  claims: TappifyClaims;
  /** The original request, for a header or the raw body. */
  request: Request;
}

/**
 * The signature every entry in `TappifyHandlerOptions` has: one argument, and a
 * value or a promise of one.
 */
export type TappifyRouteHandler<
  TInput = unknown,
  TOutput = unknown,
  TEvent = unknown,
> = (request: TappifyRequest<TInput, TEvent>) => TOutput | Promise<TOutput>;

/** What the `GET /tappify/health` route answers with. */
export interface TappifyHealth {
  /** Whether the server is ready to take calls; the publish check reads it. */
  ok: boolean;
  version?: string;
  /** A line for the owner when the server is not ready. */
  message?: string;
}

/** What Tappify asks a connector's metrics route for. */
export interface MetricsInput {
  projectId: string | null;
  platform: TapPlatformFilter;
  /** The metric keys to answer for, from the ones the manifest declares. */
  metrics: string[];
  from: string;
  to: string;
}

/** One metric's answer inside a `MetricsResponse`. */
export interface MetricsSeries {
  /** The declared metric key this series answers for. */
  metric: string;
  /** Has to match the unit the manifest declares for that key. */
  unit: 'count' | 'ratio' | 'currency' | 'seconds' | 'bytes';
  /** One value per declared dimension, when the series is broken down. */
  dimensions?: Record<string, string>;
  /** `[timestamp, value]` pairs, oldest first. */
  points: [string, number][];
}

/** What a connector's metrics route answers with: one series per asked metric. */
export interface MetricsResponse {
  series: MetricsSeries[];
}

/** What a mention route answers with: the items the owner can pick from. */
export interface MentionItems {
  items: { id: string; label: string }[];
}

/** What a context route answers with, for the owner's chat to read. */
export interface ContextBlock {
  /** A line of prose the assistant can use as it is. */
  summary: string;
  /** The numbers behind the summary, for the assistant to quote. */
  data?: Record<string, unknown>;
}

/** The work-tracker operations a handler's `work` table can answer. */
export type WorkOperation =
  | 'list_containers'
  | 'create'
  | 'attach'
  | 'comment'
  | 'status'
  | 'resolve';

/** The second argument of `verifyTappifyToken`. */
export interface VerifyTokenOptions {
  /** The `id` from the manifest; the token's audience has to be `ext:<id>`. */
  extensionId: string;
  /** Where to fetch the signing keys. Defaults to `DEFAULT_JWKS_URL`. */
  jwksUrl?: string;
  /** A key set to verify against, which skips the fetch. For tests. */
  jwks?: JSONWebKeySet;
}

/**
 * The routes and settings `createTappifyHandler` builds a fetch handler from.
 *
 * @remarks
 * The `tools`, `actions` and `procedures` tables are keyed by the names the
 * augmentation `tappify extension types` writes, so a handler for an undeclared
 * name does not compile. `events` is keyed by Tappify's own event catalogue and
 * `work` by the fixed set of work operations; `mentions` and `context` take any id.
 * A route Tappify calls with no handler registered answers 404 with
 * `TAP_HANDLER_MISSING`. Export this object as well as the handler: the testing
 * entry's `createTestClient` takes the options, not the built handler.
 */
export interface TappifyHandlerOptions {
  /** The `id` from the manifest, which the install token's audience has to match. */
  extensionId: string;
  /** Where to fetch the signing keys. Defaults to `DEFAULT_JWKS_URL`. */
  jwksUrl?: string;
  /** A key set to verify against, which skips the fetch. For tests. */
  jwks?: JSONWebKeySet;
  /** The prefix your framework mounts the handler under, such as `/api`. */
  basePath?: string;
  /** Answers `GET /tappify/health`. Left out, the route answers `{ ok: true }`. */
  health?: () => TappifyHealth | Promise<TappifyHealth>;
  /** Answers `POST /tappify/metrics` for a connector contribution. */
  metrics?: TappifyRouteHandler<MetricsInput, MetricsResponse>;
  /** One handler per declared tool, answering `POST /tappify/tools/<id>`. */
  tools?: { [T in ToolId]?: TappifyRouteHandler<ToolInput<T>, unknown> };
  /** One handler per declared mention, answering `GET /tappify/mentions/<id>?q=`. */
  mentions?: Record<string, TappifyRouteHandler<{ q: string }, MentionItems>>;
  /** One handler per declared action, answering `POST /tappify/actions/<id>`. */
  actions?: { [A in ActionId]?: TappifyRouteHandler<ActionInput<A>, unknown> };
  /** One handler per declared procedure, which is what `useTapServer` calls. */
  procedures?: {
    [N in TapProcedureName]?: TappifyRouteHandler<
      TapProcedureInput<N>,
      TapProcedureOutput<N>
    >;
  };
  /** One handler per declared context block, answering `GET /tappify/context/<id>`. */
  context?: Record<string, TappifyRouteHandler<undefined, ContextBlock>>;
  /** One handler per Tappify event you subscribe to; each answers 204. */
  events?: {
    [E in keyof TapHostEvents]?: TappifyRouteHandler<
      undefined,
      void,
      TapHostEvents[E]
    >;
  };
  /** One handler per work operation, answering `POST /tappify/work/<operation>`. */
  work?: {
    [O in WorkOperation]?: TappifyRouteHandler<
      Record<string, unknown>,
      unknown
    >;
  };
}
