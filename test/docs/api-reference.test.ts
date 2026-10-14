import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

describe('API reference generation', () => {
  it('includes One UI exports without legacy UI symbols', () => {
    const docsRoot = mkdtempSync(join(tmpdir(), 'tappify-docs-'));
    temporaryRoots.push(docsRoot);
    writeFileSync(join(docsRoot, 'docs.json'), '{}\n');

    execFileSync(
      'pnpm',
      ['exec', 'tsx', 'scripts/build-api-reference.ts', docsRoot],
      { cwd: process.cwd(), stdio: 'pipe' },
    );

    const generated = JSON.parse(
      readFileSync(
        join(docsRoot, 'extensions/reference/_generated.json'),
        'utf8',
      ),
    ) as Record<string, string[]>;
    const frontendPages = generated['Frontend API'] ?? [];

    expect(frontendPages).toContain(
      'extensions/reference/frontend-api/Function.Button',
    );
    expect(frontendPages).toContain(
      'extensions/reference/frontend-api/Function.SchemaForm',
    );
    expect(frontendPages).not.toContain(
      'extensions/reference/frontend-api/Function.TapButton',
    );
    expect(frontendPages).not.toContain(
      'extensions/reference/frontend-api/Function.TapForm',
    );
  });
});
