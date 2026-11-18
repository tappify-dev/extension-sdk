import { describe, expect, it } from 'vitest';
import type { AdsAcquisition } from '../../src/manifest/types';
import { validateAdsSyncResponse } from '../../src/testing';

const acquisition: AdsAcquisition = {
  levels: [
    { level: 'campaign', label: 'Campaign', changes: ['status', 'budget'] },
    { level: 'ad_group', label: 'Ad set', changes: ['status', 'bid'] },
  ],
  metrics: [
    { key: 'impressions', definition: 'Times an ad was shown on screen.' },
    { key: 'spend', definition: 'Amount billed for the day, before tax.' },
  ],
  extraMetrics: [
    {
      key: 'video_views',
      label: 'Video views',
      unit: 'count',
      definition: 'Plays of three seconds or longer.',
    },
  ],
};

const window = { start: '2026-11-01', end: '2026-11-02' };

const campaign = {
  level: 'campaign',
  id: 'c1',
  name: 'Launch',
  status: 'active',
  storeAppId: '123',
};
const adGroup = {
  level: 'ad_group',
  id: 'g1',
  parentId: 'c1',
  name: 'Broad',
  status: 'paused',
};
const row = {
  level: 'campaign',
  itemId: 'c1',
  date: '2026-11-01',
  impressions: 900,
  spend: '12.50',
  extra: { video_views: 40 },
};

const sound = { items: [campaign, adGroup], rows: [row] };

function check(response: unknown): string[] {
  return validateAdsSyncResponse(response, acquisition, window);
}

describe('validateAdsSyncResponse', () => {
  it('accepts a sound answer', () => {
    expect(check(sound)).toEqual([]);
  });

  it('names the body shape', () => {
    expect(check({})).toEqual([
      'A sync answer is { "items": [...], "rows": [...] }. Return both, empty when there is nothing to report.',
    ]);
  });

  it('refuses an undeclared level', () => {
    const keyword = {
      level: 'keyword',
      id: 'k1',
      parentId: 'g1',
      name: 'puzzle game',
      status: 'active',
    };
    expect(check({ ...sound, items: [campaign, adGroup, keyword] })).toEqual([
      'items[2] is a keyword, which this extension does not declare. Add the level to acquisition.levels or leave the item out.',
    ]);
  });

  it('needs a parent below campaign', () => {
    const orphan = {
      level: 'ad_group',
      id: 'g1',
      name: 'Broad',
      status: 'paused',
    };
    expect(check({ ...sound, items: [campaign, orphan] })).toEqual([
      'items[1] is an ad_group with no parentId. Every level below campaign names its parent.',
    ]);
  });

  it('refuses an unknown status', () => {
    expect(
      check({ ...sound, items: [{ ...campaign, status: 'enabled' }, adGroup] }),
    ).toEqual([
      'items[0] has status "enabled". Use active, paused or removed, and put the network\'s own word in networkStatus.',
    ]);
  });

  it('refuses a row for a missing item', () => {
    expect(check({ ...sound, rows: [{ ...row, itemId: 'c9' }] })).toEqual([
      'rows[0] names campaign "c9", which is not in items. Return the item in the same answer as its rows.',
    ]);
  });

  it('refuses a day outside the window', () => {
    expect(check({ ...sound, rows: [{ ...row, date: '2026-11-03' }] })).toEqual(
      [
        'rows[0] is dated 2026-11-03, outside the window 2026-11-01 to 2026-11-02.',
      ],
    );
  });

  it('accepts both ends of the window', () => {
    expect(
      check({ ...sound, rows: [row, { ...row, date: '2026-11-02' }] }),
    ).toEqual([]);
  });

  it('refuses an undeclared shared number', () => {
    expect(check({ ...sound, rows: [{ ...row, clicks: 3 }] })).toEqual([
      'rows[0] reports clicks, which this extension does not declare under acquisition.metrics.',
    ]);
  });

  it('refuses an undeclared extra number', () => {
    expect(
      check({ ...sound, rows: [{ ...row, extra: { swipes: 2 } }] }),
    ).toEqual([
      'rows[0] reports the extra number "swipes", which is not under acquisition.extraMetrics.',
    ]);
  });

  it('refuses money as a number', () => {
    expect(check({ ...sound, rows: [{ ...row, spend: 12.5 }] })).toEqual([
      'rows[0].spend is a number. Amounts are decimal strings such as "12.50".',
    ]);
  });

  it('refuses a budget with a bad amount', () => {
    const budget = { amount: 'ten', currency: 'USD', period: 'daily' };
    expect(
      check({ ...sound, items: [{ ...campaign, budget }, adGroup] }),
    ).toEqual([
      'items[0].budget.amount is "ten". Amounts are decimal strings such as "12.50".',
    ]);
  });

  it('reports every problem', () => {
    expect(
      check({
        items: [campaign, { ...adGroup, status: 'enabled' }],
        rows: [{ ...row, spend: 12.5 }],
      }),
    ).toEqual([
      'items[1] has status "enabled". Use active, paused or removed, and put the network\'s own word in networkStatus.',
      'rows[0].spend is a number. Amounts are decimal strings such as "12.50".',
    ]);
  });

  it('refuses a declared shared number that is not a number', () => {
    expect(check({ ...sound, rows: [{ ...row, impressions: '900' }] })).toEqual(
      [
        'rows[0].impressions is not a number. Counts are JSON numbers such as 120.',
      ],
    );
  });

  it('refuses a declared extra value that is not a finite number', () => {
    expect(
      check({ ...sound, rows: [{ ...row, extra: { video_views: Infinity } }] }),
    ).toEqual([
      'rows[0].extra.video_views is not a number. Counts are JSON numbers such as 120.',
    ]);
  });

  it('keeps one message for an undeclared number of the wrong type', () => {
    expect(
      check({
        ...sound,
        rows: [{ ...row, clicks: '3', extra: { swipes: 'two' } }],
      }),
    ).toEqual([
      'rows[0] reports clicks, which this extension does not declare under acquisition.metrics.',
      'rows[0] reports the extra number "swipes", which is not under acquisition.extraMetrics.',
    ]);
  });

  it('refuses a date that is not YYYY-MM-DD and skips the window check', () => {
    expect(check({ ...sound, rows: [{ ...row, date: '11/03/2026' }] })).toEqual(
      [
        'rows[0] is dated "11/03/2026". Dates are YYYY-MM-DD in the account\'s time zone.',
      ],
    );
  });

  it('refuses a parent that is not in the answer', () => {
    expect(
      check({ ...sound, items: [campaign, { ...adGroup, parentId: 'c7' }] }),
    ).toEqual([
      'items[1] names parent "c7", which is not in items. Return a parent in the same answer as its children.',
    ]);
  });

  it('refuses an item returned twice', () => {
    expect(check({ ...sound, items: [campaign, adGroup, campaign] })).toEqual([
      'items[2] repeats campaign "c1". Return each item once.',
    ]);
  });

  it('names a missing amount', () => {
    const budget = { currency: 'USD', period: 'daily' };
    expect(
      check({ ...sound, items: [{ ...campaign, budget }, adGroup] }),
    ).toEqual([
      'items[0].budget.amount is missing. Amounts are decimal strings such as "12.50".',
    ]);
  });

  it('does not throw on entries that are not objects', () => {
    expect(() => check({ items: [null, 'c1'], rows: [7] })).not.toThrow();
  });
});
