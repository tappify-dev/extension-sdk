import type { Plugin } from 'vite';
import type { ManifestValidation } from '../../manifest/types';

export const PREVIEW_CLIENT_ID = 'virtual:tappify-preview/client';
export const PREVIEW_MANIFEST_ID = 'virtual:tappify-preview/manifest';
export const PREVIEW_REMOTE_ID = 'virtual:tappify-preview/remote';
export const PREVIEW_REMOTE_ENV = 'TAPPIFY_PREVIEW_REMOTE';

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const VIRTUAL_IDS = new Set([
  PREVIEW_CLIENT_ID,
  PREVIEW_MANIFEST_ID,
  PREVIEW_REMOTE_ID,
]);

export type PreviewRemote =
  | { ok: true; url: string }
  | { ok: false; message: string };

export interface PreviewPluginOptions {
  manifestFile: string;
  loadManifest(): ManifestValidation;
  port: number;
  remote?: string;
  onManifestChange?(manifest: ManifestValidation): void | Promise<void>;
}

export function previewRemote(
  remote: string | undefined,
  port: number,
): PreviewRemote {
  if (remote === undefined || remote.trim() === '') {
    return { ok: true, url: `http://localhost:${String(port)}/remoteEntry.js` };
  }

  let parsed: URL;
  try {
    parsed = new URL(remote);
  } catch {
    return { ok: false, message: 'The preview remote is not a valid URL.' };
  }

  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' && LOOPBACK_HOSTS.has(parsed.hostname))
  ) {
    return {
      ok: false,
      message: 'A preview remote must use HTTPS or loopback HTTP.',
    };
  }

  return { ok: true, url: parsed.toString() };
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function messageDocument(title: string, messages: string[]): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)} · Tappify local preview</title>
    <style>body{margin:0;min-height:100vh;display:grid;place-content:center;padding:32px;box-sizing:border-box;background:#f4f5ef;color:#142012;font-family:Inter,ui-sans-serif,system-ui,sans-serif}main{max-width:720px;padding:28px;border:1px solid #d8ddcf;border-radius:12px;background:#fff;box-shadow:0 12px 36px rgb(20 32 18 / 9%)}h1{font-size:22px;margin:0 0 14px}ul{margin:0;padding-left:22px;color:#4d5849}li+li{margin-top:8px}</style>
  </head>
  <body><main><h1>${escapeHtml(title)}</h1><ul>${messages.map(message => `<li>${escapeHtml(message)}</li>`).join('')}</ul></main></body>
</html>`;
}

function previewDocument(
  manifest: ManifestValidation,
  remote: PreviewRemote,
): string {
  if (!manifest.ok) {
    return messageDocument(
      'Manifest is invalid',
      manifest.issues.map(issue => `${issue.path}: ${issue.message}`),
    );
  }
  if (!remote.ok)
    return messageDocument('Preview remote was refused', [remote.message]);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(manifest.manifest.name)} · Tappify local preview</title>
  </head>
  <body>
    <div id="tappify-preview-root"></div>
    <script type="module" src="/@id/${PREVIEW_CLIENT_ID}"></script>
  </body>
</html>`;
}

const moduleSource = (value: unknown): string =>
  `export default ${JSON.stringify(value)};`;

export function createPreviewPlugins(options: PreviewPluginOptions): Plugin[] {
  const remote = previewRemote(options.remote, options.port);

  const preview: Plugin = {
    name: 'tappify:preview',
    apply: 'serve',
    resolveId(id) {
      if (VIRTUAL_IDS.has(id)) return `\0${id}`;
      if (id.startsWith('\0') && VIRTUAL_IDS.has(id.slice(1))) return id;
      return null;
    },
    load(id) {
      if (id === `\0${PREVIEW_MANIFEST_ID}`) {
        return moduleSource(options.loadManifest());
      }
      if (id === `\0${PREVIEW_REMOTE_ID}`) return moduleSource(remote);
      if (id !== `\0${PREVIEW_CLIENT_ID}`) return null;
      return [
        `import { mountLocalPreview } from '@tappify/extension-sdk/vite/preview';`,
        `import manifest from '${PREVIEW_MANIFEST_ID}';`,
        `import remote from '${PREVIEW_REMOTE_ID}';`,
        `const mount = document.getElementById('tappify-preview-root');`,
        `if (mount && manifest.ok && remote.ok) mountLocalPreview({ manifest: manifest.manifest, remote: remote.url, mount });`,
      ].join('\n');
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?', 1)[0];
        if (path !== '/' && path !== '/index.html') return next();
        void server
          .transformIndexHtml(
            path,
            previewDocument(options.loadManifest(), remote),
          )
          .then(html => {
            response.statusCode = 200;
            response.setHeader('Content-Type', 'text/html; charset=utf-8');
            response.end(html);
          })
          .catch(next);
      });
    },
  };

  const dev: Plugin = {
    name: 'tappify:dev',
    apply: 'serve',
    config() {
      return {
        server: {
          host: '127.0.0.1',
          port: options.port,
          strictPort: true,
          cors: { origin: true },
          origin: `http://localhost:${String(options.port)}`,
        },
      };
    },
    configureServer(server) {
      server.watcher.add(options.manifestFile);
    },
    async hotUpdate(context) {
      if (this.environment.name !== 'client') return;
      if (context.file !== options.manifestFile) return;
      const manifest = options.loadManifest();
      await options.onManifestChange?.(manifest);
      context.server.ws.send({ type: 'full-reload', path: '*' });
    },
  };

  return [preview, dev];
}
