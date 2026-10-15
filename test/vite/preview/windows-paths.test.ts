import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { posix, resolve, win32 } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import type { optimizedReactUrl } from '../../../src/vite/preview/plugin';

// Run the actual source with Node's Windows paths and Vite's Windows normalization.
const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(
  readFileSync(
    resolve(__dirname, '../../../src/vite/preview/plugin.ts'),
    'utf8',
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
);
const exports = {} as { optimizedReactUrl: typeof optimizedReactUrl };
runInNewContext(outputText, {
  exports,
  require: (id: string) => {
    if (id === 'node:path') return win32;
    if (id === 'vite') {
      return {
        normalizePath: (path: string) =>
          posix.normalize(path.replace(/\\/g, '/')),
      };
    }
    return require(id);
  },
});

describe('optimizedReactUrl with Windows paths', () => {
  it.each([
    ['D:/extension/.cache', '/.cache/deps/react.js?tappify=generation-one'],
    [
      'D:/shared/cache',
      '/@fs/D:/shared/cache/deps/react.js?tappify=generation-one',
    ],
    [
      'C:/Users/runner/cache',
      '/@fs/C:/Users/runner/cache/deps/react.js?tappify=generation-one',
    ],
  ])('addresses the configured cache at %s', (cacheDir, expected) => {
    expect(
      exports.optimizedReactUrl('D:/extension', cacheDir, 'generation-one'),
    ).toBe(expected);
  });
});
