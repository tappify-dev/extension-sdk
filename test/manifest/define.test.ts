import { describe, expect, it } from 'vitest';
import {
  defineManifest,
  exposeName,
  remoteName,
  uiContributions,
} from '../../src/manifest/define';
import type { ExtensionManifest } from '../../src/manifest/types';

const manifest: ExtensionManifest = defineManifest({
  id: 'funnel-lab',
  name: 'Funnel Lab',
  description: 'Shows where installs drop out of the store funnel.',
  icon: 'icon.svg',
  category: 'product_analytics',
  sdk: '^2.0.0',
  visibility: 'private',
  installScope: 'project',
  scopes: [{ key: 'ui:render' }],
  contributes: {
    widgets: [
      {
        id: 'funnel',
        title: 'Funnel',
        entry: 'src/widgets/funnel.tsx',
        page: 'analytics',
        slot: 'kpi-row',
        size: '1x1',
      },
    ],
    pages: [
      { id: 'explore', title: 'Explore', entry: 'src/pages/explore.tsx' },
    ],
    settings: { entry: 'src/settings.tsx', schema: { type: 'object' } },
  },
});

describe('exposeName', () => {
  it('names one expose per contribution kind', () => {
    expect(exposeName('widget', 'funnel')).toBe('./widgets/funnel');
    expect(exposeName('tab', 'trend')).toBe('./tabs/trend');
    expect(exposeName('page', 'explore')).toBe('./pages/explore');
    expect(exposeName('rowAction', 'inspect')).toBe('./rowActions/inspect');
    expect(exposeName('settings')).toBe('./settings');
  });
});

describe('remoteName', () => {
  it('turns the extension id into a federation remote name', () => {
    expect(remoteName('funnel-lab')).toBe('ext_funnel_lab');
    expect(remoteName('starter')).toBe('ext_starter');
  });
});

describe('uiContributions', () => {
  it('lists every entry the Vite plugin must expose', () => {
    expect(uiContributions(manifest)).toEqual([
      {
        kind: 'page',
        id: 'explore',
        entry: 'src/pages/explore.tsx',
        expose: './pages/explore',
      },
      {
        kind: 'widget',
        id: 'funnel',
        entry: 'src/widgets/funnel.tsx',
        expose: './widgets/funnel',
      },
      {
        kind: 'settings',
        id: 'settings',
        entry: 'src/settings.tsx',
        expose: './settings',
      },
    ]);
  });
});

describe('defineManifest', () => {
  it('returns the manifest unchanged', () => {
    expect(defineManifest(manifest)).toEqual(manifest);
  });
});
