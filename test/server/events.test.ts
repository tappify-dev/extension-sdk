import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { SERVER_ERROR_CODES } from '../../src/server/codes';
import { sendEvent, signWebhook } from '../../src/server/events';

describe('signWebhook', () => {
  it('produces the same HMAC-SHA256 hex the backend verifies', async () => {
    const body = '{"event":"anomaly.detected"}';
    const expected = createHmac('sha256', 'whsec_test')
      .update(body)
      .digest('hex');

    expect(await signWebhook('whsec_test', body)).toBe(expected);
  });
});

describe('sendEvent', () => {
  it('posts the spec envelope, signed, to the install hook', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 }));

    await sendEvent(
      'anomaly.detected',
      { why: 'Installs fell 40% in an hour', metric: 'installs' },
      {
        installId: 'ins_1',
        extensionId: 'funnel-lab',
        secret: 'whsec_test',
        dedupeKey: 'anomaly-2026-09-09',
        build: '4.2.0 (118)',
        occurredAt: '2026-09-09T10:00:00.000Z',
        fetch: fetchMock,
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.tappify.ai/api/v1/extensions/hooks/funnel-lab/ins_1',
    );

    const body: string = init.body;
    expect(JSON.parse(body)).toEqual({
      event: 'anomaly.detected',
      source: 'funnel-lab',
      occurredAt: '2026-09-09T10:00:00.000Z',
      build: '4.2.0 (118)',
      dedupeKey: 'anomaly-2026-09-09',
      payload: { why: 'Installs fell 40% in an hour', metric: 'installs' },
    });

    expect(init.headers['x-tappify-signature']).toBe(
      await signWebhook('whsec_test', body),
    );
    expect(init.headers['content-type']).toBe('application/json');
  });

  it('throws a coded error when Tappify rejects the delivery', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'SIGNATURE_INVALID' } }), {
        status: 401,
      }),
    );

    await expect(
      sendEvent(
        'anomaly.detected',
        { why: 'x' },
        {
          installId: 'ins_1',
          extensionId: 'funnel-lab',
          secret: 'wrong',
          fetch: fetchMock,
        },
      ),
    ).rejects.toMatchObject({
      name: 'TapServerError',
      code: SERVER_ERROR_CODES.WEBHOOK_REJECTED,
      status: 401,
      message: expect.stringContaining('SIGNATURE_INVALID'),
    });
  });

  it('still throws when the rejection body carries no code', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('gateway timeout', { status: 504 }));

    await expect(
      sendEvent(
        'anomaly.detected',
        { why: 'x' },
        {
          installId: 'ins_1',
          extensionId: 'funnel-lab',
          secret: 's',
          fetch: fetchMock,
        },
      ),
    ).rejects.toMatchObject({
      code: SERVER_ERROR_CODES.WEBHOOK_REJECTED,
      status: 504,
    });
  });

  it('honours an explicit endpoint and generates a dedupe key', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 202 }));

    await sendEvent(
      'anomaly.detected',
      { why: 'x' },
      {
        installId: 'ins_1',
        extensionId: 'funnel-lab',
        secret: 's',
        endpoint: 'https://staging.tappify.ai/api/v1/extensions/hooks/a/b',
        fetch: fetchMock,
      },
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://staging.tappify.ai/api/v1/extensions/hooks/a/b');
    const parsed: { dedupeKey: string } = JSON.parse(init.body);
    expect(parsed.dedupeKey).toHaveLength(36);
  });
});
