import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ActionId,
  Tap,
  TapChatCard,
  TapFilters,
  TapProcedureName,
  TapQuery,
  TapResult,
  TapSettingsValues,
  TapSingleton,
  TapStorage,
  TelemetryEvent,
} from '../../src/client/types';

describe('bridge types', () => {
  it('narrows a data result by its query kind', () => {
    expectTypeOf<TapResult<{ kind: 'project' }>>().toHaveProperty('apps');
    expectTypeOf<TapResult<{ kind: 'keywords' }>>().toHaveProperty('keywords');
  });

  it('falls back to permissive shapes without a generated augmentation', () => {
    expectTypeOf<TapProcedureName>().toEqualTypeOf<string>();
    expectTypeOf<ActionId>().toEqualTypeOf<string>();
    expectTypeOf<TelemetryEvent>().toEqualTypeOf<string>();
    expectTypeOf<TapSettingsValues>().toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf<TapStorage>().toEqualTypeOf<
      Record<
        string,
        | TapSingleton<unknown>
        | import('../../src/client/types').TapCollection<unknown>
      >
    >();
  });

  it('models the filters the host page owns', () => {
    const filters: TapFilters = {
      range: { from: '2026-08-01', to: '2026-09-01', preset: '30d' },
      platform: 'all',
      country: 'all',
    };

    expect(filters.range.preset).toBe('30d');
  });

  it('models every host card the assistant can draw', () => {
    const cards: TapChatCard[] = [
      { type: 'value', label: 'Installs', value: 1200, delta: 0.12 },
      {
        type: 'series',
        label: 'Installs',
        points: [{ at: '2026-09-01', value: 3 }],
      },
      {
        type: 'table',
        columns: [{ key: 'term', label: 'Term' }],
        rows: [{ term: 'photo' }],
      },
      { type: 'list', items: [{ id: '1', label: 'One' }] },
      {
        type: 'comparison',
        label: 'Release 4.2 vs 4.1',
        left: { label: '4.2', value: 10 },
        right: { label: '4.1', value: 8 },
      },
    ];

    expect(cards).toHaveLength(5);
  });

  it('requires every Tap member the spec lists', () => {
    expectTypeOf<Tap>().toHaveProperty('extension');
    expectTypeOf<Tap>().toHaveProperty('env');
    expectTypeOf<Tap>().toHaveProperty('host');
    expectTypeOf<Tap>().toHaveProperty('auth');
    expectTypeOf<Tap>().toHaveProperty('project');
    expectTypeOf<Tap>().toHaveProperty('filters');
    expectTypeOf<Tap>().toHaveProperty('theme');
    expectTypeOf<Tap>().toHaveProperty('locale');
    expectTypeOf<Tap>().toHaveProperty('timezone');
    expectTypeOf<Tap>().toHaveProperty('format');
    expectTypeOf<Tap>().toHaveProperty('nav');
    expectTypeOf<Tap>().toHaveProperty('data');
    expectTypeOf<Tap>().toHaveProperty('server');
    expectTypeOf<Tap>().toHaveProperty('state');
    expectTypeOf<Tap>().toHaveProperty('ui');
    expectTypeOf<Tap>().toHaveProperty('context');
    expectTypeOf<Tap>().toHaveProperty('params');
    expectTypeOf<Tap>().toHaveProperty('storage');
    expectTypeOf<Tap>().toHaveProperty('telemetry');
    expectTypeOf<Tap>().toHaveProperty('actions');
    expectTypeOf<Tap>().toHaveProperty('invalidate');
    expectTypeOf<Tap>().toHaveProperty('__portal');
    expectTypeOf<Tap>().toHaveProperty('__subscribe');
  });

  it('accepts every query kind the data API serves', () => {
    const queries: TapQuery[] = [
      { kind: 'project' },
      {
        kind: 'series',
        metric: 'downloads',
        range: { from: '2026-08-01', to: '2026-09-01' },
      },
      { kind: 'keywords' },
      { kind: 'listing' },
      { kind: 'reviews', range: { from: '2026-08-01', to: '2026-09-01' } },
      { kind: 'crashes', range: { from: '2026-08-01', to: '2026-09-01' } },
      { kind: 'revenue', range: { from: '2026-08-01', to: '2026-09-01' } },
    ];

    expect(queries.map(query => query.kind)).toEqual([
      'project',
      'series',
      'keywords',
      'listing',
      'reviews',
      'crashes',
      'revenue',
    ]);
  });
});
