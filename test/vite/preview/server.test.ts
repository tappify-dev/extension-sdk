import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  build,
  createServer,
  type Plugin,
  type ViteDevServer,
} from '../../../node_modules/vite/dist/node/index.js';
import { tappifyExtension } from '../../../src/vite/plugin';

const fixtureRoot = resolve(__dirname, '../../fixtures/extension');
const sdkEntry = resolve(__dirname, '../../../src/index.ts');
const sdkStyles = resolve(__dirname, '../../../src/client/ui/styles.css');
const sourceSdkExports: Plugin = {
  name: 'test:source-sdk-exports',
  enforce: 'pre',
  resolveId(id) {
    if (id === '@tappify/extension-sdk') return sdkEntry;
    if (id === '@tappify/extension-sdk/styles.css') return sdkStyles;
    if (id === '@tappify/extension-sdk/styles.css?inline') {
      return `${sdkStyles}?inline`;
    }
    return null;
  },
};
const servers: ViteDevServer[] = [];
let previousTestOverride: string | undefined;

beforeAll(() => {
  previousTestOverride = process.env.MFE_VITE_NO_TEST_ENV_CHECK;
  process.env.MFE_VITE_NO_TEST_ENV_CHECK = 'true';
});

afterAll(() => {
  if (previousTestOverride === undefined) {
    delete process.env.MFE_VITE_NO_TEST_ENV_CHECK;
  } else {
    process.env.MFE_VITE_NO_TEST_ENV_CHECK = previousTestOverride;
  }
});

afterEach(async () => {
  await Promise.all(servers.splice(0).map(server => server.close()));
});

async function listen(root: string, manifest?: Record<string, unknown>) {
  const server = await createServer({
    root,
    logLevel: 'silent',
    plugins: tappifyExtension({ root, port: 0, manifest: manifest as never }),
  });
  servers.push(server);
  await server.listen();
  const address = server.httpServer?.address();
  if (
    address === null ||
    typeof address === 'string' ||
    address === undefined
  ) {
    throw new Error('Vite did not expose its loopback port');
  }
  return `http://127.0.0.1:${String(address.port)}`;
}

function filesBelow(root: string, directory = root): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? filesBelow(root, path)
      : [path.slice(root.length + 1)];
  });
}

describe('local preview Vite server', () => {
  it('serves the preview document and federation remote from one loopback server', async () => {
    const origin = await listen(fixtureRoot);

    const preview = await fetch(`${origin}/`);
    const remote = await fetch(`${origin}/remoteEntry.js`);
    const html = await preview.text();

    expect(preview.status).toBe(200);
    expect(html).toContain('virtual:tappify-preview/client');
    expect(html).toContain('/@vite/client');
    expect(remote.status).toBe(200);
    expect(await remote.text()).toContain('fixture_lab');
  });

  it('renders manifest validation issues at root instead of a blank page', async () => {
    const invalid = {
      id: 'Bad Id',
      name: 'x',
      description: 'short',
      icon: 'icon.svg',
      category: 'product_analytics',
      sdk: '^2.0.0',
      visibility: 'private',
      installScope: 'project',
      scopes: [],
      contributes: {},
    };
    const origin = await listen(fixtureRoot, invalid);

    const response = await fetch(`${origin}/`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('Manifest is invalid');
    expect(html).toContain('id');
    expect(html).toContain('description');

    await expect(
      build({
        root: fixtureRoot,
        logLevel: 'silent',
        plugins: tappifyExtension({
          root: fixtureRoot,
          manifest: invalid as never,
        }),
      }),
    ).rejects.toMatchObject({ code: 'TAP_MANIFEST_INVALID' });
  });

  it('keeps the preview document and fixture runtime out of extension builds', async () => {
    const output = mkdtempSync(join(tmpdir(), 'tappify-preview-build-'));
    await build({
      root: fixtureRoot,
      logLevel: 'silent',
      plugins: [sourceSdkExports, ...tappifyExtension({ root: fixtureRoot })],
      // A published SDK resolves this export to dist/styles.css. The source
      // checkout has not been built in a clean test job, so model the package
      // root and stylesheet exports from source instead of relying on stale
      // local dist.
      build: { outDir: output, emptyOutDir: true },
    });

    const files = filesBelow(output);
    const emitted = files
      .filter(file => /\.(?:js|html)$/.test(file))
      .map(file => readFileSync(join(output, file), 'utf8'))
      .join('\n');

    expect(files.some(file => file.endsWith('.html'))).toBe(false);
    expect(emitted).not.toContain('Fixture data');
    expect(emitted).not.toContain('mountLocalPreview');
  });

  it('shows an unsafe remote as a startup diagnostic', async () => {
    const previous = process.env.TAPPIFY_PREVIEW_REMOTE;
    process.env.TAPPIFY_PREVIEW_REMOTE =
      'http://preview.example.com/remoteEntry.js';
    try {
      const origin = await listen(fixtureRoot);
      const response = await fetch(`${origin}/`);
      expect(await response.text()).toContain(
        'A preview remote must use HTTPS or loopback HTTP.',
      );
    } finally {
      if (previous === undefined) delete process.env.TAPPIFY_PREVIEW_REMOTE;
      else process.env.TAPPIFY_PREVIEW_REMOTE = previous;
    }
  });
});
