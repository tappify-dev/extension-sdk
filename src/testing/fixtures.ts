import type {
  TapApp,
  TapCrashesResult,
  TapKeyword,
  TapListing,
  TapProjectResult,
  TapQuery,
  TapRelease,
  TapResult,
  TapRevenueResult,
  TapReviewsResult,
  TapSeriesMetric,
  TapSeriesPoint,
  TapSeriesResult,
} from '../client/types';

/** The owner's two Northlight apps, one per platform. */
export const fixtureApps: TapApp[] = [
  {
    id: 'app_ios',
    name: 'Northlight',
    platform: 'ios',
    storeId: '1490000001',
    bundleId: 'ai.tappify.northlight',
  },
  {
    id: 'app_android',
    name: 'Northlight',
    platform: 'android',
    storeId: 'ai.tappify.northlight',
    bundleId: 'ai.tappify.northlight',
  },
];

/** Three shipped releases: two iOS versions and the Android build of the newer one. */
export const fixtureReleases: TapRelease[] = [
  {
    id: 'rel_42',
    version: '4.2.0',
    build: '118',
    platform: 'ios',
    state: 'ready_for_sale',
    shippedAt: '2026-09-01T09:00:00.000Z',
  },
  {
    id: 'rel_41',
    version: '4.1.0',
    build: '107',
    platform: 'ios',
    state: 'ready_for_sale',
    shippedAt: '2026-08-11T09:00:00.000Z',
  },
  {
    id: 'rel_a42',
    version: '4.2.0',
    build: '4200',
    platform: 'android',
    state: 'published',
    shippedAt: '2026-09-02T09:00:00.000Z',
  },
];

/**
 * Three tracked terms with positions, two on iOS and one on Android, scored on
 * the host's 1 to 10 traffic scale.
 */
export const fixtureKeywords: TapKeyword[] = [
  {
    id: 'kw_1',
    term: 'photo editor',
    platform: 'ios',
    country: 'US',
    position: 4,
    popularity: 6.6,
  },
  {
    id: 'kw_2',
    term: 'collage maker',
    platform: 'ios',
    country: 'US',
    position: 11,
    popularity: 5.3,
  },
  {
    id: 'kw_3',
    term: 'photo editor',
    platform: 'android',
    country: 'US',
    position: 7,
    popularity: 6,
  },
];

/** One store listing, for iOS in `en-US`. */
export const fixtureListings: TapListing[] = [
  {
    platform: 'ios',
    country: 'US',
    locale: 'en-US',
    title: 'Northlight — Photo Editor',
    subtitle: 'Edit, collage, share',
    description: 'Northlight turns a camera roll into a finished post.',
    keywords: ['photo', 'editor', 'collage'],
    updatedAt: '2026-08-28T12:00:00.000Z',
  },
];

/** The Northlight project, with `fixtureApps` and `fixtureReleases` under it. */
export const fixtureProject: TapProjectResult = {
  project: {
    id: 'prj_north',
    name: 'Northlight',
    platforms: ['ios', 'android'],
  },
  apps: fixtureApps,
  releases: fixtureReleases,
};

const SERIES_VALUES: Record<TapSeriesMetric, number[]> = {
  downloads: [1180, 1240, 1310, 1290, 1402, 1512, 1488],
  impressions: [21400, 22150, 22980, 22110, 24020, 25510, 25010],
  page_views: [8120, 8340, 8710, 8290, 9110, 9640, 9420],
  conversion_rate: [0.145, 0.149, 0.15, 0.156, 0.152, 0.157, 0.158],
};

function week(): string[] {
  return [
    '2026-09-01',
    '2026-09-02',
    '2026-09-03',
    '2026-09-04',
    '2026-09-05',
    '2026-09-06',
    '2026-09-07',
  ];
}

/**
 * Builds the seven-day series for one metric, over the first week of September
 * 2026.
 *
 * @remarks
 * The same seven values every call, so an assertion on a total or a peak is
 * stable: downloads peak at 1,512 and `conversion_rate` comes back with unit
 * `ratio` where the other three come back as `count`. The range in the query does
 * not change the points, so a test that drives the filter bar asserts on the call,
 * not on different numbers.
 *
 * @example
 * ```ts
 * import { fixtureSeries } from '@tappify/extension-sdk/testing';
 *
 * const downloads = fixtureSeries('downloads');
 * const best = Math.max(...downloads.points.map(point => point.value));
 * ```
 */
export function fixtureSeries(metric: TapSeriesMetric): TapSeriesResult {
  const points: TapSeriesPoint[] = week().map((at, index) => ({
    at,
    value: SERIES_VALUES[metric][index],
  }));

  return {
    metric,
    unit: metric === 'conversion_rate' ? 'ratio' : 'count',
    points,
  };
}

/** Three reviews across three countries, averaging 3.7 stars, one already replied to. */
export const fixtureReviews: TapReviewsResult = {
  total: 3,
  averageRating: 3.7,
  reviews: [
    {
      id: 'rev_1',
      platform: 'ios',
      country: 'US',
      rating: 5,
      title: 'Fast and clean',
      body: 'The new collage layouts are exactly what I wanted.',
      author: 'kbrady',
      submittedAt: '2026-09-05T18:22:00.000Z',
      replied: false,
    },
    {
      id: 'rev_2',
      platform: 'ios',
      country: 'GB',
      rating: 2,
      title: 'Crashes on export',
      body: 'Since 4.2 the export button closes the app.',
      author: null,
      submittedAt: '2026-09-04T08:10:00.000Z',
      replied: true,
    },
    {
      id: 'rev_3',
      platform: 'android',
      country: 'DE',
      rating: 4,
      title: null,
      body: 'Gute App, aber der Export dauert lange.',
      author: 'mgruber',
      submittedAt: '2026-09-03T16:45:00.000Z',
      replied: false,
    },
  ],
};

/** A 99.42% crash-free user rate with two issues, both on build 118. */
export const fixtureCrashes: TapCrashesResult = {
  crashFreeRate: 99.42,
  issues: [
    {
      id: 'crash_1',
      title: 'ExportSession.finish — index out of range',
      count: 214,
      build: '118',
      firstSeenAt: '2026-09-01T11:02:00.000Z',
      lastSeenAt: '2026-09-07T21:40:00.000Z',
    },
    {
      id: 'crash_2',
      title: 'PhotoLibrary.load — permission revoked',
      count: 37,
      build: '118',
      firstSeenAt: '2026-09-02T07:15:00.000Z',
      lastSeenAt: '2026-09-06T13:05:00.000Z',
    },
  ],
};

/** 41,200 USD of recurring revenue, 18 refunds, and a seven-day series under it. */
export const fixtureRevenue: TapRevenueResult = {
  currency: 'USD',
  mrr: 41200,
  refunds: 18,
  points: week().map((at, index) => ({
    at,
    value: [1310, 1355, 1401, 1388, 1470, 1525, 1502][index],
  })),
};

/** The shape of `fixtures`: every sandbox fixture under one name. */
export interface TapFixtures {
  project: TapProjectResult;
  apps: TapApp[];
  releases: TapRelease[];
  keywords: TapKeyword[];
  listings: TapListing[];
  reviews: TapReviewsResult;
  crashes: TapCrashesResult;
  revenue: TapRevenueResult;
  /** `fixtureSeries`, so a series is built per metric rather than held. */
  series(metric: TapSeriesMetric): TapSeriesResult;
}

/**
 * The sandbox data the mock bridge and the portal preview both answer with, so a
 * component behaves the same in a test and in the preview.
 *
 * @remarks
 * These are the same objects the `fixture*` exports hold, gathered under one name.
 * `answerFixtureQuery` clones before it answers, but reading `fixtures` directly
 * hands you the live object, so a test that sorts or splices one has to copy it
 * first.
 *
 * @example
 * ```ts
 * import { fixtures } from '@tappify/extension-sdk/testing';
 *
 * const newest = [...fixtures.releases].sort((left, right) =>
 *   right.version.localeCompare(left.version),
 * )[0];
 * ```
 */
export const fixtures: TapFixtures = {
  project: fixtureProject,
  apps: fixtureApps,
  releases: fixtureReleases,
  keywords: fixtureKeywords,
  listings: fixtureListings,
  reviews: fixtureReviews,
  crashes: fixtureCrashes,
  revenue: fixtureRevenue,
  series: fixtureSeries,
};

/**
 * Answers one `tap.data.query` from the fixtures, which is what the mock bridge
 * does.
 *
 * @remarks
 * Every branch is cloned with `structuredClone`, so a component that sorts or
 * splices a result cannot reach the fixture the next test reads. It checks no
 * scope — `createTapMock` refuses an ungranted kind before it gets here — and it
 * ignores the range and platform in the query, so the numbers are the same
 * whatever the filter bar says. The seven assertions inside are the one place
 * TypeScript cannot follow the distributive conditional in `TapResult<Q>` back
 * through a `switch`; each branch returns exactly the result its `case` selected.
 *
 * @example
 * ```ts
 * import { answerFixtureQuery } from '@tappify/extension-sdk/testing';
 *
 * const reviews = answerFixtureQuery({
 *   kind: 'reviews',
 *   range: { from: '2026-09-01', to: '2026-09-08' },
 * });
 * const lowest = Math.min(...reviews.reviews.map(review => review.rating));
 * ```
 */
export function answerFixtureQuery<Q extends TapQuery>(query: Q): TapResult<Q> {
  switch (query.kind) {
    case 'project':
      return structuredClone(fixtureProject) as TapResult<Q>;
    case 'series':
      return structuredClone(fixtureSeries(query.metric)) as TapResult<Q>;
    case 'keywords':
      return structuredClone({ keywords: fixtureKeywords }) as TapResult<Q>;
    case 'listing':
      return structuredClone({ listings: fixtureListings }) as TapResult<Q>;
    case 'reviews':
      return structuredClone(fixtureReviews) as TapResult<Q>;
    case 'crashes':
      return structuredClone(fixtureCrashes) as TapResult<Q>;
    case 'revenue':
      return structuredClone(fixtureRevenue) as TapResult<Q>;
  }
}
