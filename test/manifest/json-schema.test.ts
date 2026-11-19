import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHAT_DESTINATION_MODES,
  CRASHES_OPERATIONS,
  EVENTS,
  KEYWORD_DATA_OPERATIONS,
  KEYWORD_DATA_PLATFORMS,
  SCOPE_KEYS,
} from '../../src/manifest/constants';
import { manifestJsonSchema } from '../../src/manifest/schema';

const published: unknown = JSON.parse(
  readFileSync(resolve(__dirname, '../../schema/extension-v2.json'), 'utf8'),
);

describe('schema/extension-v2.json', () => {
  it('matches what the Zod schema generates', () => {
    expect(published).toEqual(manifestJsonSchema());
  });

  it('describes the manifest an editor validates', () => {
    const document = manifestJsonSchema();
    const properties = document.properties;

    expect(document.$id).toBe('https://schema.tappify.ai/extension/v2.json');
    expect(properties).toBeTypeOf('object');
    expect(Object.keys(properties as Record<string, unknown>)).toContain(
      'contributes',
    );
    expect(document.additionalProperties).toBe(false);
  });

  it('publishes the event catalogue an editor completes', () => {
    const document: unknown = manifestJsonSchema();
    const events = readPath(document, [
      'properties',
      'server',
      'properties',
      'events',
      'items',
      'enum',
    ]);

    expect(events).toEqual(EVENTS);
  });

  it('publishes the ad network block an editor validates', () => {
    const ads = readPath(manifestJsonSchema(), [
      'properties',
      'contributes',
      'properties',
      'ads',
    ]);

    expect(readPath(ads, ['required'])).toEqual([
      'auth',
      'sync',
      'acquisition',
    ]);
    expect(readPath(ads, ['properties', 'sync', 'enum'])).toEqual([
      '15m',
      '1h',
      '6h',
      '24h',
    ]);
  });

  it('publishes the keyword data block and a scope cap that fits every scope', () => {
    const document: unknown = manifestJsonSchema();
    const keywordData = readPath(document, [
      'properties',
      'contributes',
      'properties',
      'keywordData',
    ]);

    expect(readPath(keywordData, ['required'])).toEqual([
      'supports',
      'platforms',
    ]);
    expect(
      readPath(keywordData, ['properties', 'supports', 'items', 'enum']),
    ).toEqual(KEYWORD_DATA_OPERATIONS);
    expect(
      readPath(keywordData, ['properties', 'platforms', 'items', 'enum']),
    ).toEqual(KEYWORD_DATA_PLATFORMS);
    expect(readPath(document, ['properties', 'scopes', 'maxItems'])).toBe(
      SCOPE_KEYS.length,
    );
  });

  it('publishes the crashes block an editor validates', () => {
    const crashes = readPath(manifestJsonSchema(), [
      'properties',
      'contributes',
      'properties',
      'crashes',
    ]);

    expect(readPath(crashes, ['required'])).toEqual(['supports']);
    expect(
      readPath(crashes, ['properties', 'supports', 'items', 'enum']),
    ).toEqual(CRASHES_OPERATIONS);
    expect(readPath(crashes, ['properties', 'supports', 'maxItems'])).toBe(
      CRASHES_OPERATIONS.length,
    );
  });

  it('publishes the chat block an editor validates', () => {
    const chat = readPath(manifestJsonSchema(), [
      'properties',
      'contributes',
      'properties',
      'chat',
    ]);

    expect(readPath(chat, ['required'])).toEqual(['auth', 'destination']);
    expect(readPath(chat, ['properties', 'destination', 'enum'])).toEqual(
      CHAT_DESTINATION_MODES,
    );
    expect(
      readPath(chat, ['properties', 'auth', 'properties', 'method', 'const']),
    ).toBe('oauth');
  });

  it('publishes optional connector token encoding with form omission behavior', () => {
    const oauth = readPath(manifestJsonSchema(), [
      'properties',
      'contributes',
      'properties',
      'connector',
      'properties',
      'auth',
      'properties',
      'oauth',
    ]);
    const encoding = readPath(oauth, ['properties', 'tokenRequestEncoding']);

    expect(readPath(encoding, ['type'])).toBe('string');
    expect(readPath(encoding, ['enum'])).toEqual(['form', 'json']);
    expect(readPath(encoding, ['description'])).toMatch(/omitted.*form/i);
    expect(readPath(oauth, ['required'])).not.toContain('tokenRequestEncoding');
    expect(encoding).not.toHaveProperty('default');
  });
});

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
