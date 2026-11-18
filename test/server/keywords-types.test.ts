import { describe, expectTypeOf, it } from 'vitest';
import type {
  KeywordMetric,
  KeywordMetricsInput,
  KeywordMetricsResult,
  KeywordSuggestion,
  KeywordSuggestionsInput,
  KeywordSuggestionsResult,
  TappifyHandlerOptions,
} from '../../src/server';

describe('keyword data call types', () => {
  it('types both handlers from their inputs and results', () => {
    const options: TappifyHandlerOptions = {
      extensionId: 'example-keywords',
      keywords: {
        metrics: request => {
          expectTypeOf(request.input).toEqualTypeOf<KeywordMetricsInput>();
          const result: KeywordMetricsResult = { metrics: [] };
          return result;
        },
        suggestions: request => {
          expectTypeOf(request.input).toEqualTypeOf<KeywordSuggestionsInput>();
          const result: KeywordSuggestionsResult = { suggestions: [] };
          return result;
        },
      },
    };
    expectTypeOf(options.keywords).not.toBeUndefined();
  });

  it('asks both operations for a platform, a country and a language', () => {
    expectTypeOf<KeywordMetricsInput['platform']>().toEqualTypeOf<
      'ios' | 'android'
    >();
    expectTypeOf<KeywordSuggestionsInput['country']>().toEqualTypeOf<string>();
    expectTypeOf<KeywordSuggestionsInput['lang']>().toEqualTypeOf<string>();
    expectTypeOf<KeywordSuggestionsInput['storeAppId']>().toEqualTypeOf<
      string | undefined
    >();
  });

  it('requires both numbers on a metric and neither on a suggestion', () => {
    expectTypeOf<KeywordMetric['volume']>().toEqualTypeOf<number | null>();
    expectTypeOf<KeywordMetric['difficulty']>().toEqualTypeOf<number | null>();
    expectTypeOf<KeywordSuggestion['volume']>().toEqualTypeOf<
      number | null | undefined
    >();
  });
});
