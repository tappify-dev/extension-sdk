import { ADS_SHARED_METRICS } from '../manifest/constants';
import type { AdsAcquisition } from '../manifest/types';

const DECIMAL = /^\d+(\.\d+)?$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = ['active', 'paused', 'removed'];

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function named(level: string): string {
  return `${/^[aeiou]/.test(level) ? 'an' : 'a'} ${level}`;
}

function amountIssue(path: string, value: unknown): string | null {
  if (typeof value === 'string' && DECIMAL.test(value)) {
    return null;
  }

  const found =
    value === undefined
      ? 'missing'
      : typeof value === 'string'
        ? `"${value}"`
        : named(typeof value);
  return `${path} is ${found}. Amounts are decimal strings such as "12.50".`;
}

function countIssue(path: string, value: unknown): string | null {
  return typeof value === 'number' && Number.isFinite(value)
    ? null
    : `${path} is not a number. Counts are JSON numbers such as 120.`;
}

/**
 * Checks a sync answer against the levels and numbers the manifest declares under
 * `acquisition`, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ items: [...], rows: [...] }`; an item on a
 * level the manifest does not declare, an item returned twice, an item below
 * campaign with no `parentId` or with a parent that is not in `items`, a status
 * other than `active`, `paused` or `removed`, and a budget or bid amount that is
 * not a decimal string; a row whose item is not in `items`, a date that is not
 * `YYYY-MM-DD` or is outside the window, a shared or extra number the manifest
 * does not declare, a count that is not a number, and `spend` that is not a
 * decimal string. Item problems come first, then row problems, each
 * in the order the answer lists them. Pass the window the call was made with: both
 * ends are included.
 *
 * @example
 * ```ts
 * import { validateAdsSyncResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * const acquisition = {
 *   levels: [{ level: 'campaign' as const, label: 'Campaign' }],
 *   metrics: [{ key: 'spend' as const, definition: 'Amount billed for the day.' }],
 * };
 *
 * it('answers a sync with a campaign and its daily spend', () => {
 *   const response = {
 *     items: [{ level: 'campaign', id: 'c1', name: 'Launch', status: 'active' }],
 *     rows: [{ level: 'campaign', itemId: 'c1', date: '2026-11-01', spend: '12.50' }],
 *   };
 *   const window = { start: '2026-11-01', end: '2026-11-02' };
 *   expect(validateAdsSyncResponse(response, acquisition, window)).toEqual([]);
 * });
 * ```
 */
export function validateAdsSyncResponse(
  response: unknown,
  acquisition: AdsAcquisition,
  window: { start: string; end: string },
): string[] {
  const body = record(response);
  const items = list(body?.items);
  const rows = list(body?.rows);

  if (items === null || rows === null) {
    return [
      'A sync answer is { "items": [...], "rows": [...] }. Return both, empty when there is nothing to report.',
    ];
  }

  const issues: string[] = [];
  const levels = new Set<string>(acquisition.levels.map(entry => entry.level));
  const metrics = new Set<string>(
    acquisition.metrics.map(metric => metric.key),
  );
  const extras = new Set(
    (acquisition.extraMetrics ?? []).map(metric => metric.key),
  );
  const returned = new Set<string>();
  const ids = new Set(items.map(entry => String(record(entry)?.id)));

  for (const [index, entry] of items.entries()) {
    const item = record(entry) ?? {};
    const at = `items[${String(index)}]`;
    const level = String(item.level);
    const id = String(item.id);
    const repeated = returned.has(`${level} ${id}`);
    returned.add(`${level} ${id}`);

    if (!levels.has(level)) {
      issues.push(
        `${at} is ${named(level)}, which this extension does not declare. Add the level to acquisition.levels or leave the item out.`,
      );
      continue;
    }

    if (repeated) {
      issues.push(`${at} repeats ${level} "${id}". Return each item once.`);
    }

    if (level !== 'campaign') {
      if (typeof item.parentId !== 'string' || item.parentId === '') {
        issues.push(
          `${at} is ${named(level)} with no parentId. Every level below campaign names its parent.`,
        );
      } else if (!ids.has(item.parentId)) {
        issues.push(
          `${at} names parent "${item.parentId}", which is not in items. Return a parent in the same answer as its children.`,
        );
      }
    }

    if (typeof item.status !== 'string' || !STATUSES.includes(item.status)) {
      issues.push(
        `${at} has status "${String(item.status)}". Use active, paused or removed, and put the network's own word in networkStatus.`,
      );
    }

    for (const key of ['budget', 'bid']) {
      if (item[key] === undefined) {
        continue;
      }
      const issue = amountIssue(
        `${at}.${key}.amount`,
        record(item[key])?.amount,
      );
      if (issue !== null) {
        issues.push(issue);
      }
    }
  }

  for (const [index, entry] of rows.entries()) {
    const row = record(entry) ?? {};
    const at = `rows[${String(index)}]`;
    const level = String(row.level);
    const itemId = String(row.itemId);
    const date = String(row.date);

    if (!returned.has(`${level} ${itemId}`)) {
      issues.push(
        `${at} names ${level} "${itemId}", which is not in items. Return the item in the same answer as its rows.`,
      );
    }

    if (!DAY.test(date)) {
      issues.push(
        `${at} is dated "${date}". Dates are YYYY-MM-DD in the account's time zone.`,
      );
    } else if (date < window.start || date > window.end) {
      issues.push(
        `${at} is dated ${date}, outside the window ${window.start} to ${window.end}.`,
      );
    }

    for (const key of ADS_SHARED_METRICS) {
      if (row[key] === undefined) {
        continue;
      }
      if (!metrics.has(key)) {
        issues.push(
          `${at} reports ${key}, which this extension does not declare under acquisition.metrics.`,
        );
        continue;
      }
      const issue =
        key === 'spend'
          ? amountIssue(`${at}.spend`, row.spend)
          : countIssue(`${at}.${key}`, row[key]);
      if (issue !== null) {
        issues.push(issue);
      }
    }

    for (const [key, value] of Object.entries(record(row.extra) ?? {})) {
      if (!extras.has(key)) {
        issues.push(
          `${at} reports the extra number "${key}", which is not under acquisition.extraMetrics.`,
        );
        continue;
      }
      const issue = countIssue(`${at}.extra.${key}`, value);
      if (issue !== null) {
        issues.push(issue);
      }
    }
  }

  return issues;
}
