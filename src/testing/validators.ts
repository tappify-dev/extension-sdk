import { CARD_KEYS } from '../manifest/constants';
import type { MetricDeclaration, ToolDeclaration } from '../manifest/types';

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function isPoint(value: unknown): boolean {
  const pair = list(value);
  return (
    pair !== null &&
    pair.length === 2 &&
    typeof pair[0] === 'string' &&
    typeof pair[1] === 'number'
  );
}

/**
 * Checks a metrics response against the metrics the manifest declares and returns
 * what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the response is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ series: [...] }`, an entry with no
 * `metric` key, a metric the declarations do not name, a unit that disagrees with
 * the declared one, a missing `points` array, and any point that is not a
 * `[string, number]` pair. It does not check that every declared metric is
 * answered, so assert on the length yourself when that matters. The strings are the
 * ones `tappify extension doctor` reports.
 *
 * @example
 * ```ts
 * import { validateMetricsResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * const metrics = [
 *   { key: 'orders', label: 'Orders', unit: 'count' as const, kind: 'counter' as const },
 * ];
 *
 * it('answers orders as a counted series', () => {
 *   const response = { series: [{ metric: 'orders', unit: 'count', points: [['2026-09-01', 12]] }] };
 *   expect(validateMetricsResponse(response, metrics)).toEqual([]);
 * });
 * ```
 */
export function validateMetricsResponse(
  response: unknown,
  metrics: MetricDeclaration[],
): string[] {
  const series = list(record(response)?.series);

  if (series === null) {
    return [
      'A metrics response is { "series": [...] }. Return one entry per declared metric, even when it has no points.',
    ];
  }

  const issues: string[] = [];
  const declared = new Map(metrics.map(metric => [metric.key, metric]));

  for (const [index, entry] of series.entries()) {
    const item = record(entry);
    const key = typeof item?.metric === 'string' ? item.metric : null;

    if (item === null || key === null) {
      issues.push(`series[${String(index)}] has no "metric" key.`);
      continue;
    }

    const metric = declared.get(key);
    if (metric === undefined) {
      issues.push(
        `series[${String(index)}] reports "${key}", which is not declared under contributes.connector.metrics.`,
      );
      continue;
    }

    if (item.unit !== metric.unit) {
      issues.push(
        `series[${String(index)}] reports unit "${String(item.unit)}" but "${key}" is declared as "${metric.unit}".`,
      );
    }

    const points = list(item.points);
    if (points === null) {
      issues.push(`series[${String(index)}] has no "points" array.`);
      continue;
    }

    for (const [pointIndex, point] of points.entries()) {
      if (!isPoint(point)) {
        issues.push(
          `series[${String(index)}].points[${String(pointIndex)}] must be a two-element [timestamp, value] pair: a string and a number.`,
        );
      }
    }
  }

  return issues;
}

/**
 * Checks a tool's answer against the card shape its declared `returns` kind has to
 * carry, and returns what is missing.
 *
 * @remarks
 * Returns an empty array when the answer is sound. A `value` card needs `label` and
 * `value`, a `series` card `label` and `points`, a `table` card `columns` and
 * `rows`, a `list` card `items`, and a `comparison` card `label`, `left` and
 * `right`; anything that is not an object is reported on its own. It checks the
 * keys are present, not what they hold, so an empty `rows` array passes.
 *
 * @example
 * ```ts
 * import { validateToolResponse } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers keyword_gaps with a table card', () => {
 *   const card = { columns: [{ key: 'term', label: 'Term' }], rows: [] };
 *   expect(validateToolResponse(card, 'table')).toEqual([]);
 * });
 * ```
 */
export function validateToolResponse(
  value: unknown,
  returns: ToolDeclaration['returns'],
): string[] {
  const body = record(value);
  if (body === null) {
    return [
      `A "${returns}" tool returns an object the host draws as a card, not ${typeof value}.`,
    ];
  }

  return CARD_KEYS[returns]
    .filter(key => !(key in body))
    .map(
      key =>
        `A "${returns}" tool response needs a "${key}" key; the host draws the card from it.`,
    );
}
