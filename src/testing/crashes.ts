import { found, list, record, textIssue } from './answers';

const PLATFORMS = ['ios', 'android'];
const TRENDS = ['up', 'down', 'stable'];
const INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function countIssue(path: string, value: unknown): string | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? null
    : `${path} is ${found(value)}. Counts are whole numbers from 0, such as 120.`;
}

function instantIssue(path: string, value: unknown): string | null {
  if (
    value === null ||
    (typeof value === 'string' &&
      INSTANT.test(value) &&
      !Number.isNaN(Date.parse(value)))
  ) {
    return null;
  }
  return `${path} is ${found(value)}. Use null or an ISO 8601 instant such as "2026-11-01T09:30:00Z".`;
}

/**
 * Checks a crash groups answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ groups: [...] }`; then, for each group in
 * the order the answer lists them, an entry that is not an object, an `externalId`
 * or `signature` that is not a non-empty string, a `platform` other than `ios`,
 * `android` or `null`, an `affectedUsers` or `affectedSessions` that is not a
 * whole number from 0, a `trend` other than `up`, `down` or `stable`, a
 * `firstSeen` or `lastSeen` that is neither `null` nor an ISO 8601 instant, a
 * `versionFirstSeen` that is neither a string nor `null`, and an `externalId`
 * returned twice.
 *
 * @example
 * ```ts
 * import { validateCrashGroupsResult } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers the crash groups the reporter holds', () => {
 *   const body = {
 *     groups: [
 *       {
 *         externalId: 'SENTRY-1',
 *         signature: 'EXC_BAD_ACCESS in renderFrame',
 *         platform: 'ios',
 *         affectedUsers: 12,
 *         affectedSessions: 30,
 *         trend: 'up',
 *         firstSeen: '2026-11-01T09:30:00Z',
 *         lastSeen: null,
 *         versionFirstSeen: '2.4.0',
 *       },
 *     ],
 *   };
 *   expect(validateCrashGroupsResult(body)).toEqual([]);
 * });
 * ```
 */
export function validateCrashGroupsResult(result: unknown): string[] {
  const groups = list(record(result)?.groups);

  if (groups === null) {
    return [
      'A crash groups answer is { "groups": [...] }. Return the array, empty when there are no crash groups.',
    ];
  }

  const issues: string[] = [];
  const returned = new Set<string>();

  for (const [index, entry] of groups.entries()) {
    const group = record(entry);
    const at = `groups[${String(index)}]`;

    if (group === null) {
      issues.push(
        `${at} is not an object. A crash group is { "externalId": "...", "signature": "...", ... }.`,
      );
      continue;
    }

    const checks = [
      textIssue(
        `${at}.externalId`,
        group.externalId,
        "Use your crash reporter's own id for the group, a non-empty string.",
      ),
      textIssue(
        `${at}.signature`,
        group.signature,
        'A signature is a non-empty string such as "EXC_BAD_ACCESS in renderFrame".',
      ),
      group.platform === null ||
      (typeof group.platform === 'string' && PLATFORMS.includes(group.platform))
        ? null
        : `${at}.platform is ${found(group.platform)}. Use ios, android or null.`,
      countIssue(`${at}.affectedUsers`, group.affectedUsers),
      countIssue(`${at}.affectedSessions`, group.affectedSessions),
      typeof group.trend === 'string' && TRENDS.includes(group.trend)
        ? null
        : `${at}.trend is ${found(group.trend)}. Use up, down or stable.`,
      instantIssue(`${at}.firstSeen`, group.firstSeen),
      instantIssue(`${at}.lastSeen`, group.lastSeen),
      group.versionFirstSeen === null ||
      typeof group.versionFirstSeen === 'string'
        ? null
        : `${at}.versionFirstSeen is ${found(group.versionFirstSeen)}. Use the app version as a string, such as "2.4.0", or null.`,
    ];
    for (const issue of checks) {
      if (issue !== null) {
        issues.push(issue);
      }
    }

    const externalId = group.externalId;
    if (typeof externalId === 'string' && externalId !== '') {
      if (returned.has(externalId)) {
        issues.push(`${at} repeats "${externalId}". Return each group once.`);
      }
      returned.add(externalId);
    }
  }

  return issues;
}

/**
 * Checks a crash details answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not an object; an `externalId` that is not a
 * non-empty string; a `stackTrace`, `release` or `environment` that is neither a
 * string nor `null`; `breadcrumbs` that is not an array; and, for each breadcrumb
 * in order, an entry that is not an object or that has no string `category`,
 * `message` or `level`.
 *
 * @example
 * ```ts
 * import { validateCrashDetails } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers one crash group with its stack trace', () => {
 *   const body = {
 *     externalId: 'SENTRY-1',
 *     stackTrace: '0 App 0x1 renderFrame + 12',
 *     breadcrumbs: [{ category: 'navigation', message: 'Opened Checkout', level: 'info' }],
 *     release: '2.4.0 (310)',
 *     environment: 'production',
 *   };
 *   expect(validateCrashDetails(body)).toEqual([]);
 * });
 * ```
 */
export function validateCrashDetails(result: unknown): string[] {
  const details = record(result);

  if (details === null) {
    return [
      'A crash details answer is { "externalId": "...", "stackTrace": ..., "breadcrumbs": [...], "release": ..., "environment": ... }.',
    ];
  }

  const issues: string[] = [];
  const externalIdIssue = textIssue(
    'externalId',
    details.externalId,
    'Answer with the externalId the call asked for.',
  );
  if (externalIdIssue !== null) {
    issues.push(externalIdIssue);
  }

  for (const key of ['stackTrace', 'release', 'environment']) {
    const value = details[key];
    if (value !== null && typeof value !== 'string') {
      issues.push(`${key} is ${found(value)}. Use a string or null.`);
    }
  }

  const breadcrumbs = list(details.breadcrumbs);
  if (breadcrumbs === null) {
    issues.push(
      `breadcrumbs is ${found(details.breadcrumbs)}. Return the array, empty when the crash has no breadcrumbs.`,
    );
    return issues;
  }

  for (const [index, entry] of breadcrumbs.entries()) {
    const breadcrumb = record(entry);
    const at = `breadcrumbs[${String(index)}]`;

    if (breadcrumb === null) {
      issues.push(
        `${at} is not an object. A breadcrumb is { "category": "...", "message": "...", "level": "..." }.`,
      );
      continue;
    }

    for (const key of ['category', 'message', 'level']) {
      if (typeof breadcrumb[key] !== 'string') {
        issues.push(
          `${at}.${key} is ${found(breadcrumb[key])}. Each breadcrumb has a string category, message and level.`,
        );
      }
    }
  }

  return issues;
}
