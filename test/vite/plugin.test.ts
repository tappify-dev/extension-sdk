import { resolve } from 'node:path';
import type { ConfigEnv, Plugin, UserConfig } from 'vite';
import { describe, expect, it, vi } from 'vitest';
import { TapError } from '../../src/client/errors';
import type { ExtensionManifest } from '../../src/manifest/types';
import {
  VIRTUAL_PREFIX,
  collectEntryStyles,
  federationOptionsOf,
  inlineCssImports,
  tappifyExtension,
  type TappifyExtensionOptions,
} from '../../src/vite/plugin';

const root = resolve(__dirname, '../fixtures/extension');

function pluginNamed(name: string, options: TappifyExtensionOptions = {}) {
  const plugins = tappifyExtension({ root, ...options });
  const found = plugins.find(plugin => plugin.name === name);
  if (!found) throw new Error(`no plugin named ${name}`);
  return found;
}

function isModuleHook(
  value: unknown,
): value is (id: string) => string | null | undefined {
  return typeof value === 'function';
}

function isTransformHook(
  value: unknown,
): value is (
  code: string,
  id: string,
) => { code: string; map: null } | null | undefined {
  return typeof value === 'function';
}

function isConfigHook(
  value: unknown,
): value is (config: UserConfig, env: ConfigEnv) => UserConfig {
  return typeof value === 'function';
}

interface HotUpdateThis {
  environment: { name: string };
}

function isHotUpdateHook(
  value: unknown,
): value is (this: HotUpdateThis, context: { file: string }) => Promise<void> {
  return typeof value === 'function';
}

function moduleHook(plugin: Plugin, name: 'resolveId' | 'load') {
  const hook: unknown = plugin[name];
  if (!isModuleHook(hook)) throw new Error(`${name} is not a function`);
  return hook;
}

function transformHook(plugin: Plugin) {
  const hook: unknown = plugin.transform;
  if (!isTransformHook(hook)) throw new Error('transform is not a function');
  return hook;
}

function surfaceManifest(): ExtensionManifest {
  return {
    id: 'surface-lab',
    name: 'Surface Lab',
    description: 'Contributes one of every exposable kind except settings.',
    icon: 'icon.svg',
    category: 'product_analytics',
    sdk: '^2.0.0',
    visibility: 'private',
    installScope: 'project',
    scopes: [{ key: 'ui:render' }],
    contributes: {
      pages: [{ id: 'funnel', title: 'Funnel', entry: 'src/pages/funnel.tsx' }],
      tabs: [
        {
          id: 'detail',
          title: 'Detail',
          entry: 'src/tabs/detail.tsx',
          page: 'analytics',
        },
      ],
      rowActions: [
        {
          id: 'flag',
          title: 'Flag',
          table: 'analytics.keywords',
          entry: 'src/rowActions/flag.tsx',
        },
      ],
    },
  };
}

describe('collectEntryStyles', () => {
  it('follows the entry’s own imports and keeps bare css specifiers', () => {
    const styles = collectEntryStyles(
      resolve(root, 'src/widgets/summary.tsx'),
      root,
    );

    expect(styles).toEqual([
      '@tappify/extension-sdk/styles.css',
      resolve(root, 'src/summary.css'),
    ]);
  });

  it('returns nothing for an entry with no stylesheet', () => {
    expect(collectEntryStyles(resolve(root, 'src/settings.tsx'), root)).toEqual(
      [],
    );
  });

  it('ignores imports that only appear inside a block comment', () => {
    expect(
      collectEntryStyles(resolve(root, 'src/widgets/commented.tsx'), root),
    ).toEqual([resolve(root, 'src/summary.css')]);
  });
});

describe('inlineCssImports', () => {
  it('rewrites plain stylesheet imports and leaves everything else alone', () => {
    const rewritten = inlineCssImports(
      [
        "import './plain.css';",
        "import styles from './card.module.css';",
        "import inlined from './already.css?inline';",
        "import { useTap } from '@tappify/extension-sdk';",
        "import '@tappify/extension-sdk/styles.css';",
      ].join('\n'),
    );

    expect(rewritten).toBe(
      [
        "import './plain.css?inline';",
        "import styles from './card.module.css';",
        "import inlined from './already.css?inline';",
        "import { useTap } from '@tappify/extension-sdk';",
        "import '@tappify/extension-sdk/styles.css?inline';",
      ].join('\n'),
    );
  });

  it('returns null when a module imports no plain stylesheet', () => {
    expect(inlineCssImports("import './card.module.css';")).toBeNull();
  });
});

describe('tappifyExtension', () => {
  it('names the remote and exposes one module per UI contribution', () => {
    const federationOptions = federationOptionsOf(tappifyExtension({ root }));

    expect(federationOptions.name).toBe('ext_fixture_lab');
    expect(federationOptions.filename).toBe('remoteEntry.js');
    expect(federationOptions.manifest).toBe(true);
    expect(Object.keys(federationOptions.exposes).sort()).toEqual([
      './settings',
      './widgets/summary',
    ]);
    expect(federationOptions.exposes['./widgets/summary']).toBe(
      `${VIRTUAL_PREFIX}widgets/summary`,
    );
    expect(federationOptions.shared).toEqual({
      react: { singleton: true, requiredVersion: false },
      'react-dom': { singleton: true, requiredVersion: false },
      'react/jsx-runtime': { singleton: true, requiredVersion: false },
      '@tappify/extension-sdk': { singleton: true, requiredVersion: false },
      '@tanstack/react-query': { singleton: true, requiredVersion: false },
    });
  });

  it('exposes pages, tabs and row actions, and no ./settings without one', () => {
    const federationOptions = federationOptionsOf(
      tappifyExtension({ manifest: surfaceManifest(), root }),
    );

    expect(Object.keys(federationOptions.exposes).sort()).toEqual([
      './pages/funnel',
      './rowActions/flag',
      './tabs/detail',
    ]);
    expect(federationOptions.exposes['./pages/funnel']).toBe(
      `${VIRTUAL_PREFIX}pages/funnel`,
    );
  });

  it('generates a wrapper that re-exports the component and its styles', () => {
    const plugin = pluginNamed('tappify:expose');
    const resolved = moduleHook(
      plugin,
      'resolveId',
    )(`${VIRTUAL_PREFIX}widgets/summary`);
    expect(resolved).toBe(`\0${VIRTUAL_PREFIX}widgets/summary`);
    expect(
      moduleHook(plugin, 'resolveId')(`\0${VIRTUAL_PREFIX}widgets/summary`),
    ).toBe(`\0${VIRTUAL_PREFIX}widgets/summary`);
    expect(moduleHook(plugin, 'resolveId')('./widgets/summary')).toBeNull();

    const code = moduleHook(
      plugin,
      'load',
    )(`\0${VIRTUAL_PREFIX}widgets/summary`);

    expect(code).toContain(
      `import Component from ${JSON.stringify(resolve(root, 'src/widgets/summary.tsx'))};`,
    );
    expect(code).toContain(
      'import style0 from "@tappify/extension-sdk/styles.css?inline";',
    );
    expect(code).toContain(
      `import style1 from ${JSON.stringify(`${resolve(root, 'src/summary.css')}?inline`)};`,
    );
    expect(code).toContain('export default Component;');
    expect(code).toContain('export const styles = [style0, style1];');
  });

  it('uses the exposes as build inputs unless the vendor configured one', () => {
    const plugin = pluginNamed('tappify:expose');
    const hook: unknown = plugin.config;
    if (!isConfigHook(hook)) throw new Error('config is not a function');
    const env = { command: 'build', mode: 'production' } as const;

    expect(hook({}, env)).toEqual({
      build: {
        rolldownOptions: {
          input: {
            'widgets/summary': `${VIRTUAL_PREFIX}widgets/summary`,
            settings: `${VIRTUAL_PREFIX}settings`,
          },
        },
      },
    });
    expect(
      hook({ build: { rolldownOptions: { input: 'index.html' } } }, env),
    ).toBeNull();
  });

  it('generates an empty styles array for an entry with no css', () => {
    const plugin = pluginNamed('tappify:expose');
    const code = moduleHook(plugin, 'load')(`\0${VIRTUAL_PREFIX}settings`);

    expect(code).toContain('export const styles = [];');
  });

  it('refuses an expose no contribution produces', () => {
    const plugin = pluginNamed('tappify:expose');
    let thrown: unknown;
    try {
      moduleHook(plugin, 'load')(`\0${VIRTUAL_PREFIX}widgets/ghost`);
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_ENTRY_MISSING');
  });

  it('rewrites vendor stylesheet imports so the build emits no css asset', () => {
    const transform = transformHook(pluginNamed('tappify:css'));
    const entry = resolve(root, 'src/widgets/summary.tsx');

    const result = transform(
      "import '@tappify/extension-sdk/styles.css';\nimport '../summary.css';\n",
      entry,
    );

    expect(result?.code).toBe(
      "import '@tappify/extension-sdk/styles.css?inline';\nimport '../summary.css?inline';\n",
    );
  });

  it('leaves modules outside the extension root untouched', () => {
    const transform = transformHook(pluginNamed('tappify:css'));

    expect(
      transform("import './theme.css';", '/elsewhere/src/widget.tsx'),
    ).toBeNull();
    expect(
      transform(
        "import './theme.css';",
        resolve(root, 'node_modules/pkg/index.js'),
      ),
    ).toBeNull();
  });

  it('serves the dev remote entry on the configured port with open CORS', () => {
    const plugin = pluginNamed('tappify:dev', { port: 5999 });
    const hook: unknown = plugin.config;
    if (!isConfigHook(hook)) throw new Error('config is not a function');

    const config = hook({}, { command: 'serve', mode: 'development' });

    expect(config.server?.port).toBe(5999);
    expect(config.server?.cors).toEqual({ origin: true });
    expect(config.server?.origin).toBe('http://localhost:5999');
  });

  it('refuses an invalid manifest with TAP_MANIFEST_INVALID', () => {
    let thrown: unknown;
    try {
      tappifyExtension({
        manifest: {
          id: 'Bad Id',
          name: 'x',
          description: 'short',
          icon: 'i.svg',
          category: 'product_analytics',
          sdk: '^2.0.0',
          visibility: 'private',
          installScope: 'project',
          scopes: [],
          contributes: {},
        },
        root,
      });
    } catch (error) {
      thrown = error;
    }

    expect(TapError.is(thrown)).toBe(true);
    if (!TapError.is(thrown)) throw new Error('unreachable');
    expect(thrown.code).toBe('TAP_MANIFEST_INVALID');
    expect(thrown.message).toContain('id');
  });

  it('calls onManifestChange once when the manifest file changes in dev', async () => {
    const onManifestChange = vi.fn();
    const plugin = pluginNamed('tappify:dev', { onManifestChange });
    const hook: unknown = plugin.hotUpdate;
    if (!isHotUpdateHook(hook)) {
      throw new Error('hotUpdate is not a function');
    }

    const file = resolve(root, 'tappify.extension.json');
    await hook.call({ environment: { name: 'client' } }, { file });
    await hook.call({ environment: { name: 'ssr' } }, { file });
    await hook.call(
      { environment: { name: 'client' } },
      { file: resolve(root, 'src/settings.tsx') },
    );

    expect(onManifestChange).toHaveBeenCalledTimes(1);
    expect(onManifestChange.mock.calls[0][0].id).toBe('fixture-lab');
  });
});
