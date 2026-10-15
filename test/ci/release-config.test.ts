import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const config = require('../../release.config.cjs') as {
  plugins: (string | [string, { assets?: string[]; message?: string }])[];
};
const gitPlugin = config.plugins.find(
  (plugin): plugin is [string, { assets: string[]; message: string }] =>
    Array.isArray(plugin) && plugin[0] === '@semantic-release/git',
);
const gitRequire = createRequire(require.resolve('@semantic-release/git'));
const { template } = gitRequire('lodash') as {
  template: (
    message: string,
  ) => (context: { nextRelease: { version: string; notes: string } }) => string;
};

function lint(message: string) {
  return spawnSync(
    process.execPath,
    [
      require.resolve('@commitlint/cli/cli.js'),
      '--config',
      'commitlint.config.ts',
    ],
    { cwd: process.cwd(), input: message, encoding: 'utf8' },
  );
}

describe('release commit configuration', () => {
  it('passes commit hooks even when generated notes have a long line', () => {
    if (!gitPlugin) throw new Error('Git release plugin is missing');
    const options = gitPlugin[1];
    const notes = 'Generated release note with a long description. '.repeat(5);
    const message = template(options.message)({
      nextRelease: { version: '2.1.0-beta.1', notes },
    });

    const result = lint(message);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(message).toBe('chore(release): 2.1.0-beta.1 [skip ci]');
    expect(options.assets).toEqual(['package.json', 'CHANGELOG.md']);
    expect(config.plugins).toContain('@semantic-release/changelog');
    expect(config.plugins).toContain('@semantic-release/github');

    const longBody = lint(`chore(release): 2.1.0-beta.1 [skip ci]\n\n${notes}`);
    expect(longBody.status).toBe(1);
    expect(longBody.stdout).toContain('body-max-line-length');
  });
});
