import { describe, expect, it } from 'vitest';
import type { KeywordMetricsInput } from '../../src/server';
import {
  validateKeywordMetricsResult,
  validateKeywordSuggestionsResult,
} from '../../src/testing';

const input: KeywordMetricsInput = {
  platform: 'ios',
  country: 'us',
  lang: 'en',
  keywords: ['photo editor', 'collage maker'],
};

const editor = { keyword: 'photo editor', volume: 62, difficulty: 48 };
const collage = { keyword: 'collage maker', volume: 31, difficulty: 20 };

function checkMetrics(body: unknown, asked = input): string[] {
  return validateKeywordMetricsResult(body, asked);
}

describe('validateKeywordMetricsResult', () => {
  it('accepts a sound answer', () => {
    expect(checkMetrics({ metrics: [editor, collage] })).toEqual([]);
  });

  it('names the body shape', () => {
    expect(checkMetrics({})).toEqual([
      'A metrics answer is { "metrics": [...] }. Return the array, empty when no keyword is known.',
    ]);
  });

  it('refuses more than 100 metrics', () => {
    const keywords = Array.from(
      { length: 101 },
      (_, index) => `kw ${String(index)}`,
    );
    const metrics = keywords.map(keyword => ({
      keyword,
      volume: 10,
      difficulty: 10,
    }));
    expect(checkMetrics({ metrics }, { ...input, keywords })).toEqual([
      'The answer has 101 metrics. Return at most 100.',
    ]);
  });

  it('refuses a volume above 100', () => {
    expect(checkMetrics({ metrics: [{ ...editor, volume: 101 }] })).toEqual([
      'metrics[0].volume is 101. Use null or a number from 0 to 100.',
    ]);
  });

  it('refuses a difficulty below 0', () => {
    expect(checkMetrics({ metrics: [{ ...editor, difficulty: -1 }] })).toEqual([
      'metrics[0].difficulty is -1. Use null or a number from 0 to 100.',
    ]);
  });

  it('refuses a volume that is not a finite number', () => {
    expect(
      checkMetrics({
        metrics: [
          { ...editor, volume: '62' },
          { ...collage, volume: Infinity },
        ],
      }),
    ).toEqual([
      'metrics[0].volume is "62". Use null or a number from 0 to 100.',
      'metrics[1].volume is Infinity. Use null or a number from 0 to 100.',
    ]);
  });

  it('refuses a metric with no difficulty', () => {
    expect(
      checkMetrics({ metrics: [{ keyword: 'photo editor', volume: 62 }] }),
    ).toEqual([
      'metrics[0].difficulty is missing. Use null or a number from 0 to 100.',
    ]);
  });

  it('refuses a keyword that was not asked for', () => {
    expect(
      checkMetrics({
        metrics: [editor, { ...collage, keyword: 'video editor' }],
      }),
    ).toEqual([
      'metrics[1] names "video editor", which is not in the keywords the call asked for. Answer only those.',
    ]);
  });

  it('refuses a keyword returned twice', () => {
    expect(checkMetrics({ metrics: [editor, collage, editor] })).toEqual([
      'metrics[2] repeats "photo editor". Return each keyword once.',
    ]);
  });

  it('accepts null volume with a numeric difficulty', () => {
    expect(
      checkMetrics({ metrics: [{ ...editor, volume: null }, collage] }),
    ).toEqual([]);
  });

  it('accepts fewer metrics than keywords asked', () => {
    expect(checkMetrics({ metrics: [collage] })).toEqual([]);
    expect(checkMetrics({ metrics: [] })).toEqual([]);
  });

  it('accepts both ends of the range', () => {
    expect(
      checkMetrics({ metrics: [{ ...editor, volume: 0, difficulty: 100 }] }),
    ).toEqual([]);
  });

  it('names each entry that is not an object, with no follow-on issues', () => {
    expect(
      checkMetrics({ metrics: [null, 'photo editor', 7, editor] }),
    ).toEqual([
      'metrics[0] is not an object. A metric is { "keyword": "...", "volume": ..., "difficulty": ... }.',
      'metrics[1] is not an object. A metric is { "keyword": "...", "volume": ..., "difficulty": ... }.',
      'metrics[2] is not an object. A metric is { "keyword": "...", "volume": ..., "difficulty": ... }.',
    ]);
  });

  it('rejects a metric whose keyword is a number even when it matches a requested keyword as text', () => {
    expect(
      checkMetrics(
        { metrics: [{ keyword: 7, volume: 1, difficulty: 1 }] },
        { ...input, keywords: ['7'] },
      ),
    ).toEqual([
      'metrics[0].keyword is not a string. Name the keyword the numbers are for, spelled exactly as the call asked for it.',
    ]);
  });

  it('reports a missing keyword as missing, not as an unrequested keyword', () => {
    expect(checkMetrics({ metrics: [{ volume: 62, difficulty: 48 }] })).toEqual(
      [
        'metrics[0].keyword is missing. Name the keyword the numbers are for, spelled exactly as the call asked for it.',
      ],
    );
  });

  it('refuses a keyword spelled differently from the one asked', () => {
    expect(
      checkMetrics({ metrics: [{ ...editor, keyword: 'Photo Editor' }] }),
    ).toEqual([
      'metrics[0] names "Photo Editor", which is not in the keywords the call asked for. Answer only those.',
    ]);
  });

  it('refuses a score that is NaN', () => {
    expect(checkMetrics({ metrics: [{ ...editor, difficulty: NaN }] })).toEqual(
      ['metrics[0].difficulty is NaN. Use null or a number from 0 to 100.'],
    );
  });

  it('accepts exactly 100 metrics', () => {
    const keywords = Array.from(
      { length: 100 },
      (_, index) => `kw ${String(index)}`,
    );
    const metrics = keywords.map(keyword => ({
      keyword,
      volume: 10,
      difficulty: 10,
    }));
    expect(checkMetrics({ metrics }, { ...input, keywords })).toEqual([]);
  });
});

describe('validateKeywordSuggestionsResult', () => {
  it('accepts a sound answer', () => {
    expect(
      validateKeywordSuggestionsResult({
        suggestions: [
          { keyword: 'photo collage' },
          { keyword: 'picture editor', volume: 55, difficulty: null },
        ],
      }),
    ).toEqual([]);
  });

  it('names the body shape', () => {
    expect(validateKeywordSuggestionsResult({ metrics: [] })).toEqual([
      'A suggestions answer is { "suggestions": [...] }. Return the array, empty when there is nothing to suggest.',
    ]);
  });

  it('refuses more than 50 suggestions', () => {
    const suggestions = Array.from({ length: 51 }, (_, index) => ({
      keyword: `kw ${String(index)}`,
    }));
    expect(validateKeywordSuggestionsResult({ suggestions })).toEqual([
      'The answer has 51 suggestions. Return at most 50.',
    ]);
  });

  it('refuses an empty keyword', () => {
    expect(
      validateKeywordSuggestionsResult({ suggestions: [{ keyword: '' }] }),
    ).toEqual([
      'suggestions[0].keyword is empty. A keyword is a non-empty string of at most 100 characters.',
    ]);
  });

  it('refuses a keyword that is not a string', () => {
    expect(
      validateKeywordSuggestionsResult({ suggestions: [{ keyword: 7 }, {}] }),
    ).toEqual([
      'suggestions[0].keyword is not a string. A keyword is a non-empty string of at most 100 characters.',
      'suggestions[1].keyword is not a string. A keyword is a non-empty string of at most 100 characters.',
    ]);
  });

  it('refuses a keyword longer than 100 characters', () => {
    expect(
      validateKeywordSuggestionsResult({
        suggestions: [
          { keyword: 'a'.repeat(100) },
          { keyword: 'b'.repeat(101) },
        ],
      }),
    ).toEqual([
      'suggestions[1].keyword is 101 characters long. A keyword is a non-empty string of at most 100 characters.',
    ]);
  });

  it('refuses a keyword returned twice', () => {
    expect(
      validateKeywordSuggestionsResult({
        suggestions: [
          { keyword: 'photo collage' },
          { keyword: 'photo collage' },
        ],
      }),
    ).toEqual([
      'suggestions[1] repeats "photo collage". Return each keyword once.',
    ]);
  });

  it('refuses a volume above 100 and a difficulty below 0', () => {
    expect(
      validateKeywordSuggestionsResult({
        suggestions: [
          { keyword: 'photo collage', volume: 101, difficulty: -1 },
        ],
      }),
    ).toEqual([
      'suggestions[0].volume is 101. Use null or a number from 0 to 100.',
      'suggestions[0].difficulty is -1. Use null or a number from 0 to 100.',
    ]);
  });

  it('names each entry that is not an object, with no follow-on issues', () => {
    expect(
      validateKeywordSuggestionsResult({
        suggestions: [null, 'photo', 7, { keyword: 'photo collage' }],
      }),
    ).toEqual([
      'suggestions[0] is not an object. A suggestion is { "keyword": "..." }, with volume and difficulty when you have them.',
      'suggestions[1] is not an object. A suggestion is { "keyword": "..." }, with volume and difficulty when you have them.',
      'suggestions[2] is not an object. A suggestion is { "keyword": "..." }, with volume and difficulty when you have them.',
    ]);
  });

  it('accepts exactly 50 suggestions', () => {
    const suggestions = Array.from({ length: 50 }, (_, index) => ({
      keyword: `kw ${String(index)}`,
    }));
    expect(validateKeywordSuggestionsResult({ suggestions })).toEqual([]);
  });
});
