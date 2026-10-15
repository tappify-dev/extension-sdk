import type {
  WorkHydratedCommentCreatedEvent,
  WorkHydratedItemDeletedEvent,
  WorkHydratedStatusChangedEvent,
} from '../server/work';
import {
  sendWorkEvent,
  type SendWorkEventOptions,
  type WorkEvent,
} from '../server/work-events';

/** A fresh complete comment signal with deterministic identity and shallow overrides. */
export function workCommentCreatedFixture(
  overrides: Partial<WorkHydratedCommentCreatedEvent> = {},
): WorkHydratedCommentCreatedEvent {
  return {
    type: 'comment.created',
    externalItemId: 'item_test',
    providerEventId: 'event_comment_test',
    occurredAt: '2026-10-15T12:00:00.000Z',
    dedupeKey: 'item_test:event_comment_test',
    comment: {
      externalCommentId: 'comment_test',
      body: 'A provider comment.',
      author: { id: 'author_test', displayName: 'Sam' },
      createdAt: '2026-10-15T12:00:00.000Z',
    },
    ...overrides,
  };
}

/** A fresh complete status signal with deterministic identity and shallow overrides. */
export function workStatusChangedFixture(
  overrides: Partial<WorkHydratedStatusChangedEvent> = {},
): WorkHydratedStatusChangedEvent {
  return {
    type: 'status.changed',
    externalItemId: 'item_test',
    providerEventId: 'event_status_test',
    occurredAt: '2026-10-15T12:00:00.000Z',
    dedupeKey: 'item_test:event_status_test',
    status: { id: 'resolved_test', label: 'Resolved', stage: 'done' },
    ...overrides,
  };
}

/** A fresh deletion signal with deterministic identity and shallow overrides. */
export function workItemDeletedFixture(
  overrides: Partial<WorkHydratedItemDeletedEvent> = {},
): WorkHydratedItemDeletedEvent {
  return {
    type: 'item.deleted',
    externalItemId: 'item_test',
    providerEventId: 'event_deleted_test',
    occurredAt: '2026-10-15T12:00:00.000Z',
    dedupeKey: 'item_test:event_deleted_test',
    ...overrides,
  };
}

/**
 * Captures a signed work-event Request through the real sender without network I/O.
 *
 * @remarks
 * Uses the same validation, serialization, signing and callback URL as
 * sendWorkEvent. Supply the callback and secret your test install was configured
 * with; the accepting transport is supplied by this helper.
 */
export async function signedWorkEventRequest(
  event: WorkEvent,
  options: Omit<SendWorkEventOptions, 'fetch'>,
): Promise<Request> {
  let request: Request | undefined;
  await sendWorkEvent(event, {
    ...options,
    fetch: (input, init) => {
      request = new Request(input, init);
      return Promise.resolve(new Response(null, { status: 202 }));
    },
  });
  if (!request)
    throw new Error('The work event sender did not produce a request.');
  return request;
}
