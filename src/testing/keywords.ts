import type { KeywordMetricsInput } from '../server/keywords';

const MAX_METRICS = 100;
const MAX_SUGGESTIONS = 50;
const MAX_KEYWORD_LENGTH = 100;

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function list(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

function scoreIssue(path: string, value: unknown): string | null {
  if (value === null) {
    return null;
  }
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  ) {
    return null;
  }

  const found =
    value === undefined
      ? 'missing'
      : typeof value === 'number'
        ? String(value)
        : JSON.stringify(value);
  return `${path} is ${found}. Use null or a number from 0 to 100.`;
}

/**
 * Checks a keyword metrics answer against the call it answers, and returns what is
 * wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ metrics: [...] }` and one with more than
 * 100 metrics; then, for each metric in the order the answer lists them, an entry
 * that is not an object, a `keyword` that is missing or not a string, a keyword
 * the call did not ask for, a keyword returned twice, and a `volume` or
 * `difficulty` that is not `null` or a finite number from 0 to 100. A keyword has
 * to be spelled exactly as the call asked for it: `Photo Editor` does not answer
 * `photo editor`. Answering for fewer keywords than the call asked for is sound:
 * leave out the ones the provider does not know.
 *
 * @example
 * ```ts
 * import { validateKeywordMetricsResult } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('answers volume and difficulty for the keywords asked', () => {
 *   const input = {
 *     platform: 'ios' as const,
 *     country: 'us',
 *     lang: 'en',
 *     keywords: ['photo editor', 'collage maker'],
 *   };
 *   const body = {
 *     metrics: [{ keyword: 'photo editor', volume: 62, difficulty: null }],
 *   };
 *   expect(validateKeywordMetricsResult(body, input)).toEqual([]);
 * });
 * ```
 */
export function validateKeywordMetricsResult(
  body: unknown,
  input: KeywordMetricsInput,
): string[] {
  const metrics = list(record(body)?.metrics);

  if (metrics === null) {
    return [
      'A metrics answer is { "metrics": [...] }. Return the array, empty when no keyword is known.',
    ];
  }
  if (metrics.length > MAX_METRICS) {
    return [
      `The answer has ${String(metrics.length)} metrics. Return at most ${String(MAX_METRICS)}.`,
    ];
  }

  const issues: string[] = [];
  const asked = new Set(input.keywords);
  const returned = new Set<string>();

  for (const [index, entry] of metrics.entries()) {
    const metric = record(entry);
    const at = `metrics[${String(index)}]`;

    if (metric === null) {
      issues.push(
        `${at} is not an object. A metric is { "keyword": "...", "volume": ..., "difficulty": ... }.`,
      );
      continue;
    }

    const keyword = metric.keyword;

    if (typeof keyword !== 'string') {
      issues.push(
        `${at}.keyword is ${keyword === undefined ? 'missing' : 'not a string'}. Name the keyword the numbers are for, spelled exactly as the call asked for it.`,
      );
    } else {
      if (!asked.has(keyword)) {
        issues.push(
          `${at} names "${keyword}", which is not in the keywords the call asked for. Answer only those.`,
        );
      } else if (returned.has(keyword)) {
        issues.push(`${at} repeats "${keyword}". Return each keyword once.`);
      }
      returned.add(keyword);
    }

    for (const key of ['volume', 'difficulty']) {
      const issue = scoreIssue(`${at}.${key}`, metric[key]);
      if (issue !== null) {
        issues.push(issue);
      }
    }
  }

  return issues;
}

/**
 * Checks a keyword suggestions answer, and returns what is wrong with it.
 *
 * @remarks
 * Returns an empty array when the answer is sound, so a test asserts on an empty
 * list. It reports a body that is not `{ suggestions: [...] }` and one with more
 * than 50 suggestions; then, for each suggestion in the order the answer lists
 * them, an entry that is not an object, a `keyword` that is not a non-empty string of at most 100 characters, a
 * keyword returned twice, and a `volume` or `difficulty` that is present and is
 * not `null` or a finite number from 0 to 100.
 *
 * @example
 * ```ts
 * import { validateKeywordSuggestionsResult } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('suggests keywords with the numbers it has', () => {
 *   const body = {
 *     suggestions: [{ keyword: 'photo collage' }, { keyword: 'picture editor', volume: 55 }],
 *   };
 *   expect(validateKeywordSuggestionsResult(body)).toEqual([]);
 * });
 * ```
 */
export function validateKeywordSuggestionsResult(body: unknown): string[] {
  const suggestions = list(record(body)?.suggestions);

  if (suggestions === null) {
    return [
      'A suggestions answer is { "suggestions": [...] }. Return the array, empty when there is nothing to suggest.',
    ];
  }
  if (suggestions.length > MAX_SUGGESTIONS) {
    return [
      `The answer has ${String(suggestions.length)} suggestions. Return at most ${String(MAX_SUGGESTIONS)}.`,
    ];
  }

  const issues: string[] = [];
  const returned = new Set<string>();
  const rule = `A keyword is a non-empty string of at most ${String(MAX_KEYWORD_LENGTH)} characters.`;

  for (const [index, entry] of suggestions.entries()) {
    const suggestion = record(entry);
    const at = `suggestions[${String(index)}]`;

    if (suggestion === null) {
      issues.push(
        `${at} is not an object. A suggestion is { "keyword": "..." }, with volume and difficulty when you have them.`,
      );
      continue;
    }

    const keyword = suggestion.keyword;

    if (typeof keyword !== 'string') {
      issues.push(`${at}.keyword is not a string. ${rule}`);
    } else if (keyword === '') {
      issues.push(`${at}.keyword is empty. ${rule}`);
    } else if (keyword.length > MAX_KEYWORD_LENGTH) {
      issues.push(
        `${at}.keyword is ${String(keyword.length)} characters long. ${rule}`,
      );
    } else {
      if (returned.has(keyword)) {
        issues.push(`${at} repeats "${keyword}". Return each keyword once.`);
      }
      returned.add(keyword);
    }

    for (const key of ['volume', 'difficulty']) {
      if (suggestion[key] === undefined) {
        continue;
      }
      const issue = scoreIssue(`${at}.${key}`, suggestion[key]);
      if (issue !== null) {
        issues.push(issue);
      }
    }
  }

  return issues;
}
