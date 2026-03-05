/**
 * Semantic Release Configuration
 * @see https://semantic-release.gitbook.io/semantic-release/usage/configuration
 */
module.exports = {
  branches: ['main', { name: 'develop', prerelease: 'beta', channel: 'beta' }],
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        releaseRules: [
          { type: 'feat', release: 'minor' },
          { type: 'fix', release: 'patch' },
          { type: 'perf', release: 'patch' },
          { type: 'improve', release: 'patch' },
          { type: 'cont', release: 'patch' },
          { type: 'refactor', release: 'patch' },
          { type: 'revert', release: 'patch' },
          { type: 'docs', release: false },
          { type: 'style', release: false },
          { type: 'chore', release: false },
          { type: 'ci', release: false },
          { type: 'build', release: false },
          { type: 'test', release: false },
          { type: 'wip', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance' },
            { type: 'improve', section: 'Improvements' },
            { type: 'cont', section: 'Improvements' },
            { type: 'refactor', section: 'Refactoring' },
            { type: 'revert', section: 'Reverts' },
            { type: 'docs', section: 'Documentation', hidden: true },
            { type: 'style', section: 'Styles', hidden: true },
            { type: 'chore', section: 'Chores', hidden: true },
            { type: 'ci', section: 'CI/CD', hidden: true },
            { type: 'build', section: 'Build', hidden: true },
            { type: 'test', section: 'Tests', hidden: true },
            { type: 'wip', section: 'Work in Progress', hidden: true },
          ],
        },
      },
    ],
    '@semantic-release/changelog',
    [
      '@semantic-release/npm',
      {
        tarballDir: '.',
      },
    ],
    [
      '@semantic-release/github',
      {
        assets: ['*.tgz'],
      },
    ],
    [
      '@semantic-release/git',
      {
        assets: ['package.json', 'CHANGELOG.md'],
        message:
          'chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}',
      },
    ],
  ],
};
