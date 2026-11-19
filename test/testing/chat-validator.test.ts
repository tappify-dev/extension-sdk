import { describe, expect, it } from 'vitest';
import type {
  ChatConnectResponse,
  ChatDestination,
  ChatDestinationsResponse,
  ChatDisconnectResponse,
  ChatMessageResponse,
} from '../../src/server';
import {
  validateChatConnectResponse,
  validateChatDestinationsResponse,
  validateChatDisconnectResponse,
  validateChatMessageResponse,
} from '../../src/testing';

const destination: ChatDestination = {
  externalId: 'T024BE7LD:C024BE91L',
  label: '#releases',
  url: 'https://app.slack.com/client/T024BE7LD/C024BE91L',
  config: { channel: 'C024BE91L' },
};

function connect(fields: Record<string, unknown>): unknown {
  return { destination: { ...destination, ...fields } };
}

describe('validateChatConnectResponse', () => {
  it('accepts a sound answer with and without url', () => {
    const answer: ChatConnectResponse = { destination };
    expect(validateChatConnectResponse(answer)).toEqual([]);
    const { url: _url, ...withoutUrl } = destination;
    expect(validateChatConnectResponse({ destination: withoutUrl })).toEqual(
      [],
    );
  });

  it('names the body shape', () => {
    for (const body of [null, [], {}, { destination: [] }]) {
      expect(validateChatConnectResponse(body)).toEqual([
        'A connect answer is { "destination": { "externalId": "...", "label": "...", "config": {...} } }.',
      ]);
    }
  });

  it('reports an externalId that is not a non-empty string', () => {
    expect(validateChatConnectResponse(connect({ externalId: '' }))).toEqual([
      'destination.externalId is "". Use the chat tool\'s own id for the channel, such as "T024BE7LD:C024BE91L".',
    ]);
    const { externalId: _externalId, ...withoutId } = destination;
    expect(validateChatConnectResponse({ destination: withoutId })).toEqual([
      'destination.externalId is missing. Use the chat tool\'s own id for the channel, such as "T024BE7LD:C024BE91L".',
    ]);
  });

  it('reports a label that is not a non-empty string', () => {
    expect(validateChatConnectResponse(connect({ label: 7 }))).toEqual([
      'destination.label is 7. A label is the name owners know the channel by, such as "#releases".',
    ]);
  });

  it('reports a url that is not an https link', () => {
    expect(
      validateChatConnectResponse(connect({ url: 'http://slack.com' })),
    ).toEqual([
      'destination.url is "http://slack.com". Use an https link to the channel, or leave it out.',
    ]);
    expect(validateChatConnectResponse(connect({ url: 42 }))).toEqual([
      'destination.url is 42. Use an https link to the channel, or leave it out.',
    ]);
  });

  it('reports config that is missing, null or an array', () => {
    const { config: _config, ...withoutConfig } = destination;
    expect(validateChatConnectResponse({ destination: withoutConfig })).toEqual(
      [
        'destination.config is missing. Return an object with what your server needs to post to this channel; Tappify stores it encrypted and sends it back on every call.',
      ],
    );
    expect(validateChatConnectResponse(connect({ config: null }))).toEqual([
      'destination.config is null. Return an object with what your server needs to post to this channel; Tappify stores it encrypted and sends it back on every call.',
    ]);
    expect(validateChatConnectResponse(connect({ config: [] }))).toEqual([
      'destination.config is []. Return an object with what your server needs to post to this channel; Tappify stores it encrypted and sends it back on every call.',
    ]);
  });

  it('reports an externalId over 255 characters', () => {
    expect(
      validateChatConnectResponse(connect({ externalId: 'a'.repeat(256) })),
    ).toEqual(['destination.externalId is 256 characters. Use at most 255.']);
    expect(
      validateChatConnectResponse(connect({ externalId: 'a'.repeat(255) })),
    ).toEqual([]);
  });

  it('reports a label over 200 characters', () => {
    expect(
      validateChatConnectResponse(connect({ label: 'a'.repeat(201) })),
    ).toEqual(['destination.label is 201 characters. Use at most 200.']);
    expect(
      validateChatConnectResponse(connect({ label: 'a'.repeat(200) })),
    ).toEqual([]);
  });

  it('reports a url over 2048 characters', () => {
    expect(
      validateChatConnectResponse(
        connect({ url: `https://${'a'.repeat(2041)}` }),
      ),
    ).toEqual(['destination.url is 2049 characters. Use at most 2048.']);
    expect(
      validateChatConnectResponse(
        connect({ url: `https://${'a'.repeat(2040)}` }),
      ),
    ).toEqual([]);
  });

  it('reports config over 16384 bytes as JSON', () => {
    expect(
      validateChatConnectResponse(
        connect({ config: { c: 'a'.repeat(16377) } }),
      ),
    ).toEqual([
      'destination.config is 16385 bytes. Keep it under 16384; store only what posting needs.',
    ]);
    expect(
      validateChatConnectResponse(
        connect({ config: { c: 'a'.repeat(16376) } }),
      ),
    ).toEqual([]);
  });
});

describe('validateChatDestinationsResponse', () => {
  it('accepts a sound answer with and without group', () => {
    const answer: ChatDestinationsResponse = {
      options: [
        { id: 'T024BE7LD:C024BE91L', label: '#releases', group: 'Acme' },
        { id: 'T024BE7LD:C024BE92M', label: '#general' },
      ],
    };
    expect(validateChatDestinationsResponse(answer)).toEqual([]);
    expect(validateChatDestinationsResponse({ options: [] })).toEqual([]);
  });

  it('names the body shape', () => {
    for (const body of [null, [], {}, { options: {} }]) {
      expect(validateChatDestinationsResponse(body)).toEqual([
        'A destinations answer is { "options": [...] }. Return the array, empty when the owner can reach no channel.',
      ]);
    }
  });

  it('refuses an option that is not an object', () => {
    expect(
      validateChatDestinationsResponse({ options: ['#releases'] }),
    ).toEqual([
      'options[0] is not an object. An option is { "id": "...", "label": "..." }.',
    ]);
  });

  it('reports an id that is not a non-empty string', () => {
    expect(
      validateChatDestinationsResponse({ options: [{ label: '#releases' }] }),
    ).toEqual([
      'options[0].id is missing. Use the chat tool\'s own id for the channel, such as "T024BE7LD:C024BE91L".',
    ]);
  });

  it('reports a label that is not a non-empty string', () => {
    expect(
      validateChatDestinationsResponse({ options: [{ id: 'C1', label: '' }] }),
    ).toEqual([
      'options[0].label is "". A label is the name owners know the channel by, such as "#releases".',
    ]);
  });

  it('reports a group that is not a non-empty string', () => {
    expect(
      validateChatDestinationsResponse({
        options: [{ id: 'C1', label: '#releases', group: '' }],
      }),
    ).toEqual([
      'options[0].group is "". Use the team or workspace name, or leave it out.',
    ]);
    expect(
      validateChatDestinationsResponse({
        options: [{ id: 'C1', label: '#releases', group: 7 }],
      }),
    ).toEqual([
      'options[0].group is 7. Use the team or workspace name, or leave it out.',
    ]);
  });

  it('reports an id returned twice', () => {
    expect(
      validateChatDestinationsResponse({
        options: [
          { id: 'C1', label: '#releases' },
          { id: 'C1', label: '#releases-2' },
        ],
      }),
    ).toEqual(['options[1] repeats "C1". Return each channel once.']);
  });

  it('reports more than 500 options', () => {
    const options = (count: number) =>
      Array.from({ length: count }, (_, index) => ({
        id: `C${String(index)}`,
        label: `#channel-${String(index)}`,
      }));
    expect(validateChatDestinationsResponse({ options: options(501) })).toEqual(
      ['The answer has 501 options. Return at most 500.'],
    );
    expect(validateChatDestinationsResponse({ options: options(500) })).toEqual(
      [],
    );
  });
});

describe('validateChatMessageResponse', () => {
  it('accepts a sound answer with and without reference', () => {
    const answer: ChatMessageResponse = {
      delivered: true,
      reference: '1503435956.000247',
    };
    expect(validateChatMessageResponse(answer)).toEqual([]);
    expect(validateChatMessageResponse({ delivered: true })).toEqual([]);
  });

  it('names the body shape', () => {
    for (const body of [null, [], 'ok']) {
      expect(validateChatMessageResponse(body)).toEqual([
        'A message answer is { "delivered": true }.',
      ]);
    }
  });

  it('reports a delivered that is not true', () => {
    expect(validateChatMessageResponse({ delivered: false })).toEqual([
      'delivered is false. Answer { "delivered": true } only once the message is posted; when it cannot be, throw a TapServerError with status 422 and DESTINATION_GONE or PROVIDER_CREDENTIALS_REJECTED, or let the error reach the handler.',
    ]);
    expect(validateChatMessageResponse({ delivered: 'true' })).toEqual([
      'delivered is "true". Answer { "delivered": true } only once the message is posted; when it cannot be, throw a TapServerError with status 422 and DESTINATION_GONE or PROVIDER_CREDENTIALS_REJECTED, or let the error reach the handler.',
    ]);
  });

  it('reports a reference that is not a string', () => {
    expect(
      validateChatMessageResponse({ delivered: true, reference: 42 }),
    ).toEqual([
      "reference is 42. Use the chat tool's id for the posted message as a string, or leave it out.",
    ]);
  });

  it('reports a reference over 255 characters', () => {
    expect(
      validateChatMessageResponse({
        delivered: true,
        reference: 'a'.repeat(256),
      }),
    ).toEqual(['reference is 256 characters. Use at most 255.']);
    expect(
      validateChatMessageResponse({
        delivered: true,
        reference: 'a'.repeat(255),
      }),
    ).toEqual([]);
  });
});

describe('validateChatDisconnectResponse', () => {
  it('accepts a sound answer', () => {
    const answer: ChatDisconnectResponse = { ok: true };
    expect(validateChatDisconnectResponse(answer)).toEqual([]);
  });

  it('names the body shape', () => {
    for (const body of [null, [], 'ok']) {
      expect(validateChatDisconnectResponse(body)).toEqual([
        'A disconnect answer is { "ok": true }.',
      ]);
    }
  });

  it('reports ok that is not true', () => {
    expect(validateChatDisconnectResponse({})).toEqual([
      'ok is missing. Answer { "ok": true } once the channel is cleaned up.',
    ]);
  });
});
