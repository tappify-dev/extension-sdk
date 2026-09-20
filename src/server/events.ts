import { TapServerError } from '../client/errors';
import type { WebhookName, WebhookPayload } from '../client/types';
import { SERVER_ERROR_CODES } from './codes';
import { readRecord, readText } from './wire';

/** The body `sendEvent` posts to Tappify, and the body the signature covers. */
export interface WebhookEnvelope {
  /** The declared webhook name. */
  event: string;
  /** The extension id the event came from. */
  source: string;
  /** When the event happened, as an ISO timestamp. */
  occurredAt: string;
  /** The build the event belongs to, when it belongs to one. */
  build?: string;
  /** The key Tappify deduplicates on, so a retry is not counted twice. */
  dedupeKey: string;
  payload: Record<string, unknown>;
}

/** The third argument of `sendEvent`. */
export interface SendEventOptions {
  /** Which install the event belongs to. */
  installId: string;
  extensionId: string;
  /** The inbound signing secret from the extension's Server page. */
  secret: string;
  /** A full url to post to, which replaces `baseUrl` and the built path. */
  endpoint?: string;
  /** The Tappify origin to build the path under. Defaults to production. */
  baseUrl?: string;
  /** Defaults to a fresh UUID, so give your own to make a retry idempotent. */
  dedupeKey?: string;
  build?: string;
  /** Defaults to now, in ISO form. */
  occurredAt?: string;
  /** A `fetch` of your own, for a test or a proxy. Defaults to the global one. */
  fetch?: typeof fetch;
}

const DEFAULT_BASE_URL = 'https://api.tappify.ai';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns the hex HMAC-SHA-256 of a raw body under a shared secret.
 *
 * @remarks
 * This is the value `sendEvent` sends as `X-Tappify-Signature`, computed over the
 * exact bytes of the body it posts. Call it directly only when you build the
 * request yourself, and sign the serialised string you send rather than
 * re-serialising the object, because a different key order is a different
 * signature. Uses Web Crypto, so it runs on Node, Cloudflare Workers and Vercel
 * alike.
 *
 * @example
 * ```ts
 * import { signWebhook } from '@tappify/extension-sdk/server';
 *
 * async function signed(body: string): Promise<Record<string, string>> {
 *   return { 'x-tappify-signature': await signWebhook('whsec_test', body) };
 * }
 * ```
 */
export async function signWebhook(
  secret: string,
  body: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return toHex(signature);
}

async function rejectionCode(response: Response): Promise<string | null> {
  try {
    const payload: unknown = await response.json();
    return readText(readRecord(payload, 'error'), 'code');
  } catch {
    return null;
  }
}

/**
 * Posts one of your declared webhook events to Tappify, signed with the install's
 * inbound secret.
 *
 * @remarks
 * The name and the payload are narrowed by the `TapWebhookMap` augmentation
 * `tappify extension types` writes. It builds the envelope, signs the serialised
 * body and posts it to the install's hook path under `baseUrl`, or to `endpoint`
 * when you give one. A response Tappify did not accept rejects with a
 * `TapServerError` whose `code` is always `TAP_WEBHOOK_REJECTED`, carrying the HTTP
 * status, and with Tappify's own code in the message text rather than in `code`;
 * the two usual causes are the wrong signing
 * secret and an event the manifest does not declare. Pass your own `dedupeKey` to
 * make a retry idempotent, because the default is a fresh UUID.
 *
 * @example
 * ```ts
 * import { sendEvent } from '@tappify/extension-sdk/server';
 *
 * async function reportAnomaly(installId: string, why: string): Promise<void> {
 *   await sendEvent('anomaly.detected', { why }, {
 *     installId,
 *     extensionId: 'starter',
 *     secret: process.env.TAPPIFY_INBOUND_SECRET ?? '',
 *     dedupeKey: `anomaly-${installId}-${why}`,
 *   });
 * }
 * ```
 */
export async function sendEvent<E extends WebhookName>(
  name: E,
  payload: WebhookPayload<E>,
  options: SendEventOptions,
): Promise<void> {
  const envelope: WebhookEnvelope = {
    event: name,
    source: options.extensionId,
    occurredAt: options.occurredAt ?? new Date().toISOString(),
    dedupeKey: options.dedupeKey ?? crypto.randomUUID(),
    payload: { ...payload },
  };

  if (options.build !== undefined) envelope.build = options.build;

  const body = JSON.stringify(envelope);
  const signature = await signWebhook(options.secret, body);
  const url =
    options.endpoint ??
    `${options.baseUrl ?? DEFAULT_BASE_URL}/api/v1/extensions/hooks/${options.extensionId}/${options.installId}`;

  const send = options.fetch ?? fetch;
  const response = await send(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-tappify-signature': signature,
    },
    body,
  });

  if (!response.ok) {
    const rejection = await rejectionCode(response);
    throw new TapServerError(
      SERVER_ERROR_CODES.WEBHOOK_REJECTED,
      `Tappify answered ${String(response.status)}${rejection === null ? '' : ` (${rejection})`} for ${name}. Check the inbound signing secret on the extension's Server page, and that the event is declared under contributes.webhooks.`,
      response.status,
    );
  }
}
