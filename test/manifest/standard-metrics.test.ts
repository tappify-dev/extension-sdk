import { describe, expect, it } from 'vitest';
import { CATEGORIES } from '../../src/manifest/constants';
import {
  STANDARD_METRICS,
  STANDARD_METRIC_KEYS,
  isStandardMetricKey,
} from '../../src/manifest/standard-metrics';

describe('standard metrics', () => {
  it('lists 25 keys, each prefixed by a category the SDK knows', () => {
    expect(STANDARD_METRIC_KEYS).toHaveLength(25);
    const categories = new Set<string>(CATEGORIES);
    for (const key of STANDARD_METRIC_KEYS) {
      expect(key).toMatch(/^[a-z_]+\.[a-z][a-z0-9_]*$/);
      const prefix = key.split('.')[0];
      const { category } = STANDARD_METRICS[key];
      expect(category).toBe(prefix === 'ads' ? 'ad_acquisition' : prefix);
      expect(categories.has(category)).toBe(true);
    }
  });

  it('pins unit and kind for the keys host features read', () => {
    expect(STANDARD_METRICS['subscriptions.mrr']).toMatchObject({
      unit: 'currency',
      kind: 'gauge',
    });
    expect(STANDARD_METRICS['crashes.crash_free_users']).toMatchObject({
      unit: 'ratio',
      kind: 'gauge',
    });
    expect(STANDARD_METRICS['ads.spend']).toMatchObject({
      unit: 'currency',
      kind: 'counter',
    });
    expect(STANDARD_METRICS['product_analytics.retention_d7']).toMatchObject({
      unit: 'ratio',
      kind: 'gauge',
    });
  });

  it('narrows unknown values', () => {
    expect(isStandardMetricKey('subscriptions.mrr')).toBe(true);
    expect(isStandardMetricKey('mrr')).toBe(false);
    expect(isStandardMetricKey(42)).toBe(false);
    expect(isStandardMetricKey(null)).toBe(false);
  });

  it('gives every key a label of at most 60 characters and a one-sentence definition', () => {
    for (const key of STANDARD_METRIC_KEYS) {
      const { label, definition } = STANDARD_METRICS[key];
      expect(label.length).toBeGreaterThan(0);
      expect(label.length).toBeLessThanOrEqual(60);
      expect(definition).toMatch(/^[A-Z].*\.$/);
      expect(definition).not.toMatch(/[.!?]\s/);
    }
  });
});
