import { found, list, record, textIssue } from './answers';

const MAX_OPTIONS = 500;
const MAX_CONFIG_BYTES = 16_384;

function lengthIssue(path: string, value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length > max
    ? `${path} is ${String(value.length)} characters. Use at most ${String(max)}.`
    : null;
}

function configBytesIssue(
  config: Record<string, unknown> | null,
): string | null {
  if (config === null) {
    return null;
  }
  const bytes = new TextEncoder().encode(JSON.stringify(config)).length;
  return bytes > MAX_CONFIG_BYTES
    ? `destination.config is ${String(bytes)} bytes. Keep it under ${String(MAX_CONFIG_BYTES)}; store only what posting needs.`
    : null;
}

/**
 * Checks a chat connect answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ destination: {...} }`; a
 * `destination.externalId` or `destination.label` that is not a non-empty
 * string; a `destination.url` that is present and not an `https://` link; a
 * `destination.config` that is not an object; and the limits Tappify enforces:
 * `externalId` over 255 characters, `label` over 200, `url` over 2048, and
 * `config` over 16384 bytes as JSON.
 *
 * @example
 * ```ts
 * import { validateChatConnectResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers the channel the owner connected', () => {
 *   const body = {
 *     destination: {
 *       externalId: 'T024BE7LD:C024BE91L',
 *       label: '#releases',
 *       url: 'https://app.slack.com/client/T024BE7LD/C024BE91L',
 *       config: { channel: 'C024BE91L' },
 *     },
 *   };
 *   expect(validateChatConnectResponse(body)).toEqual([]);
 * });
 * ```
 */
export function validateChatConnectResponse(body: unknown): string[] {
  const destination = record(record(body)?.destination);

  if (destination === null) {
    return [
      'A connect answer is { "destination": { "externalId": "...", "label": "...", "config": {...} } }.',
    ];
  }

  const checks = [
    textIssue(
      'destination.externalId',
      destination.externalId,
      'Use the chat tool\'s own id for the channel, such as "T024BE7LD:C024BE91L".',
    ),
    lengthIssue('destination.externalId', destination.externalId, 255),
    textIssue(
      'destination.label',
      destination.label,
      'A label is the name owners know the channel by, such as "#releases".',
    ),
    lengthIssue('destination.label', destination.label, 200),
    destination.url === undefined ||
    (typeof destination.url === 'string' &&
      destination.url.startsWith('https://'))
      ? null
      : `destination.url is ${found(destination.url)}. Use an https link to the channel, or leave it out.`,
    lengthIssue('destination.url', destination.url, 2048),
    record(destination.config) === null
      ? `destination.config is ${found(destination.config)}. Return an object with what your server needs to post to this channel; Tappify stores it encrypted and sends it back on every call.`
      : null,
    configBytesIssue(record(destination.config)),
  ];

  return checks.filter((issue): issue is string => issue !== null);
}

/**
 * Checks a chat destinations answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ options: [...] }`, and more than 500
 * options, the most Tappify accepts; then, for each option
 * in the order the answer lists them, an entry that is not an object, an `id` or
 * `label` that is not a non-empty string, a `group` that is present and not a
 * non-empty string, and an `id` returned twice.
 *
 * @example
 * ```ts
 * import { validateChatDestinationsResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers the channels the owner can pick from', () => {
 *   const body = {
 *     options: [
 *       { id: 'T024BE7LD:C024BE91L', label: '#releases', group: 'Acme' },
 *       { id: 'T024BE7LD:C024BE92M', label: '#general' },
 *     ],
 *   };
 *   expect(validateChatDestinationsResponse(body)).toEqual([]);
 * });
 * ```
 */
export function validateChatDestinationsResponse(body: unknown): string[] {
  const options = list(record(body)?.options);

  if (options === null) {
    return [
      'A destinations answer is { "options": [...] }. Return the array, empty when the owner can reach no channel.',
    ];
  }

  const issues: string[] = [];
  if (options.length > MAX_OPTIONS) {
    issues.push(
      `The answer has ${String(options.length)} options. Return at most ${String(MAX_OPTIONS)}.`,
    );
  }
  const returned = new Set<string>();

  for (const [index, entry] of options.entries()) {
    const option = record(entry);
    const at = `options[${String(index)}]`;

    if (option === null) {
      issues.push(
        `${at} is not an object. An option is { "id": "...", "label": "..." }.`,
      );
      continue;
    }

    const checks = [
      textIssue(
        `${at}.id`,
        option.id,
        'Use the chat tool\'s own id for the channel, such as "T024BE7LD:C024BE91L".',
      ),
      textIssue(
        `${at}.label`,
        option.label,
        'A label is the name owners know the channel by, such as "#releases".',
      ),
      option.group === undefined
        ? null
        : textIssue(
            `${at}.group`,
            option.group,
            'Use the team or workspace name, or leave it out.',
          ),
    ];
    for (const issue of checks) {
      if (issue !== null) {
        issues.push(issue);
      }
    }

    const id = option.id;
    if (typeof id === 'string' && id !== '') {
      if (returned.has(id)) {
        issues.push(`${at} repeats "${id}". Return each channel once.`);
      }
      returned.add(id);
    }
  }

  return issues;
}

/**
 * Checks a chat message answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not an object, a `delivered` that is not
 * `true`, and a `reference` that is present and not a string or over 255
 * characters, the most Tappify accepts.
 *
 * @example
 * ```ts
 * import { validateChatMessageResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers once the message is posted', () => {
 *   const body = { delivered: true, reference: '1503435956.000247' };
 *   expect(validateChatMessageResponse(body)).toEqual([]);
 * });
 * ```
 */
export function validateChatMessageResponse(body: unknown): string[] {
  const answer = record(body);

  if (answer === null) {
    return ['A message answer is { "delivered": true }.'];
  }

  const issues: string[] = [];
  if (answer.delivered !== true) {
    issues.push(
      `delivered is ${found(answer.delivered)}. Answer { "delivered": true } only once the message is posted; when it cannot be, throw a TapServerError with status 422 and DESTINATION_GONE or PROVIDER_CREDENTIALS_REJECTED, or let the error reach the handler.`,
    );
  }
  if (answer.reference !== undefined && typeof answer.reference !== 'string') {
    issues.push(
      `reference is ${found(answer.reference)}. Use the chat tool's id for the posted message as a string, or leave it out.`,
    );
  }
  const tooLong = lengthIssue('reference', answer.reference, 255);
  if (tooLong !== null) {
    issues.push(tooLong);
  }
  return issues;
}

/**
 * Checks a chat disconnect answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not an object and an `ok` that is not `true`.
 *
 * @example
 * ```ts
 * import { validateChatDisconnectResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers once the channel is cleaned up', () => {
 *   expect(validateChatDisconnectResponse({ ok: true })).toEqual([]);
 * });
 * ```
 */
export function validateChatDisconnectResponse(body: unknown): string[] {
  const answer = record(body);

  if (answer === null) {
    return ['A disconnect answer is { "ok": true }.'];
  }

  return answer.ok === true
    ? []
    : [
        `ok is ${found(answer.ok)}. Answer { "ok": true } once the channel is cleaned up.`,
      ];
}
