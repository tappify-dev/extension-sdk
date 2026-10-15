import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Step {
  name?: string;
  uses?: string;
  with?: Record<string, unknown>;
  env?: Record<string, string>;
  run?: string;
}

interface Job {
  uses?: string;
  needs?: string | string[];
  if?: string;
  permissions?: Record<string, string>;
  steps?: Step[];
  strategy?: { matrix: Record<string, unknown[]> };
}

interface Workflow {
  on: Record<string, unknown>;
  permissions?: Record<string, string>;
  jobs: Record<string, Job>;
}

// Use the YAML loader already provided by semantic-release's config dependency.
const require = createRequire(import.meta.url);
const releaseRequire = createRequire(require.resolve('semantic-release'));
const { cosmiconfigSync } = releaseRequire('cosmiconfig') as {
  cosmiconfigSync: (name: string) => {
    load: (path: string) => { config: Workflow };
  };
};
const loadWorkflow = (name: string) =>
  cosmiconfigSync('workflow').load(resolve('.github/workflows', name)).config;

describe('release workflow provenance', () => {
  it('releases native branch pushes only after the complete reusable CI workflow', () => {
    const release = loadWorkflow('release.yml');
    const ci = loadWorkflow('ci.yml');

    expect(release.on).toEqual({ push: { branches: ['main', 'develop'] } });
    expect(ci.on).toEqual({
      pull_request: { branches: ['main', 'develop'] },
      workflow_call: null,
    });
    expect(release.jobs.ci.uses).toBe('./.github/workflows/ci.yml');
    expect(release.jobs.ci.if).toBeUndefined();
    expect([release.jobs.release.needs].flat()).toEqual(['ci']);
    expect(release.jobs.release.if).toBeUndefined();
    expect(Object.keys(ci.jobs).sort()).toEqual([
      'build',
      'commitlint',
      'lint',
      'spellcheck',
      'test',
    ]);
    expect(ci.jobs.test.strategy?.matrix).toEqual({
      'node-version': [20, 22, 24],
      os: ['ubuntu-latest', 'windows-latest'],
    });
    expect(ci.jobs.build.needs).toEqual(['lint', 'test', 'spellcheck']);
    expect(ci.jobs.commitlint.if).toBe("github.event_name == 'pull_request'");
    const ciCommands = Object.values(ci.jobs)
      .flatMap(job => job.steps ?? [])
      .map(step => step.run);
    for (const command of [
      'pnpm lint',
      'pnpm format:check',
      'pnpm test',
      'pnpm spellcheck',
      'pnpm type-check',
      'pnpm build',
      'pnpm docs:examples',
      'pnpm docs:validate',
    ]) {
      expect(ciCommands).toContain(command);
    }
  });

  it('keeps publishing in the native workflow with isolated OIDC permissions', () => {
    const release = loadWorkflow('release.yml');
    const ci = loadWorkflow('ci.yml');
    expect(release.permissions).toBeUndefined();
    expect(release.jobs.ci.permissions).toEqual({ contents: 'read' });
    expect(release.jobs.release.permissions).toEqual({
      contents: 'write',
      issues: 'write',
      'pull-requests': 'write',
      'id-token': 'write',
    });
    expect(ci.permissions).toEqual({ contents: 'read' });
    const steps = release.jobs.release.steps ?? [];
    const checkout = steps.find(step => step.uses === 'actions/checkout@v4');
    expect(checkout?.with).toEqual({
      'fetch-depth': 0,
      ref: '${{ github.sha }}',
    });
    const prepare = steps.find(
      step => step.name === 'Prepare release branches',
    );
    expect(prepare?.env).toEqual({
      RELEASE_BRANCH: '${{ github.ref_name }}',
      RELEASE_SHA: '${{ github.sha }}',
    });
    const publish = steps.find(step => step.name === 'Release');
    expect(publish?.run).toBe('npx semantic-release');
    expect(publish?.env).toEqual({
      GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}',
    });
    const configuration = JSON.stringify([release, ci]);
    expect(configuration).not.toMatch(/workflow_run|GITHUB_REF|GITHUB_SHA/);
    expect(configuration).not.toMatch(/NPM_TOKEN|NODE_AUTH_TOKEN/);
  });
});
