import { federation } from '@module-federation/vite';
import { readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import type { Plugin } from 'vite';
import { TapError } from '../client/errors';
import { remoteName, uiContributions } from '../manifest/define';
import { validateManifest } from '../manifest/schema';
import type { ExtensionManifest } from '../manifest/types';
import { PREVIEW_REMOTE_ENV, createPreviewPlugins } from './preview/plugin';
import { collectEntryStyles, inlineCssImports } from './styles';

export { collectEntryStyles, inlineCssImports };

export const VIRTUAL_PREFIX = 'virtual:tappify-expose/';

const DEFAULT_PORT = 5273;
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/;

export interface TappifyExtensionOptions {
  manifest?: ExtensionManifest;
  manifestPath?: string;
  root?: string;
  port?: number;
  onManifestChange?(manifest: ExtensionManifest): void | Promise<void>;
}

interface FederationOptions {
  name: string;
  filename: string;
  manifest: true;
  exposes: Record<string, string>;
  shared: Record<string, { singleton: true; requiredVersion: false }>;
  dts: false;
}

const federationOptionsByPlugins = new WeakMap<Plugin[], FederationOptions>();

export function federationOptionsOf(plugins: Plugin[]): FederationOptions {
  const options = federationOptionsByPlugins.get(plugins);
  if (options === undefined) {
    throw new TapError(
      'TAP_ENTRY_MISSING',
      'This plugin array did not come from tappifyExtension(), so it carries no federation options. Pass the array tappifyExtension() returned.',
    );
  }
  return options;
}

function manifestFile(options: TappifyExtensionOptions): string {
  return (
    options.manifestPath ??
    resolve(options.root ?? process.cwd(), 'tappify.extension.json')
  );
}

function loadManifest(options: TappifyExtensionOptions) {
  let raw: unknown;
  try {
    raw =
      options.manifest ??
      JSON.parse(readFileSync(manifestFile(options), 'utf8'));
  } catch (error) {
    return {
      ok: false as const,
      issues: [
        {
          path: '$',
          message:
            error instanceof Error
              ? `The manifest is not valid JSON: ${error.message}`
              : 'The manifest is not valid JSON.',
        },
      ],
    };
  }
  return validateManifest(raw);
}

function manifestError(result: ReturnType<typeof loadManifest>): TapError {
  if (result.ok) throw new Error('A valid manifest has no validation error.');
  const lines = result.issues
    .map(issue => `  ${issue.path}: ${issue.message}`)
    .join('\n');
  return new TapError(
    'TAP_MANIFEST_INVALID',
    `tappify.extension.json does not validate:\n${lines}\nFix the fields above, or run \`tappify extension doctor\` for the same list with suggested fixes.`,
  );
}

/**
 * The Vite plugins that build an extension for the Tappify host.
 *
 * `tappifyExtension()` imports `@module-federation/vite`, an optional peer
 * dependency (~1.16), so a vendor using this entry must install it alongside
 * the SDK; `tappify extension init` installs it in the scaffolded extension.
 */
export function tappifyExtension(
  options: TappifyExtensionOptions = {},
): Plugin[] {
  const root = options.root ?? process.cwd();
  const boundary = root.endsWith(sep) ? root : `${root}${sep}`;
  const loaded = loadManifest(options);
  const manifest = loaded.ok ? loaded.manifest : null;
  const contributions = manifest === null ? [] : uiContributions(manifest);
  const port = options.port ?? DEFAULT_PORT;

  const entryByKey = new Map<string, string>();
  const exposes: Record<string, string> = {};

  for (const contribution of contributions) {
    const key = contribution.expose.slice('./'.length);
    entryByKey.set(key, resolve(root, contribution.entry));
    exposes[contribution.expose] = `${VIRTUAL_PREFIX}${key}`;
  }

  const singleton = { singleton: true, requiredVersion: false } as const;

  const federationOptions: FederationOptions = {
    name: remoteName(manifest?.id ?? 'invalid-extension'),
    filename: 'remoteEntry.js',
    manifest: true,
    exposes,
    shared: {
      react: singleton,
      'react-dom': singleton,
      'react/jsx-runtime': singleton,
      '@tappify/extension-sdk': singleton,
      '@tanstack/react-query': singleton,
    },
    dts: false,
  };

  const expose: Plugin = {
    name: 'tappify:expose',
    enforce: 'pre',
    config(config) {
      const build = config.build ?? {};
      if (
        build.rolldownOptions?.input !== undefined ||
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        build.rollupOptions?.input !== undefined
      ) {
        return null;
      }
      const input: Record<string, string> = {};
      for (const key of entryByKey.keys())
        input[key] = `${VIRTUAL_PREFIX}${key}`;
      return { build: { rolldownOptions: { input } } };
    },
    resolveId(id) {
      if (id.startsWith(VIRTUAL_PREFIX)) return `\0${id}`;
      if (id.startsWith(`\0${VIRTUAL_PREFIX}`)) return id;
      return null;
    },
    load(id) {
      if (!id.startsWith(`\0${VIRTUAL_PREFIX}`)) return null;

      const key = id.slice(`\0${VIRTUAL_PREFIX}`.length);
      const entry = entryByKey.get(key);
      if (entry === undefined) {
        throw new TapError(
          'TAP_ENTRY_MISSING',
          `No contribution in tappify.extension.json produces the expose "./${key}". Add it with \`tappify extension add\`, or remove the stale expose.`,
        );
      }

      const styles = collectEntryStyles(entry, root);
      const imports = styles.map(
        (style, index) =>
          `import style${String(index)} from ${JSON.stringify(`${style}?inline`)};`,
      );
      const names = styles.map((_style, index) => `style${String(index)}`);

      return [
        `import Component from ${JSON.stringify(entry)};`,
        ...imports,
        'export default Component;',
        `export const styles = [${names.join(', ')}];`,
        '',
      ].join('\n');
    },
  };

  const guard: Plugin = {
    name: 'tappify:manifest',
    enforce: 'pre',
    config(_config, environment) {
      if (environment.command !== 'build') return null;
      const current = loadManifest(options);
      if (!current.ok) throw manifestError(current);
      return null;
    },
  };

  const css: Plugin = {
    name: 'tappify:css',
    enforce: 'pre',
    transform(code, id) {
      if (!id.startsWith(boundary)) return null;
      if (id.includes(`${sep}node_modules${sep}`)) return null;

      const file = id.split('?')[0];
      if (!SOURCE_FILE.test(file)) return null;

      const next = inlineCssImports(code);
      return next === null ? null : { code: next, map: null };
    },
  };

  const plugins: Plugin[] = [
    guard,
    expose,
    css,
    ...federation(federationOptions),
    ...createPreviewPlugins({
      manifestFile: manifestFile(options),
      loadManifest: () => loadManifest(options),
      port,
      remote: process.env[PREVIEW_REMOTE_ENV],
      onManifestChange: async result => {
        if (result.ok && options.onManifestChange !== undefined) {
          await options.onManifestChange(result.manifest);
        }
      },
    }),
  ];

  federationOptionsByPlugins.set(plugins, federationOptions);
  return plugins;
}
