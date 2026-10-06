import type { TapErrorCode } from '../client/errors';

/**
 * The codes `createTappifyHandler` answers with itself, keyed by a short name.
 *
 * @remarks
 * Every one of these comes from the SDK, not from your own handlers: a route or
 * handler that is not there, a token that is missing or does not verify, a missing
 * event id, a body that is not JSON or is over 1 MB, a webhook Tappify rejected,
 * and the catch-all for an error a handler let escape. Throw a `TapServerError`
 * with a code of your own for anything your server decides.
 */
export const SERVER_ERROR_CODES = {
  ROUTE_UNKNOWN: 'TAP_ROUTE_UNKNOWN',
  HANDLER_MISSING: 'TAP_HANDLER_MISSING',
  INTERNAL_ERROR: 'TAP_INTERNAL_ERROR',
  TOKEN_MISSING: 'TAP_TOKEN_MISSING',
  TOKEN_INVALID: 'TAP_TOKEN_INVALID',
  TOKEN_AUDIENCE: 'TAP_TOKEN_AUDIENCE',
  EVENT_ID_MISSING: 'TAP_EVENT_ID_MISSING',
  BODY_INVALID: 'TAP_BODY_INVALID',
  BODY_TOO_LARGE: 'TAP_BODY_TOO_LARGE',
  WEBHOOK_REJECTED: 'TAP_WEBHOOK_REJECTED',
} as const satisfies Record<string, TapErrorCode>;

/** Every code the handler answers with itself, as a union of its own values. */
export type TapServerErrorCode =
  (typeof SERVER_ERROR_CODES)[keyof typeof SERVER_ERROR_CODES];
