import type { ModuleFederation } from '@module-federation/runtime';
import * as TanstackQuery from '@tanstack/react-query';
import * as React from 'react';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from 'react';
import * as ReactDom from 'react-dom';
import * as JsxRuntime from 'react/jsx-runtime';
import packageJson from '../../../package.json';
import type { TapSettingsValues, TapSize } from '../../client/types';
import { TapHostProvider, createHostQueryClient } from '../../host/provider';
import * as TappifySdk from '../../index';
import { remoteName } from '../../manifest/define';
import type { ExtensionManifest } from '../../manifest/types';
import { fixtures } from '../../testing/fixtures';
import { createTapMock } from '../../testing/mock';
import { PreviewErrorBoundary } from './error-boundary';
import { previewProps, previewSelections } from './model';
import { previewStyles } from './styles';

export interface PreviewLoadRequest {
  extensionId: string;
  remote: string;
  expose: string;
}

export type PreviewModuleLoader = (
  request: PreviewLoadRequest,
) => Promise<unknown>;

export interface LocalPreviewOptions {
  manifest: ExtensionManifest;
  remote: string;
  mount: HTMLElement;
}

export interface LocalPreviewProps {
  manifest: ExtensionManifest;
  remote: string;
  loader?: PreviewModuleLoader;
}

type Theme = 'light' | 'dark';
type Viewport = 'desktop' | 'tablet' | 'mobile';

type LoadState =
  | { key: string; status: 'loading' }
  | {
      key: string;
      status: 'ready';
      Component: ComponentType<Record<string, unknown>>;
      styles: string[];
    }
  | { key: string; status: 'failed'; message: string };

const SINGLETON = { singleton: true, requiredVersion: false } as const;
const federationInstances = new Map<string, Promise<ModuleFederation>>();
let federationSequence = 0;

async function federationFor(
  extensionId: string,
  remote: string,
): Promise<ModuleFederation> {
  const key = `${extensionId}|${remote}`;
  const existing = federationInstances.get(key);
  if (existing !== undefined) return existing;

  federationSequence += 1;
  const name = remoteName(extensionId);
  const created = import('@module-federation/runtime').then(
    ({ createInstance }) =>
      createInstance({
        name: `tappify_local_preview_${String(federationSequence)}`,
        remotes: [{ name, alias: name, entry: remote, type: 'module' }],
        shared: {
          react: {
            version: React.version,
            lib: () => React,
            shareConfig: SINGLETON,
          },
          'react-dom': {
            version: ReactDom.version,
            lib: () => ReactDom,
            shareConfig: SINGLETON,
          },
          'react/jsx-runtime': {
            version: React.version,
            lib: () => JsxRuntime,
            shareConfig: SINGLETON,
          },
          '@tanstack/react-query': {
            version: packageJson.peerDependencies[
              '@tanstack/react-query'
            ].replace(/^[^\d]*/, ''),
            lib: () => TanstackQuery,
            shareConfig: SINGLETON,
          },
          '@tappify/extension-sdk': {
            version: packageJson.version,
            lib: () => TappifySdk,
            shareConfig: SINGLETON,
          },
        },
      }),
  );
  federationInstances.set(key, created);
  return created;
}

export function componentFromModule(
  module: unknown,
  expose: string,
): ComponentType<Record<string, unknown>> {
  const candidate =
    typeof module === 'object' && module !== null && 'default' in module
      ? (module as { default: unknown }).default
      : module;
  if (typeof candidate !== 'function') {
    throw new Error(
      `${expose} did not default-export a React component. Export the contribution component as default.`,
    );
  }
  return candidate as ComponentType<Record<string, unknown>>;
}

function stylesFromModule(module: unknown): string[] {
  if (
    typeof module !== 'object' ||
    module === null ||
    !('styles' in module) ||
    !Array.isArray(module.styles)
  ) {
    return [];
  }
  return module.styles.filter(
    (style): style is string => typeof style === 'string',
  );
}

export async function loadContribution({
  extensionId,
  remote,
  expose,
}: PreviewLoadRequest): Promise<unknown> {
  const federation = await federationFor(extensionId, remote);
  return federation.loadRemote(
    `${remoteName(extensionId)}/${expose.replace(/^\.\//, '')}`,
  );
}

function isExternalRemote(remote: string): boolean {
  try {
    const host = new URL(remote).hostname;
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]';
  } catch {
    return true;
  }
}

function localProcedureStubs(
  manifest: ExtensionManifest,
): Record<string, () => never> {
  return Object.fromEntries(
    Object.keys(manifest.server?.procedures ?? {}).map(name => [
      name,
      () => {
        throw new Error(
          'This view needs live server data. Run tappify extension dev --live to connect it.',
        );
      },
    ]),
  );
}

function Message({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="tap-preview-message" role="status">
      <h2>{title}</h2>
      <span>{children}</span>
    </div>
  );
}

interface PreviewShadowNodes {
  root: ShadowRoot;
  content: HTMLElement;
}

function PreviewSurface({
  portal,
  styles,
  children,
}: {
  portal: HTMLElement;
  styles: string[];
  children: React.ReactNode;
}) {
  const [nodes, setNodes] = useState<PreviewShadowNodes | null>(null);
  const attachHost = useCallback((host: HTMLDivElement | null): void => {
    if (host === null) return;
    const root = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
    let content = root.querySelector<HTMLElement>('[data-tap-content]');
    if (content === null) {
      content = document.createElement('div');
      content.className = 'tap-root';
      content.setAttribute('data-tap-content', '');
      root.appendChild(content);
    }
    setNodes({ root, content });
  }, []);

  useEffect(() => {
    if (nodes === null) return;
    nodes.root.appendChild(portal);
    return () => portal.remove();
  }, [nodes, portal]);

  useEffect(() => {
    if (nodes === null) return;
    const injected: HTMLStyleElement[] = [];
    const inject = (kind: string, css: string): void => {
      const element = document.createElement('style');
      element.setAttribute('data-tap-style', kind);
      element.textContent = css;
      nodes.root.insertBefore(element, nodes.content);
      injected.push(element);
    };

    inject(
      'preview',
      ':host { display: block; height: 100%; min-height: 0; overflow: auto; } .tap-root { box-sizing: border-box; height: 100%; min-height: 100%; padding: 24px; }',
    );
    for (const css of styles) inject('remote', css);
    return () => {
      for (const element of injected) element.remove();
    };
  }, [nodes, styles]);

  return (
    <div
      ref={attachHost}
      className="tap-preview-surface"
      data-tap-preview-surface
    >
      {nodes === null ? null : ReactDom.createPortal(children, nodes.content)}
    </div>
  );
}

export function LocalPreview({
  manifest,
  remote,
  loader = loadContribution,
}: LocalPreviewProps) {
  const selections = useMemo(() => previewSelections(manifest), [manifest]);
  const [expose, setExpose] = useState(
    selections[0]?.contribution.expose ?? '',
  );
  const [theme, setTheme] = useState<Theme>('light');
  const [viewport, setViewport] = useState<Viewport>('desktop');
  const [size, setSize] = useState<TapSize>('slot');
  const [generation, setGeneration] = useState(0);
  const [settings, setSettings] = useState<TapSettingsValues>({});
  const [loaded, setLoaded] = useState<LoadState>({
    key: '',
    status: 'loading',
  });

  const selection =
    selections.find(item => item.contribution.expose === expose) ??
    selections[0];
  const contribution = selection?.contribution;
  const loadKey = `${remote}|${contribution?.expose ?? ''}`;

  useEffect(() => {
    if (contribution === undefined) return;
    let cancelled = false;
    setLoaded({ key: loadKey, status: 'loading' });
    void loader({
      extensionId: manifest.id,
      remote,
      expose: contribution.expose,
    })
      .then(module => {
        if (cancelled) return;
        setLoaded({
          key: loadKey,
          status: 'ready',
          Component: componentFromModule(module, contribution.expose),
          styles: stylesFromModule(module),
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoaded({
          key: loadKey,
          status: 'failed',
          message:
            error instanceof Error
              ? error.message
              : 'The remote entry could not be loaded.',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [contribution, loadKey, loader, manifest.id, remote]);

  const host = useMemo(() => {
    void generation;
    return createTapMock({
      extensionId: manifest.id,
      extensionName: manifest.name,
      project: fixtures.project.project,
      theme,
      size,
      server: localProcedureStubs(manifest),
    });
  }, [generation, manifest, size, theme]);
  const queryClient = useMemo(() => {
    void generation;
    return createHostQueryClient();
  }, [generation]);

  const current: LoadState =
    loaded.key === loadKey ? loaded : { key: loadKey, status: 'loading' };

  let content: React.ReactNode;
  if (contribution === undefined) {
    content = (
      <Message title="No UI contributions">
        Run `tappify extension add` and choose a page, tab, widget, row action,
        or settings panel.
      </Message>
    );
  } else if (current.status === 'failed') {
    content = (
      <div className="tap-preview-message" role="alert">
        <strong>The remote entry could not load.</strong>
        <span>{current.message}</span>
      </div>
    );
  } else if (current.status === 'ready') {
    const Component = current.Component;
    const props = previewProps(contribution, {
      settings,
      onSettingsChange: setSettings,
    });
    content = (
      <TapHostProvider tap={host.tap} queryClient={queryClient}>
        <PreviewSurface portal={host.portal} styles={current.styles}>
          <PreviewErrorBoundary key={`${loadKey}|${String(generation)}`}>
            <Component {...props} />
          </PreviewErrorBoundary>
        </PreviewSurface>
      </TapHostProvider>
    );
  } else {
    content = (
      <Message title="Loading contribution">Loading {selection.label}.</Message>
    );
  }

  return (
    <main className="tap-preview" data-theme={theme}>
      <style>{previewStyles}</style>
      <header className="tap-preview-bar">
        <div className="tap-preview-brand">
          <img src={`/${manifest.icon.replace(/^\.\//, '')}`} alt="" />
          <div>
            <strong>{manifest.name}</strong>
            <span>
              <i aria-hidden="true" />
              {isExternalRemote(remote) ? 'External remote' : 'Local preview'}
              {' · Fixture data'}
            </span>
          </div>
        </div>
        <div className="tap-preview-controls">
          {selections.length > 0 ? (
            <label className="tap-preview-field tap-preview-field--contribution">
              <span>Contribution</span>
              <select
                value={contribution?.expose ?? ''}
                onChange={event => setExpose(event.target.value)}
              >
                {selections.map(item => (
                  <option
                    key={item.contribution.expose}
                    value={item.contribution.expose}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="tap-preview-field">
            <span>Theme</span>
            <select
              value={theme}
              onChange={event => setTheme(event.target.value as Theme)}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="tap-preview-field">
            <span>Viewport</span>
            <select
              value={viewport}
              onChange={event => setViewport(event.target.value as Viewport)}
            >
              <option value="desktop">Desktop</option>
              <option value="tablet">Tablet</option>
              <option value="mobile">Mobile</option>
            </select>
          </label>
          <label className="tap-preview-field">
            <span>Surface</span>
            <select
              value={size}
              aria-label="Surface size"
              onChange={event => setSize(event.target.value as TapSize)}
            >
              <option value="slot">Slot</option>
              <option value="panel">Panel</option>
              <option value="page">Page</option>
            </select>
          </label>
          <button
            className="tap-preview-reset"
            type="button"
            aria-label="Reset fixtures"
            onClick={() => {
              setSettings({});
              setGeneration(value => value + 1);
            }}
          >
            Reset
          </button>
        </div>
      </header>
      <section className="tap-preview-stage">
        <div
          className="tap-preview-canvas"
          data-viewport={viewport}
          data-size={size}
          aria-label="Preview canvas"
        >
          {content}
        </div>
      </section>
    </main>
  );
}
