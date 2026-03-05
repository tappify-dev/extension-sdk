import { federation } from '@module-federation/vite';
import type { Plugin } from 'vite';

export interface TapAppFederationOptions {
  name: string;
}

export function tapAppFederation(options: TapAppFederationOptions): Plugin[] {
  const remoteName = options.name.replace(/-/g, '_');

  return federation({
    name: remoteName,
    exposes: {
      './manifest': './src/manifest.ts',
    },
    shared: {
      react: { singleton: true, requiredVersion: '^19.0.0' },
      'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
      '@tappify/app-builder': { singleton: true },
    },
    dts: false,
  });
}
