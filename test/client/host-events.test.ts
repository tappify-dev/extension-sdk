import { describe, expect, expectTypeOf, it } from 'vitest';
import type { TapQueryOptions } from '../../src/client/query';
import type { Tap, TapHostEvents } from '../../src/client/types';

declare module '../../src/client/types' {
  interface TapHostEventMap {
    'release.shipped': { version: string; build: string };
  }
}

describe('TapHostEvents under a generated augmentation', () => {
  it('keeps every catalogue event alongside the augmented one', () => {
    expectTypeOf<TapHostEvents['release.shipped']>().toEqualTypeOf<{
      version: string;
      build: string;
    }>();
    expectTypeOf<TapHostEvents['metadata.changed']>().toEqualTypeOf<
      Record<string, unknown>
    >();

    const options: TapQueryOptions = {
      invalidateOn: ['release.shipped', 'metadata.changed'],
    };

    expect(options.invalidateOn).toEqual([
      'release.shipped',
      'metadata.changed',
    ]);
  });

  it('types the subscribe handler from the augmented payload', () => {
    const versions: string[] = [];
    const subscribe: Tap['data']['subscribe'] = (event, handler) => {
      if (event === 'release.shipped') {
        handler({ version: '4.2', build: '4210' });
      }
      return () => undefined;
    };

    subscribe('release.shipped', payload => {
      versions.push(payload.version);
    });

    expect(versions).toEqual(['4.2']);
  });
});
