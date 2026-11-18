import { describe, expectTypeOf, it } from 'vitest';
import type {
  CrashDetails,
  CrashDetailsInput,
  CrashGroup,
  CrashGroupsInput,
  CrashGroupsResult,
  CrashesOperationMap,
  TappifyHandlerOptions,
  TappifyRouteHandler,
} from '../../src/server';

type GroupsHandler = TappifyRouteHandler<CrashGroupsInput, CrashGroupsResult>;

describe('crashes call types', () => {
  it('names the two operations', () => {
    expectTypeOf<keyof CrashesOperationMap>().toEqualTypeOf<
      'groups' | 'details'
    >();
  });

  it('types both handlers from their inputs and results', () => {
    const options: TappifyHandlerOptions = {
      extensionId: 'example-crashes',
      crashes: {
        groups: request => {
          expectTypeOf(request.input).toEqualTypeOf<CrashGroupsInput>();
          expectTypeOf(request.input.since).toEqualTypeOf<string | null>();
          const result: CrashGroupsResult = { groups: [] };
          return result;
        },
        details: request => {
          expectTypeOf(request.input).toEqualTypeOf<CrashDetailsInput>();
          const result: CrashDetails = {
            externalId: request.input.externalId,
            stackTrace: null,
            breadcrumbs: [],
            release: null,
            environment: null,
          };
          return result;
        },
      },
    };
    expectTypeOf(options.crashes).not.toBeUndefined();
  });

  it('rejects a group without a signature', () => {
    const { signature: _signature, ...unsigned }: CrashGroup = {
      externalId: 'SENTRY-1',
      signature: 'EXC_BAD_ACCESS in renderFrame',
      platform: 'ios',
      affectedUsers: 3,
      affectedSessions: 5,
      trend: 'stable',
      firstSeen: null,
      lastSeen: null,
      versionFirstSeen: null,
    };
    const returnsUnsigned = () => ({ groups: [unsigned] });

    expectTypeOf(returnsUnsigned).not.toExtend<GroupsHandler>();
    const options: TappifyHandlerOptions = {
      extensionId: 'example-crashes',
      // @ts-expect-error A crash group needs a signature.
      crashes: { groups: returnsUnsigned },
    };
    expectTypeOf(options).toEqualTypeOf<TappifyHandlerOptions>();
    expectTypeOf<Omit<CrashGroup, 'signature'>>().not.toExtend<CrashGroup>();
  });

  it('allows null where the reporter has no value', () => {
    expectTypeOf<CrashGroup['platform']>().toEqualTypeOf<
      'ios' | 'android' | null
    >();
    expectTypeOf<CrashGroup['trend']>().toEqualTypeOf<
      'up' | 'down' | 'stable'
    >();
    expectTypeOf<CrashDetails['stackTrace']>().toEqualTypeOf<string | null>();
    expectTypeOf<CrashDetails['breadcrumbs'][number]>().toEqualTypeOf<{
      category: string;
      message: string;
      level: string;
    }>();
  });
});
