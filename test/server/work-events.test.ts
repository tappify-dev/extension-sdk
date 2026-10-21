import { createHmac } from 'node:crypto';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  sendWorkEvent,
  type SendWorkEventOptions,
  type WorkEvent,
  type WorkHydratedCommentCreatedEvent,
  type WorkHydratedEvent,
  type WorkRichTextSegment,
} from '../../src/server';

const callbackUrl = 'https://host.test/custom/work/callback?generation=7';
const options = { callbackUrl, secret: 'install-secret' };
const base = {
  externalItemId: 'item_1',
  providerEventId: 'event_1',
  occurredAt: '2026-10-15T12:00:00.000Z',
  dedupeKey: 'item_1:event_1',
};
const comment = {
  externalCommentId: 'comment_1',
  body: 'Looks good — café',
  author: { id: 'author_1', displayName: 'Sam' },
  createdAt: '2026-10-15T11:59:00.000Z',
};
const status = { id: 'done', label: 'Done', stage: 'done' as const };
const segments: WorkRichTextSegment[] = [
  { type: 'text', text: 'Please ask ' },
  {
    type: 'user_mention',
    person: { id: 'provider_2', displayName: 'Ada', email: 'ada@example.com' },
    fallback: '@Ada',
  },
  { type: 'text', text: ' today.' },
];
const richComment = {
  ...comment,
  author: { id: 'provider_1', displayName: 'Sam', email: 'sam@example.com' },
  segments,
};

describe('sendWorkEvent', () => {
  it('exports a dedicated sender', () => {
    expect(sendWorkEvent).toBeTypeOf('function');
  });

  it.each([
    { ...base, type: 'comment.created', comment },
    { ...base, type: 'status.changed', status },
    { ...base, type: 'item.deleted' },
    { ...base, type: 'comment.created', hydrateRef: 'opaque-short-lived-ref' },
    { ...base, type: 'status.changed', hydrateRef: 'opaque-short-lived-ref' },
    { ...base, type: 'item.deleted', hydrateRef: 'opaque-short-lived-ref' },
  ] satisfies WorkEvent[])(
    'sends a valid $type event unchanged',
    async event => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 202 }));
      await sendWorkEvent(event, { ...options, fetch: transport });
      expect(transport).toHaveBeenCalledOnce();
      const [url, init] = transport.mock.calls[0];
      expect(url).toBe(callbackUrl);
      expect(init?.method).toBe('POST');
      expect(JSON.parse(init?.body as string)).toEqual(event);
      expect(new Headers(init?.headers).get('content-type')).toBe(
        'application/json',
      );
    },
  );

  it('signs the exact UTF-8 body and preserves the logical dedupe key across retries', async () => {
    const event: WorkEvent = {
      ...base,
      type: 'comment.created',
      comment,
      providerVersion: 'v3',
    };
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    await sendWorkEvent(event, { ...options, fetch: transport });
    await sendWorkEvent(event, { ...options, fetch: transport });
    const expectedBody =
      '{"externalItemId":"item_1","providerEventId":"event_1","occurredAt":"2026-10-15T12:00:00.000Z","dedupeKey":"item_1:event_1","type":"comment.created","comment":{"externalCommentId":"comment_1","body":"Looks good — café","author":{"id":"author_1","displayName":"Sam"},"createdAt":"2026-10-15T11:59:00.000Z"},"providerVersion":"v3"}';
    const expectedSignature = createHmac('sha256', 'install-secret')
      .update(expectedBody, 'utf8')
      .digest('hex');
    for (const [, init] of transport.mock.calls) {
      expect(init?.body).toBe(expectedBody);
      expect(new Headers(init?.headers).get('x-tappify-signature')).toBe(
        expectedSignature,
      );
    }
  });

  it.each([
    richComment,
    { ...richComment, author: { id: 'provider_1', displayName: 'Sam' } },
    { ...richComment, segments: [] },
    {
      ...richComment,
      segments: [
        { type: 'text', text: '' },
        {
          type: 'user_mention',
          person: { id: 'provider_2', displayName: 'Ada' },
          fallback: '@Ada',
        },
      ],
    },
  ] satisfies WorkHydratedCommentCreatedEvent['comment'][])(
    'preserves rich comment segments and optional person emails: %j',
    async normalized => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 202 }));
      await sendWorkEvent(
        { ...base, type: 'comment.created', comment: normalized },
        { ...options, fetch: transport },
      );
      const delivered = JSON.parse(transport.mock.calls[0][1]?.body as string);
      expect(delivered.comment).toEqual(normalized);
    },
  );

  it.each([
    { name: 'only a hole', segments: new Array<WorkRichTextSegment>(1) },
    {
      name: 'a hole after valid text',
      segments: Object.assign(new Array<WorkRichTextSegment>(2), {
        0: { type: 'text' as const, text: 'Hello' },
      }),
    },
  ])('rejects sparse segments with $name before transport', async fixture => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 202 }));

    await expect(
      sendWorkEvent(
        {
          ...base,
          type: 'comment.created',
          comment: { ...richComment, segments: fixture.segments },
        },
        { ...options, fetch: transport },
      ),
    ).rejects.toThrow(/work event/i);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each<[string, unknown]>([
    [
      'empty author ID',
      { ...richComment, author: { id: '', displayName: 'Sam' } },
    ],
    [
      'empty author name',
      { ...richComment, author: { id: 'user_1', displayName: ' ' } },
    ],
    ...[
      '',
      ' ',
      'sam.example.com',
      'sam@@example.com',
      ' sam@example.com ',
      42,
      null,
    ].map((email): [string, unknown] => [
      'invalid author email',
      { ...richComment, author: { ...richComment.author, email } },
    ]),
    ['missing segments', { ...richComment, segments: undefined }],
    ['null segments', { ...richComment, segments: null }],
    ['non-array segments', { ...richComment, segments: {} }],
    ['non-string body', { ...richComment, body: 42 }],
    ['missing body', { ...richComment, body: undefined }],
    ...[
      null,
      { type: 'unknown', text: 'hello' },
      { type: 'text', text: 42 },
      { type: 'text' },
      {
        type: 'user_mention',
        person: { id: '', displayName: 'Ada' },
        fallback: '@Ada',
      },
      {
        type: 'user_mention',
        person: { id: 'provider_2', displayName: '' },
        fallback: '@Ada',
      },
      {
        type: 'user_mention',
        person: { id: 'provider_2', displayName: 'Ada', email: 'bad' },
        fallback: '@Ada',
      },
      {
        type: 'user_mention',
        person: { id: 'provider_2', displayName: 'Ada' },
        fallback: '',
      },
      {
        type: 'user_mention',
        person: { id: 'provider_2', displayName: 'Ada' },
        fallback: ' ',
      },
      {
        type: 'user_mention',
        person: { id: 'provider_2', displayName: 'Ada' },
      },
    ].map((segment): [string, unknown] => [
      'invalid segment',
      { ...richComment, segments: [segment] },
    ]),
  ])(
    'rejects malformed rich comments before transport: %s (%j)',
    async (_name, normalized) => {
      const transport = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 202 }));
      await expect(
        sendWorkEvent(
          {
            ...base,
            type: 'comment.created',
            comment: normalized,
          } as WorkEvent,
          { ...options, fetch: transport },
        ),
      ).rejects.toThrow(/work event/i);
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it.each([
    { ...base, type: 'comment.created' },
    { ...base, type: 'status.changed' },
    { ...base, type: 'comment.created', hydrateRef: '' },
    { ...base, type: 'status.changed', hydrateRef: '  ' },
    { ...base, type: 'comment.created', comment: { body: 'incomplete' } },
    { ...base, type: 'status.changed', status: { id: 'done' } },
    {
      ...base,
      type: 'status.changed',
      status: { ...status, stage: 'unknown' },
    },
    {
      ...base,
      type: 'status.changed',
      status: { ...status, stage: { toString: (): string => 'done' } },
    },
    { ...base, type: 'comment.created', comment, hydrateRef: 'ref' },
    {
      ...base,
      type: 'comment.created',
      comment: richComment,
      hydrateRef: 'ref',
    },
    { ...base, type: 'status.changed', status, hydrateRef: 'ref' },
    { ...base, type: 'item.deleted', comment },
    { ...base, type: 'comment.created', status, hydrateRef: 'ref' },
    { ...base, type: 'unknown' },
    { ...base, type: 'item.deleted', dedupeKey: '' },
  ])(
    'rejects incomplete or ambiguous work events before transport: %j',
    async event => {
      const transport = vi.fn<typeof fetch>();
      await expect(
        sendWorkEvent(event as WorkEvent, { ...options, fetch: transport }),
      ).rejects.toThrow(/work event/i);
      expect(transport).not.toHaveBeenCalled();
    },
  );

  it('requires the provisioned callback at runtime rather than creating a default URL', async () => {
    const transport = vi.fn<typeof fetch>();
    await expect(
      sendWorkEvent({ ...base, type: 'item.deleted' }, {
        secret: 's',
        fetch: transport,
      } as unknown as SendWorkEventOptions),
    ).rejects.toThrow(/callbackUrl/);
    expect(transport).not.toHaveBeenCalled();
  });

  it.each([
    {
      status: 401,
      body: '{"error":{"code":"SIGNATURE_INVALID"}}',
      code: 'SIGNATURE_INVALID',
    },
    { status: 503, body: 'unavailable', code: undefined },
  ])('reports work event rejection with HTTP $status', async rejection => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(rejection.body, { status: rejection.status }),
      );
    const result = sendWorkEvent(
      { ...base, type: 'item.deleted' },
      { ...options, fetch: transport },
    );
    await expect(result).rejects.toMatchObject({
      name: 'TapServerError',
      code: 'TAP_WEBHOOK_REJECTED',
      status: rejection.status,
    });
    await expect(result).rejects.toThrow(/work event/i);
    await expect(result).rejects.not.toThrow(/contributes\.webhooks/);
    if (rejection.code) await expect(result).rejects.toThrow(rejection.code);
  });

  it('requires a callback and either complete normalized content or a reference at compile time', () => {
    expectTypeOf<WorkHydratedEvent>().toExtend<WorkEvent>();
    // @ts-expect-error A configure-provisioned callback is mandatory.
    const missingCallback: SendWorkEventOptions = { secret: 's' };
    // @ts-expect-error A comment signal needs normalized data or a reference.
    const missingContent: WorkEvent = { ...base, type: 'comment.created' };
    // @ts-expect-error Content and a reference cannot coexist.
    const ambiguous: WorkEvent = {
      ...base,
      type: 'comment.created',
      comment,
      hydrateRef: 'ref',
    };
    expect([missingCallback, missingContent, ambiguous]).toHaveLength(3);
  });
});
