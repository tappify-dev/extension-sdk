import type { ComponentType } from 'react';

export interface TapAppManifest {
  App: ComponentType;
  Settings?: ComponentType;
  displayName: string;
  version: string;
}
