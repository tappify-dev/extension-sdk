import { describe, expectTypeOf, it } from 'vitest';
import type {
  ChatConnectRequest,
  ChatDestination,
  ChatDestinationOption,
  ChatFact,
  ChatMessage,
  ChatMessageRequest,
  ChatMessageResponse,
  ChatOperationMap,
  ChatSeverity,
  TappifyHandlerOptions,
  TappifyRouteHandler,
} from '../../src/server';

describe('chat call types', () => {
  it('names the four operations', () => {
    expectTypeOf<keyof ChatOperationMap>().toEqualTypeOf<
      'connect' | 'destinations' | 'messages' | 'disconnect'
    >();
  });

  it('names the severity and fact types', () => {
    expectTypeOf<ChatSeverity>().toEqualTypeOf<
      'info' | 'success' | 'warning' | 'critical'
    >();
    expectTypeOf<ChatFact>().toEqualTypeOf<{ label: string; value: string }>();
    expectTypeOf<ChatMessage['severity']>().toEqualTypeOf<ChatSeverity>();
    expectTypeOf<ChatMessage['facts']>().toEqualTypeOf<ChatFact[]>();
  });

  it('types every handler from its request and answer', () => {
    const options: TappifyHandlerOptions = {
      extensionId: 'example-chat',
      chat: {
        connect: request => {
          expectTypeOf(request.input).toEqualTypeOf<ChatConnectRequest>();
          expectTypeOf(request.input.option).toEqualTypeOf<
            ChatDestinationOption | undefined
          >();
          return {
            destination: {
              externalId: 'T1:C1',
              label: '#releases',
              config: {},
            },
          };
        },
        destinations: () => ({ options: [{ id: 'C1', label: '#releases' }] }),
        messages: request => {
          expectTypeOf(request.input).toEqualTypeOf<ChatMessageRequest>();
          expectTypeOf(request.input.message.severity).toEqualTypeOf<
            'info' | 'success' | 'warning' | 'critical'
          >();
          expectTypeOf(request.input.message.project).toEqualTypeOf<{
            id: string;
            name: string;
          } | null>();
          return { delivered: true, reference: 'ts-1' };
        },
        disconnect: () => ({ ok: true }),
      },
    };
    expectTypeOf(options.chat).not.toBeUndefined();
  });

  it('refuses a messages answer that is not delivered', () => {
    expectTypeOf(() => ({ delivered: false })).not.toExtend<
      TappifyRouteHandler<ChatMessageRequest, ChatMessageResponse>
    >();
    const options: TappifyHandlerOptions = {
      extensionId: 'example-chat',
      chat: {
        // @ts-expect-error A messages answer has to say it was delivered.
        messages: () => ({ delivered: false }),
      },
    };
    expectTypeOf(options).toEqualTypeOf<TappifyHandlerOptions>();
  });

  it('refuses a destination without config', () => {
    // @ts-expect-error A destination carries its config.
    const destination: ChatDestination = {
      externalId: 'T1:C1',
      label: '#releases',
    };
    expectTypeOf(destination.config).toEqualTypeOf<Record<string, unknown>>();
  });
});
