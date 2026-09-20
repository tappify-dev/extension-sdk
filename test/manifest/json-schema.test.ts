import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENTS } from '../../src/manifest/constants';
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
});

function readPath(value: unknown, path: string[]): unknown {
  return path.reduce<unknown>((current, key) => {
    if (typeof current !== 'object' || current === null) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}
