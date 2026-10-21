import { describe, expect, expectTypeOf, it } from 'vitest';
import type {
  ReviewAttachmentDescriptor,
  ReviewThreadSource,
  TappifyHandlerOptions,
  WorkCreateInput,
  WorkItemLinkResult,
  WorkMention,
  WorkOperation,
  WorkOperationMap,
  WorkPerson,
  WorkRichTextSegment,
} from '../../src/server';
import { createTestClient } from '../../src/testing/client';

const mutation = {
  idempotencyKey: 'thread_1:create',
  occurredAt: '2026-10-15T12:00:00Z',
};
const linked = {
  threadId: 'thread_1',
  linkId: 'link_1',
  externalItemId: 'item_1',
};
const screenshot: ReviewAttachmentDescriptor = {
  kind: 'image',
  attachmentId: 'attachment_1',
  url: 'https://storage.test/temporary-screenshot',
  mediaType: 'image/png',
  fileName: 'review.png',
};
const source: ReviewThreadSource = {
  threadId: 'thread_1',
  projectId: 'project_1',
  appId: 'app_1',
  buildVersion: '1.0',
  buildNumber: '42',
  screenId: 'screen_1',
  screenName: 'Checkout',
  pin: { x: 0.25, y: 0.75 },
  firstComment: {
    id: 'comment_1',
    body: 'Button is clipped',
    author: { id: 'user_1', displayName: 'Sam', email: 'sam@example.com' },
    mentions: [
      {
        person: { id: 'user_2', displayName: 'Ada', email: 'ada@example.com' },
      },
    ],
    authorDisplayName: 'Sam',
    createdAt: mutation.occurredAt,
  },
  device: { model: 'Phone', osVersion: '26', width: 390 },
  deepLink: 'https://tappify.test/review/thread_1',
  screenshot,
};
const createInput: WorkCreateInput = {
  ...mutation,
  containerId: 'container_1',
  itemTypeId: 'issue',
  fields: {
    title: 'Button is clipped',
    priority: 2,
    labels: ['review'],
    assigned: false,
    due: null,
  },
  source,
};
const item: WorkItemLinkResult = {
  externalItemId: 'item_1',
  displayKey: 'ENG-42',
  url: 'https://provider.test/items/42',
  title: 'Button is clipped',
  status: { id: 'todo', label: 'To do', stage: 'open' },
  providerVersion: 'v1',
  updatedAt: mutation.occurredAt,
};

const cases = {
  configure: {
    input: {
      ...mutation,
      callbackUrl: 'https://tappify.test/work/hooks',
      secret: 'secret',
      generation: 2,
      configurationRevision: 3,
      containerId: 'container_1',
      itemTypeId: 'issue',
      fields: {},
      openStatusId: 'todo',
      resolvedStatusId: 'done',
      commentsEnabled: true,
    },
    output: {
      generation: 2,
      configurationRevision: 3,
      registeredWebhookIds: ['webhook_1'],
    },
  },
  list_containers: {
    input: { cursor: 'next' },
    output: {
      containers: [{ id: 'container_1', label: 'Engineering' }],
      cursor: null,
    },
  },
  describe_container: {
    input: { containerId: 'container_1' },
    output: {
      container: { id: 'container_1', label: 'Engineering' },
      itemTypes: [{ id: 'issue', label: 'Issue' }],
      createFields: [
        { id: 'title', label: 'Title', type: 'string', required: true },
      ],
      statuses: [{ id: 'todo', label: 'To do', stage: 'open' }],
    },
  },
  create: { input: createInput, output: item },
  attach: {
    input: { ...mutation, ...linked, attachment: screenshot },
    output: { externalAttachmentId: 'attachment_2' },
  },
  comment: {
    input: {
      ...mutation,
      ...linked,
      commentId: 'comment_2',
      body: 'Still clipped',
      author: { id: 'user_1', displayName: 'Sam', email: 'sam@example.com' },
      mentions: [
        {
          person: {
            id: 'user_2',
            displayName: 'Ada',
            email: 'ada@example.com',
          },
        },
      ],
      authorDisplayName: 'Sam',
      createdAt: mutation.occurredAt,
    },
    output: { externalCommentId: 'comment_3', createdAt: mutation.occurredAt },
  },
  set_status: {
    input: {
      ...mutation,
      ...linked,
      tappifyStatus: 'resolved',
      providerStatusId: 'done',
    },
    output: {
      status: { id: 'done', label: 'Done', stage: 'done' },
      providerVersion: 'v2',
    },
  },
  hydrate_event: {
    input: { ...linked, hydrateRef: 'opaque_1' },
    output: {
      event: {
        type: 'status.changed',
        externalItemId: 'item_1',
        providerEventId: 'evt_1',
        dedupeKey: 'provider:evt_1',
        occurredAt: mutation.occurredAt,
        status: { id: 'done', label: 'Done', stage: 'done' },
      },
    },
  },
  disconnect: {
    input: { ...mutation, generation: 2, registeredWebhookIds: ['webhook_1'] },
    output: { removedWebhookIds: ['webhook_1'] },
  },
} satisfies WorkOperationMap;

describe('work wire types', () => {
  it('supports structured people without email in outbound comments and rich text', () => {
    const person: WorkPerson = { id: 'user_2', displayName: 'Ada' };
    const mention: WorkMention = { person };
    const firstComment: ReviewThreadSource['firstComment'] = {
      ...source.firstComment,
      author: person,
      mentions: [mention],
    };
    const input: WorkOperationMap['comment']['input'] = {
      ...cases.comment.input,
      author: person,
      mentions: [mention],
    };
    const segments: WorkRichTextSegment[] = [
      { type: 'text', text: 'Ask ' },
      { type: 'user_mention', person, fallback: '@Ada' },
    ];

    expectTypeOf(firstComment.author).toEqualTypeOf<WorkPerson>();
    expectTypeOf(input.mentions).toEqualTypeOf<WorkMention[]>();
    expectTypeOf(segments).toEqualTypeOf<WorkRichTextSegment[]>();
  });

  it('round trips all nine typed operations through the real test client', async () => {
    const work: NonNullable<TappifyHandlerOptions['work']> = {
      configure: () => cases.configure.output,
      list_containers: () => cases.list_containers.output,
      describe_container: () => cases.describe_container.output,
      create: request => ({
        ...item,
        title: request.input.source.firstComment.body,
      }),
      attach: () => cases.attach.output,
      comment: () => cases.comment.output,
      set_status: () => cases.set_status.output,
      hydrate_event: () => cases.hydrate_event.output,
      disconnect: () => cases.disconnect.output,
    };
    const client = createTestClient({ extensionId: 'starter', work });

    const created = await client.work('create', createInput);
    expectTypeOf(created).toEqualTypeOf<WorkItemLinkResult>();
    expect(created).toEqual(item);
    expect(await client.work('configure', cases.configure.input)).toEqual(
      cases.configure.output,
    );
    expect(
      await client.work('list_containers', cases.list_containers.input),
    ).toEqual(cases.list_containers.output);
    expect(
      await client.work('describe_container', cases.describe_container.input),
    ).toEqual(cases.describe_container.output);
    expect(await client.work('attach', cases.attach.input)).toEqual(
      cases.attach.output,
    );
    expect(await client.work('comment', cases.comment.input)).toEqual(
      cases.comment.output,
    );
    expect(await client.work('set_status', cases.set_status.input)).toEqual(
      cases.set_status.output,
    );
    expect(
      await client.work('hydrate_event', cases.hydrate_event.input),
    ).toEqual(cases.hydrate_event.output);
    expect(await client.work('disconnect', cases.disconnect.input)).toEqual(
      cases.disconnect.output,
    );
  });

  it('excludes legacy routes from the current operation union', () => {
    expectTypeOf<WorkOperation>().toEqualTypeOf<
      | 'configure'
      | 'list_containers'
      | 'describe_container'
      | 'create'
      | 'attach'
      | 'comment'
      | 'set_status'
      | 'hydrate_event'
      | 'disconnect'
    >();
  });
});

// Compile-time assertions are checked by pnpm type-check, never executed.
function invalidWorkContracts(
  client: ReturnType<typeof createTestClient>,
): void {
  // @ts-expect-error create needs a Review source and the destination configuration.
  void client.work('create', { ...mutation, externalItemId: 'item_1' });
  // @ts-expect-error current operations must be known.
  void client.work('archive', {});
  // @ts-expect-error create field values cannot contain arbitrary nested objects.
  const invalidFields: WorkCreateInput['fields'] = { title: { nested: true } };
  const invalidOutput: TappifyHandlerOptions['work'] = {
    // @ts-expect-error create output needs stable external item identity and metadata.
    create: () => ({ id: 'item_1' }),
  };
  // @ts-expect-error post-create mutations need a durable link id.
  const invalidComment: WorkOperationMap['comment']['input'] = {
    ...mutation,
    threadId: 'thread_1',
    externalItemId: 'item_1',
    commentId: 'comment_1',
    body: 'Hi',
    author: { id: 'user_1', displayName: 'Sam' },
    mentions: [],
    authorDisplayName: 'Sam',
    createdAt: mutation.occurredAt,
  };
  // @ts-expect-error a mutation needs its logical idempotency key.
  const invalidStatus: WorkOperationMap['set_status']['input'] = {
    occurredAt: mutation.occurredAt,
    ...linked,
    tappifyStatus: 'resolved',
    providerStatusId: 'done',
  };
  // @ts-expect-error a mutation needs its occurrence time.
  const invalidDisconnect: WorkOperationMap['disconnect']['input'] = {
    idempotencyKey: 'disconnect',
    generation: 2,
    registeredWebhookIds: [],
  };
  const { author: omittedAuthor, ...withoutAuthor } = source.firstComment;
  // @ts-expect-error first comments require a structured author.
  const missingAuthor: ReviewThreadSource['firstComment'] = withoutAuthor;
  const { mentions: omittedMentions, ...withoutMentions } = cases.comment.input;
  // @ts-expect-error outbound comments require explicit mentions, including an empty array.
  const missingMentions: WorkOperationMap['comment']['input'] = withoutMentions;
  void [
    invalidFields,
    invalidOutput,
    invalidComment,
    invalidStatus,
    invalidDisconnect,
    omittedAuthor,
    missingAuthor,
    omittedMentions,
    missingMentions,
  ];
}
void invalidWorkContracts;
