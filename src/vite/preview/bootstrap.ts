import type { LocalPreviewOptions } from './client';

interface RemoteContainer {
  init(shared: Record<string, unknown>): void | Promise<void>;
}

interface PreviewModule {
  mountLocalPreview(options: LocalPreviewOptions): () => void;
}

export interface PreviewBootstrapDependencies {
  prepareHost?(reactUrl: string): Promise<void>;
  importRemote(remote: string): Promise<unknown>;
  importPreview(): Promise<unknown>;
}

type SharedModuleCache = {
  share: Record<string, unknown>;
  remote: Record<string, unknown>;
};

async function prepareHostShares(reactUrl: string): Promise<void> {
  // eslint-disable-next-line no-inline-comments -- Vite must leave this browser URL unresolved.
  const imported = (await import(/* @vite-ignore */ reactUrl)) as Record<
    string,
    unknown
  >;
  const candidate = imported.default;
  const react =
    typeof candidate === 'object' &&
    candidate !== null &&
    'createContext' in candidate
      ? candidate
      : imported;

  const registry = globalThis as typeof globalThis & {
    __mf_module_cache__?: SharedModuleCache;
  };
  const cache = (registry.__mf_module_cache__ ??= { share: {}, remote: {} });
  cache.share.react = react;
  cache.share['default:react'] = react;
}

const defaultDependencies: PreviewBootstrapDependencies = {
  prepareHost: prepareHostShares,
  importRemote: remote => {
    // eslint-disable-next-line no-inline-comments -- The remote URL is selected at preview runtime.
    return import(/* @vite-ignore */ remote);
  },
  importPreview: () => import('../../vite-preview'),
};

function remoteContainer(value: unknown): RemoteContainer {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null ||
    !('init' in value) ||
    typeof value.init !== 'function'
  ) {
    throw new Error('The extension remote does not provide an init function.');
  }
  return value as RemoteContainer;
}

function previewModule(value: unknown): PreviewModule {
  if (
    (typeof value !== 'object' && typeof value !== 'function') ||
    value === null ||
    !('mountLocalPreview' in value) ||
    typeof value.mountLocalPreview !== 'function'
  ) {
    throw new Error('The SDK preview host could not be loaded.');
  }
  return value as PreviewModule;
}

function showStartupError(mount: HTMLElement, error: unknown): void {
  const alert = document.createElement('main');
  alert.setAttribute('role', 'alert');
  alert.style.cssText =
    'min-height:100vh;display:grid;place-content:center;gap:10px;padding:32px;box-sizing:border-box;background:#f4f5ef;color:#142012;font-family:Inter,ui-sans-serif,system-ui,sans-serif;text-align:center';

  const title = document.createElement('strong');
  title.textContent = 'Preview could not start';
  const detail = document.createElement('span');
  detail.textContent =
    error instanceof Error
      ? error.message
      : 'The extension preview failed during startup.';
  alert.append(title, detail);
  mount.replaceChildren(alert);
}

export async function startLocalPreview(
  options: LocalPreviewOptions & { reactUrl: string },
  dependencies: PreviewBootstrapDependencies = defaultDependencies,
): Promise<(() => void) | undefined> {
  try {
    await dependencies.prepareHost?.(options.reactUrl);
    const container = remoteContainer(
      await dependencies.importRemote(options.remote),
    );
    await container.init({});
    const preview = previewModule(await dependencies.importPreview());
    return preview.mountLocalPreview(options);
  } catch (error) {
    showStartupError(options.mount, error);
    return undefined;
  }
}
