import type { ExtensionCategory } from './constants';
import type { MetricDeclaration } from './types';

/**
 * The standard metrics a connector metric can report through `standard`.
 * Tappify features read these keys without knowing which extension supplied
 * them. Currency values are USD and ratios run from 0 to 1.
 */
export const STANDARD_METRICS = {
  'subscriptions.mrr': {
    label: 'MRR',
    unit: 'currency',
    kind: 'gauge',
    category: 'subscriptions',
    definition:
      'Recurring subscription revenue normalised to one month, in USD, as of the end of the bucket.',
  },
  'subscriptions.revenue': {
    label: 'Revenue',
    unit: 'currency',
    kind: 'counter',
    category: 'subscriptions',
    definition:
      'Gross revenue from purchases and renewals during the bucket, in USD.',
  },
  'subscriptions.active_subscriptions': {
    label: 'Active subscriptions',
    unit: 'count',
    kind: 'gauge',
    category: 'subscriptions',
    definition:
      'Paid subscriptions active at the end of the bucket, not counting free trials.',
  },
  'subscriptions.active_trials': {
    label: 'Active trials',
    unit: 'count',
    kind: 'gauge',
    category: 'subscriptions',
    definition: 'Free trials running at the end of the bucket.',
  },
  'subscriptions.trial_starts': {
    label: 'New trials',
    unit: 'count',
    kind: 'counter',
    category: 'subscriptions',
    definition: 'Free trials started during the bucket.',
  },
  'subscriptions.trial_conversions': {
    label: 'Trial conversions',
    unit: 'count',
    kind: 'counter',
    category: 'subscriptions',
    definition:
      'Free trials that turned into a paid subscription during the bucket.',
  },
  'subscriptions.new_subscriptions': {
    label: 'New subscriptions',
    unit: 'count',
    kind: 'counter',
    category: 'subscriptions',
    definition:
      'Paid subscriptions started during the bucket, including converted trials.',
  },
  'subscriptions.churned_subscriptions': {
    label: 'Churned subscriptions',
    unit: 'count',
    kind: 'counter',
    category: 'subscriptions',
    definition:
      'Paid subscriptions that ended during the bucket without renewing.',
  },
  'subscriptions.refunds': {
    label: 'Refunds',
    unit: 'count',
    kind: 'counter',
    category: 'subscriptions',
    definition: 'Refunded purchases and renewals during the bucket.',
  },
  'product_analytics.active_users': {
    label: 'Active users',
    unit: 'count',
    kind: 'gauge',
    category: 'product_analytics',
    definition: 'Distinct users active in the app during the bucket.',
  },
  'product_analytics.new_users': {
    label: 'New users',
    unit: 'count',
    kind: 'counter',
    category: 'product_analytics',
    definition: 'Users seen in the app for the first time during the bucket.',
  },
  'product_analytics.sessions': {
    label: 'Sessions',
    unit: 'count',
    kind: 'counter',
    category: 'product_analytics',
    definition: 'App sessions started during the bucket.',
  },
  'product_analytics.avg_session_seconds': {
    label: 'Average session length',
    unit: 'seconds',
    kind: 'gauge',
    category: 'product_analytics',
    definition:
      'The mean length of the sessions started during the bucket, in seconds.',
  },
  'product_analytics.retention_d1': {
    label: 'Day 1 retention',
    unit: 'ratio',
    kind: 'gauge',
    category: 'product_analytics',
    definition:
      'The share of users first seen in the bucket who return one day later, from 0 to 1, bucketed at the cohort start.',
  },
  'product_analytics.retention_d7': {
    label: 'Day 7 retention',
    unit: 'ratio',
    kind: 'gauge',
    category: 'product_analytics',
    definition:
      'The share of users first seen in the bucket who return seven days later, from 0 to 1, bucketed at the cohort start.',
  },
  'product_analytics.retention_d30': {
    label: 'Day 30 retention',
    unit: 'ratio',
    kind: 'gauge',
    category: 'product_analytics',
    definition:
      'The share of users first seen in the bucket who return thirty days later, from 0 to 1, bucketed at the cohort start.',
  },
  'product_analytics.event_count': {
    label: 'Event count',
    unit: 'count',
    kind: 'counter',
    category: 'product_analytics',
    definition: 'Analytics events recorded during the bucket.',
  },
  'crashes.crash_free_users': {
    label: 'Crash-free users',
    unit: 'ratio',
    kind: 'gauge',
    category: 'crashes',
    definition:
      'The share of users active during the bucket who had no crash, from 0 to 1.',
  },
  'crashes.crash_free_sessions': {
    label: 'Crash-free sessions',
    unit: 'ratio',
    kind: 'gauge',
    category: 'crashes',
    definition:
      'The share of sessions during the bucket that ended without a crash, from 0 to 1.',
  },
  'crashes.crash_events': {
    label: 'Crash events',
    unit: 'count',
    kind: 'counter',
    category: 'crashes',
    definition: 'Crashes recorded during the bucket.',
  },
  'crashes.affected_users': {
    label: 'Users affected by crashes',
    unit: 'count',
    kind: 'gauge',
    category: 'crashes',
    definition: 'Distinct users who had at least one crash during the bucket.',
  },
  'ads.spend': {
    label: 'Ad spend',
    unit: 'currency',
    kind: 'counter',
    category: 'ad_acquisition',
    definition: 'Amount spent on ads during the bucket, in USD.',
  },
  'ads.installs': {
    label: 'Ad installs',
    unit: 'count',
    kind: 'counter',
    category: 'ad_acquisition',
    definition: 'Installs attributed to ads during the bucket.',
  },
  'ads.impressions': {
    label: 'Ad impressions',
    unit: 'count',
    kind: 'counter',
    category: 'ad_acquisition',
    definition: 'Times an ad was shown during the bucket.',
  },
  'ads.clicks': {
    label: 'Ad clicks',
    unit: 'count',
    kind: 'counter',
    category: 'ad_acquisition',
    definition: 'Taps or clicks on an ad during the bucket.',
  },
} as const satisfies Record<
  string,
  {
    label: string;
    unit: MetricDeclaration['unit'];
    kind: MetricDeclaration['kind'];
    category: ExtensionCategory;
    definition: string;
  }
>;

/** A key of the standard metric catalogue, such as `subscriptions.mrr`. */
export type StandardMetricKey = keyof typeof STANDARD_METRICS;

/** Whether a value is a key of the standard metric catalogue. */
export function isStandardMetricKey(
  value: unknown,
): value is StandardMetricKey {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(STANDARD_METRICS, value)
  );
}

/** Every key of the standard metric catalogue, in catalogue order. */
export const STANDARD_METRIC_KEYS: readonly StandardMetricKey[] =
  Object.keys(STANDARD_METRICS).filter(isStandardMetricKey);
