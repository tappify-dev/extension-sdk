import { describe, expectTypeOf, it } from 'vitest';
import type {
  AdsApplyChangeInput,
  AdsOperation,
  AdsOperationMap,
  AdsSyncResult,
  TappifyHandlerOptions,
} from '../../src/server';

describe('ads call types', () => {
  it('names the three operations', () => {
    expectTypeOf<AdsOperation>().toEqualTypeOf<
      'list_accounts' | 'sync' | 'apply_change'
    >();
  });

  it('types a sync handler from the operation map', () => {
    const options: TappifyHandlerOptions = {
      extensionId: 'example-ads',
      health: () => ({ ok: true, version: '1.0.0' }),
      ads: {
        sync: request => {
          expectTypeOf(request.input.window.start).toEqualTypeOf<string>();
          const result: AdsSyncResult = { items: [], rows: [] };
          return result;
        },
      },
    };
    expectTypeOf(options.ads).not.toBeUndefined();
  });

  it('carries an idempotency key on every change', () => {
    expectTypeOf<
      AdsApplyChangeInput['idempotencyKey']
    >().toEqualTypeOf<string>();
    expectTypeOf<
      AdsOperationMap['apply_change']['output']['item']['status']
    >().toEqualTypeOf<'active' | 'paused' | 'removed'>();
  });
});
