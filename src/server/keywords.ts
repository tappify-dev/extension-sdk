import type { KeywordDataPlatform } from '../manifest/constants';

/** The store, storefront and language a keyword data call is about. */
export interface KeywordDataQuery {
  platform: KeywordDataPlatform;
  /** The storefront's country code. */
  country: string;
  /** The language code the keywords are searched in. */
  lang: string;
}

/** The keywords to answer search volume and difficulty for. */
export interface KeywordMetricsInput extends KeywordDataQuery {
  /** At most 100 keywords. */
  keywords: string[];
}

/** One keyword's numbers; `null` where the provider has no value. */
export interface KeywordMetric {
  /** One of the keywords the call asked for, spelled as it was asked. */
  keyword: string;
  /** Search volume from 0 to 100. */
  volume: number | null;
  /** Ranking difficulty from 0 to 100. */
  difficulty: number | null;
}

/** One metric per keyword the provider knows; leave out the ones it does not. */
export interface KeywordMetricsResult {
  metrics: KeywordMetric[];
}

/** The seed keywords, and the app when there is one, to suggest keywords for. */
export interface KeywordSuggestionsInput extends KeywordDataQuery {
  seeds: string[];
  /** The store's own app id, when the suggestions are for one app. */
  storeAppId?: string;
}

/** One suggested keyword, with its numbers when the provider has them. */
export interface KeywordSuggestion {
  /** At most 100 characters. */
  keyword: string;
  /** Search volume from 0 to 100. */
  volume?: number | null;
  /** Ranking difficulty from 0 to 100. */
  difficulty?: number | null;
}

/** At most 50 suggestions, each keyword once. */
export interface KeywordSuggestionsResult {
  suggestions: KeywordSuggestion[];
}
