import { describe, expect, it } from 'vitest';
import type { ExtensionManifest } from '../../../src/manifest/types';
import {
  startLocalPreview,
  type PreviewBootstrapDependencies,
} from '../../../src/vite/preview/bootstrap';

const manifest = {
  id: 'fixture-lab',
  name: 'Fixture Lab',
  description: 'A fixture extension used by the SDK preview tests.',
  icon: 'icon.svg',
  category: 'product_analytics',
  sdk: '^2.0.0',
  visibility: 'private',
  installScope: 'project',
  scopes: [],
  contributes: {},
} satisfies ExtensionManifest;

describe('startLocalPreview', () => {
  it('prepares the host shares before initializing the extension remote', async () => {
    const mount = document.createElement('div');
    let prepared = false;
    let finishPreparation: (() => void) | undefined;
    const preparation = new Promise<void>(resolve => {
      finishPreparation = resolve;
    });
    let importedRemote = false;
    const dependencies = {
      async prepareHost() {
        await preparation;
        prepared = true;
      },
      async importRemote() {
        importedRemote = true;
        return {
          init() {
            if (!prepared) throw new Error('React host share was not ready');
          },
        };
      },
      async importPreview() {
        return {
          mountLocalPreview(options: { mount: HTMLElement }) {
            options.mount.textContent = 'Preview ready';
            return () => undefined;
          },
        };
      },
    } as PreviewBootstrapDependencies & {
      prepareHost(): Promise<void>;
    };

    const started = startLocalPreview(
      {
        manifest,
        remote: 'http://localhost:5273/remoteEntry.js',
        reactUrl: '/.cache/deps/react.js',
        mount,
      },
      dependencies,
    );

    await Promise.resolve();
    expect(importedRemote).toBe(false);
    finishPreparation?.();
    await started;
    expect(mount).toHaveTextContent('Preview ready');
  });

  it('initializes the remote before loading and mounting the preview host', async () => {
    const mount = document.createElement('div');
    let initialized = false;
    let finishInitialization: (() => void) | undefined;
    const initialization = new Promise<void>(resolve => {
      finishInitialization = resolve;
    });
    let importedPreview = false;

    const started = startLocalPreview(
      {
        manifest,
        remote: 'http://localhost:5273/remoteEntry.js',
        reactUrl: '/.cache/deps/react.js',
        mount,
      },
      {
        importRemote: async () => ({
          async init() {
            await initialization;
            initialized = true;
          },
        }),
        importPreview: async () => {
          importedPreview = true;
          if (!initialized) throw new Error('React shares are not ready');
          return {
            mountLocalPreview(options: {
              mount: HTMLElement;
              manifest: ExtensionManifest;
            }) {
              options.mount.textContent = options.manifest.name;
              return () => undefined;
            },
          };
        },
      },
    );

    await Promise.resolve();
    expect(importedPreview).toBe(false);
    finishInitialization?.();
    await started;
    expect(mount).toHaveTextContent('Fixture Lab');
  });

  it('shows initialization failures instead of loading the preview host', async () => {
    const mount = document.createElement('div');
    let importedPreview = false;

    await startLocalPreview(
      {
        manifest,
        remote: 'http://localhost:5273/remoteEntry.js',
        reactUrl: '/.cache/deps/react.js',
        mount,
      },
      {
        importRemote: async () => ({
          async init() {
            throw new Error('The extension could not initialize');
          },
        }),
        importPreview: async () => {
          importedPreview = true;
          return {};
        },
      },
    );

    expect(importedPreview).toBe(false);
    expect(mount).toHaveTextContent('Preview could not start');
    expect(mount).toHaveTextContent('The extension could not initialize');
  });

  it('renders a useful startup error instead of leaving the page blank', async () => {
    const mount = document.createElement('div');

    await startLocalPreview(
      {
        manifest,
        remote: 'http://localhost:5273/remoteEntry.js',
        reactUrl: '/.cache/deps/react.js',
        mount,
      },
      {
        importRemote: async () => {
          throw new Error('Remote initialization failed');
        },
        importPreview: async () => {
          throw new Error('The preview host must not load after init fails');
        },
      },
    );

    expect(mount).toHaveTextContent('Preview could not start');
    expect(mount).toHaveTextContent('Remote initialization failed');
    expect(mount.querySelector('[role="alert"]')).not.toBeNull();
  });
});
