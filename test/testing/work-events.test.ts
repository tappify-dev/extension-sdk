import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  signedWorkEventRequest,
  workCommentCreatedFixture,
  workItemDeletedFixture,
  workStatusChangedFixture,
} from '../../src/testing';

const options = {
  callbackUrl: 'https://host.test/provisioned/work?generation=2',
  secret: 'test-install-secret',
};

describe('work event fixtures', () => {
  it('exports fresh complete comment events with deterministic identity and overrides', () => {
    expect(workCommentCreatedFixture).toBeTypeOf('function');
    const first = workCommentCreatedFixture();
    expect(first).toEqual({
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
    });
    first.comment.author.displayName = 'Changed';
    expect(workCommentCreatedFixture().comment.author.displayName).toBe('Sam');
    expect(
      workCommentCreatedFixture({ dedupeKey: 'retry-key' }).dedupeKey,
    ).toBe('retry-key');
  });

  it('exports fresh complete status events and honors supplied normalized status', () => {
    expect(workStatusChangedFixture).toBeTypeOf('function');
    expect(workStatusChangedFixture()).toEqual({
      type: 'status.changed',
      externalItemId: 'item_test',
      providerEventId: 'event_status_test',
      occurredAt: '2026-10-15T12:00:00.000Z',
      dedupeKey: 'item_test:event_status_test',
      status: { id: 'resolved_test', label: 'Resolved', stage: 'done' },
    });
    const first = workStatusChangedFixture();
    first.status.id = 'changed';
    expect(workStatusChangedFixture().status.id).toBe('resolved_test');
    expect(
      workStatusChangedFixture({
        status: { id: 'open', label: 'Open', stage: 'open' },
      }).status,
    ).toEqual({ id: 'open', label: 'Open', stage: 'open' });
  });

  it('exports deletion events with deterministic defaults and identity overrides', () => {
    expect(workItemDeletedFixture).toBeTypeOf('function');
    expect(workItemDeletedFixture()).toEqual({
      type: 'item.deleted',
      externalItemId: 'item_test',
      providerEventId: 'event_deleted_test',
      occurredAt: '2026-10-15T12:00:00.000Z',
      dedupeKey: 'item_test:event_deleted_test',
    });
    expect(
      workItemDeletedFixture({ externalItemId: 'item_other' }).externalItemId,
    ).toBe('item_other');
  });

  it.each([
    () => workCommentCreatedFixture(),
    () => workStatusChangedFixture(),
    () => workItemDeletedFixture(),
    () => ({
      type: 'comment.created' as const,
      externalItemId: 'item_opaque',
      providerEventId: 'event_opaque',
      occurredAt: '2026-10-15T13:00:00.000Z',
      dedupeKey: 'opaque-retry',
      hydrateRef: 'opaque-ref',
    }),
  ])(
    'creates a real signed sender request for each event shape',
    async fixture => {
      expect(signedWorkEventRequest).toBeTypeOf('function');
      const request = await signedWorkEventRequest(fixture(), options);
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toBe(options.callbackUrl);
      expect(request.method).toBe('POST');
      expect(request.headers.get('content-type')).toBe('application/json');
      const body = await request.text();
      expect(request.headers.get('x-tappify-signature')).toBe(
        createHmac('sha256', 'test-install-secret').update(body).digest('hex'),
      );
      expect(JSON.parse(body).dedupeKey).toBe(fixture().dedupeKey);
    },
  );

  it('signs the literal deletion body and rejects incomplete fixture input through the sender', async () => {
    expect(signedWorkEventRequest).toBeTypeOf('function');
    const request = await signedWorkEventRequest(
      workItemDeletedFixture(),
      options,
    );
    const expectedBody =
      '{"type":"item.deleted","externalItemId":"item_test","providerEventId":"event_deleted_test","occurredAt":"2026-10-15T12:00:00.000Z","dedupeKey":"item_test:event_deleted_test"}';
    expect(await request.text()).toBe(expectedBody);
    expect(request.headers.get('x-tappify-signature')).toBe(
      createHmac('sha256', 'test-install-secret')
        .update(expectedBody)
        .digest('hex'),
    );
    await expect(
      signedWorkEventRequest(
        { ...workCommentCreatedFixture(), comment: undefined } as never,
        options,
      ),
    ).rejects.toThrow(/work event/i);
  });
});
