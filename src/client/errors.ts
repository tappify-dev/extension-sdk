/** Every code a `TapError` the SDK raises carries. */
export type TapErrorCode =
  | 'TAP_OUTSIDE_HOST'
  | 'TAP_SCOPE_MISSING'
  | 'TAP_UNKNOWN_COLLECTION'
  | 'TAP_UNKNOWN_PROCEDURE'
  | 'TAP_NO_PORTAL'
  | 'TAP_NO_QUERY_CLIENT'
  | 'TAP_MANIFEST_INVALID'
  | 'TAP_ENTRY_MISSING'
  | 'TAP_STYLES_UNRESOLVED'
  | 'TAP_SCHEMA_UNRESOLVED'
  | 'TAP_TOKEN_MISSING'
  | 'TAP_TOKEN_INVALID'
  | 'TAP_TOKEN_AUDIENCE'
  | 'TAP_EVENT_ID_MISSING'
  | 'TAP_BODY_INVALID'
  | 'TAP_BODY_TOO_LARGE'
  | 'TAP_ROUTE_UNKNOWN'
  | 'TAP_HANDLER_MISSING'
  | 'TAP_INTERNAL_ERROR'
  | 'TAP_WEBHOOK_REJECTED'
  | 'TAP_TEST_TARGET_INVALID';

/**
 * The same codes as `TapErrorCode`, as an array to iterate or check membership
 * against at runtime.
 */
export const TAP_ERROR_CODES: readonly TapErrorCode[] = [
  'TAP_OUTSIDE_HOST',
  'TAP_SCOPE_MISSING',
  'TAP_UNKNOWN_COLLECTION',
  'TAP_UNKNOWN_PROCEDURE',
  'TAP_NO_PORTAL',
  'TAP_NO_QUERY_CLIENT',
  'TAP_MANIFEST_INVALID',
  'TAP_ENTRY_MISSING',
  'TAP_STYLES_UNRESOLVED',
  'TAP_SCHEMA_UNRESOLVED',
  'TAP_TOKEN_MISSING',
  'TAP_TOKEN_INVALID',
  'TAP_TOKEN_AUDIENCE',
  'TAP_EVENT_ID_MISSING',
  'TAP_BODY_INVALID',
  'TAP_BODY_TOO_LARGE',
  'TAP_ROUTE_UNKNOWN',
  'TAP_HANDLER_MISSING',
  'TAP_INTERNAL_ERROR',
  'TAP_WEBHOOK_REJECTED',
  'TAP_TEST_TARGET_INVALID',
];

const CODE_SET = new Set<string>(TAP_ERROR_CODES);

/**
 * The error the SDK and the host raise when a call cannot be served at all.
 *
 * @remarks
 * The SDK throws it for a mount outside the host (`TAP_OUTSIDE_HOST`), a
 * collection or procedure the manifest does not declare
 * (`TAP_UNKNOWN_COLLECTION`, `TAP_UNKNOWN_PROCEDURE`), a missing portal or query
 * client, a token the server rejected, and a misused testing helper. The host
 * turns a refused read or write into `TAP_SCOPE_MISSING`. Branch on `code`, which
 * is stable; the message is prose and changes. An error your own server raised is
 * a `TapServerError` instead.
 *
 * @example
 * ```tsx
 * import { TapError, TapErrorState, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Revenue() {
 *   const revenue = useTapQuery({
 *     kind: 'revenue',
 *     range: { from: '2026-09-01', to: '2026-09-08' },
 *   });
 *   if (TapError.is(revenue.error) && revenue.error.code === 'TAP_SCOPE_MISSING') {
 *     return <TapErrorState title="Revenue is not shared with this extension" />;
 *   }
 *   return <span>{revenue.data?.mrr ?? 0}</span>;
 * }
 * ```
 */
export class TapError extends Error {
  readonly code: TapErrorCode;

  constructor(code: TapErrorCode, message: string) {
    super(message);
    this.name = 'TapError';
    this.code = code;
  }

  /**
   * Narrows an unknown value to a `TapError`, by name and by a code it
   * recognises, so it holds across module instances.
   */
  static is(value: unknown): value is TapError {
    return (
      value instanceof Error &&
      value.name === 'TapError' &&
      'code' in value &&
      typeof value.code === 'string' &&
      CODE_SET.has(value.code)
    );
  }
}

/**
 * The error a vendor server throws to answer a Tappify call with a code and a
 * message the owner sees.
 *
 * @remarks
 * `createTappifyHandler` catches it and answers `{ error: { code, message } }`
 * with `status`, or 400 when no status was given; the host relays both to the
 * calling mount, where they arrive as the `error` of `useTapServer`. Pick a code
 * of your own and keep it stable — the SDK's own codes are `SERVER_ERROR_CODES` —
 * and write the message for the owner, who reads it on screen.
 *
 * @example
 * ```ts
 * import { TapServerError } from '@tappify/extension-sdk/server';
 *
 * function assertRange(days: number) {
 *   if (days > 0) return;
 *   throw new TapServerError(
 *     'RANGE_TOO_SHORT',
 *     'getSummary needs a range of at least one day. Widen the date picker, then retry.',
 *     400,
 *   );
 * }
 * ```
 */
export class TapServerError extends Error {
  readonly code: string;
  readonly status: number | undefined;

  constructor(code: string, message: string, status?: number) {
    super(message);
    this.name = 'TapServerError';
    this.code = code;
    this.status = status;
  }

  /** The wire body the handler answers with, without the status. */
  toJSON(): { error: { code: string; message: string } } {
    return { error: { code: this.code, message: this.message } };
  }

  /**
   * Narrows an unknown value to a `TapServerError` by name and by carrying a
   * string `code`, so it holds across module instances.
   */
  static is(value: unknown): value is TapServerError {
    return (
      value instanceof Error &&
      value.name === 'TapServerError' &&
      'code' in value &&
      typeof value.code === 'string'
    );
  }
}
