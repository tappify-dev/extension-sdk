import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as entry from '../../src/testing/server';

const ENTRY = resolve(__dirname, '../../src/testing/server.ts');
const REACT_SPECIFIERS = [
  'react',
  'react-dom',
  'react/jsx-runtime',
  '@tanstack/react-query',
  '@testing-library/react',
];

function resolveRelative(from: string, specifier: string): string {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    resolve(base, 'index.ts'),
    resolve(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot resolve ${specifier} from ${from}`);
}

function bareSpecifiers(start: string): Set<string> {
  const seen = new Set<string>();
  const bare = new Set<string>();
  const queue = [start];
  const pattern =
    /^\s*(import|export)\s+(type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
  while (queue.length > 0) {
    const file = queue.pop();
    if (file === undefined || seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith('.tsx')) bare.add('react/jsx-runtime');
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(pattern)) {
      if (match[2] !== undefined) continue;
      const specifier = match[3];
      if (specifier.startsWith('./') || specifier.startsWith('../')) {
        queue.push(resolveRelative(file, specifier));
      } else {
        bare.add(specifier);
      }
    }
  }
  return bare;
}

describe('@tappify/extension-sdk/testing/server', () => {
  it('exports the server validators', () => {
    expect(Object.keys(entry)).toEqual(
      expect.arrayContaining([
        'validateMetricsResponse',
        'validateToolResponse',
        'validateAdsSyncResponse',
        'validateKeywordMetricsResult',
        'validateKeywordSuggestionsResult',
        'validateCrashGroupsResult',
        'validateCrashDetails',
        'validateChatConnectResponse',
        'validateChatDestinationsResponse',
        'validateChatMessageResponse',
        'validateChatDisconnectResponse',
      ]),
    );
  });

  it('has no React in its module graph', () => {
    const bare = bareSpecifiers(ENTRY);
    for (const specifier of REACT_SPECIFIERS) {
      expect(bare).not.toContain(specifier);
    }
  });
});
