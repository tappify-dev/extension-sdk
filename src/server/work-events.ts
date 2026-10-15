import { TapServerError } from '../client/errors';
import { SERVER_ERROR_CODES } from './codes';
import { signWebhook } from './events';
import { readRecord, readText, readUnknown } from './wire';
import type { WorkHydratedEvent, WorkHydratedEventBase } from './work';

/** An opaque provider signal to hydrate using current install credentials. */
export interface WorkHydrationReferenceEvent extends WorkHydratedEventBase {
  type: WorkHydratedEvent['type'];
  /** A nonempty, short-lived reference resolved by the hydrate_event handler. */
  hydrateRef: string;
  /** Normalized comment content must not accompany a reference. */
  comment?: never;
  /** Normalized status content must not accompany a reference. */
  status?: never;
}

/** Complete normalized content or an opaque reference, with stable retry identity. */
export type WorkEvent =
  | (WorkHydratedEvent & { hydrateRef?: never })
  | WorkHydrationReferenceEvent;

/** Install-specific delivery values provisioned through work configure. */
export interface SendWorkEventOptions {
  /** The exact provisioned callback URL; no production default is supplied. */
  callbackUrl: string;
  /** The per-install work-event signing secret provisioned with the callback. */
  secret: string;
  /** A transport for tests or a proxy; defaults to global fetch. */
  fetch?: typeof fetch;
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validEvent(event: WorkEvent): boolean {
  const type = readText(event, 'type');
  if (
    !['comment.created', 'status.changed', 'item.deleted'].includes(type ?? '')
  )
    return false;
  if (
    !['externalItemId', 'providerEventId', 'occurredAt', 'dedupeKey'].every(
      key => nonempty(readUnknown(event, key)),
    )
  )
    return false;

  const reference = readUnknown(event, 'hydrateRef');
  const comment = readUnknown(event, 'comment');
  const status = readUnknown(event, 'status');
  if (reference !== undefined)
    return nonempty(reference) && comment === undefined && status === undefined;

  if (type === 'item.deleted')
    return comment === undefined && status === undefined;
  if (type === 'status.changed') {
    const normalized = readRecord(event, 'status');
    return (
      comment === undefined &&
      nonempty(normalized.id) &&
      nonempty(normalized.label) &&
      typeof normalized.stage === 'string' &&
      ['open', 'in_progress', 'done'].includes(normalized.stage)
    );
  }

  const normalized = readRecord(event, 'comment');
  const author = readRecord(normalized, 'author');
  return (
    status === undefined &&
    nonempty(normalized.externalCommentId) &&
    typeof normalized.body === 'string' &&
    nonempty(normalized.createdAt) &&
    nonempty(author.id) &&
    nonempty(author.displayName)
  );
}

/**
 * Sends one provider work event to the callback provisioned for this install.
 *
 * @remarks
 * Pass the callbackUrl and secret received through configure unchanged. The
 * event's required dedupeKey identifies the logical provider signal and must be
 * reused on retries. Complete normalized content and an opaque hydrateRef are
 * mutually exclusive. The exact serialized UTF-8 body is signed with HMAC-SHA-256.
 * This callback is independent of declared alert and banner webhooks.
 */
export async function sendWorkEvent(
  event: WorkEvent,
  options: SendWorkEventOptions,
): Promise<void> {
  if (!validEvent(event))
    throw new TypeError(
      'Invalid work event: provide complete normalized content or a nonempty hydrateRef, with routing and identity fields.',
    );
  if (!nonempty(options.callbackUrl))
    throw new TypeError(
      'A work event requires the callbackUrl provisioned through configure.',
    );

  const body = JSON.stringify(event);
  const signature = await signWebhook(options.secret, body);
  const response = await (options.fetch ?? fetch)(options.callbackUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tappify-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    let rejection: string | null = null;
    try {
      rejection = readText(readRecord(await response.json(), 'error'), 'code');
    } catch {
      // Proxies may return a non-JSON rejection body.
    }
    throw new TapServerError(
      SERVER_ERROR_CODES.WEBHOOK_REJECTED,
      `Tappify answered ${String(response.status)}${rejection === null ? '' : ` (${rejection})`} for work event ${event.type}. Check the callback URL and per-install work-event signing secret provisioned through configure.`,
      response.status,
    );
  }
}
