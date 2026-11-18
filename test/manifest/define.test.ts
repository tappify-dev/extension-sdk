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
    expect(exposeName('adsPanel', 'campaign-detail')).toBe(
      './adsPanels/campaign-detail',
    );
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

  it("lists an ad network's panels after its other contributions", () => {
    const network: ExtensionManifest = {
      ...manifest,
      category: 'ad_acquisition',
      contributes: {
        ...manifest.contributes,
        ads: {
          auth: { method: 'oauth', provider: 'network', scopes: [] },
          sync: '1h',
          acquisition: {
            levels: [{ level: 'campaign', label: 'Campaign' }],
            metrics: [],
            detailPanels: [
              {
                id: 'campaign-detail',
                level: 'campaign',
                entry: 'src/ads/campaign-detail.tsx',
              },
              {
                id: 'ad-group-detail',
                level: 'ad_group',
                entry: 'src/ads/ad-group-detail.tsx',
              },
            ],
            createPanel: { id: 'create', entry: 'src/ads/create.tsx' },
          },
        },
      },
    };

    expect(uiContributions(network)).toEqual([
      ...uiContributions(manifest),
      {
        kind: 'adsPanel',
        id: 'campaign-detail',
        entry: 'src/ads/campaign-detail.tsx',
        expose: './adsPanels/campaign-detail',
      },
      {
        kind: 'adsPanel',
        id: 'ad-group-detail',
        entry: 'src/ads/ad-group-detail.tsx',
        expose: './adsPanels/ad-group-detail',
      },
      {
        kind: 'adsPanel',
        id: 'create',
        entry: 'src/ads/create.tsx',
        expose: './adsPanels/create',
      },
    ]);
  });

  it('lists no panels for an ad network that declares none', () => {
    const network: ExtensionManifest = {
      ...manifest,
      contributes: {
        ...manifest.contributes,
        ads: {
          auth: { method: 'oauth', provider: 'network', scopes: [] },
          sync: '1h',
          acquisition: {
            levels: [{ level: 'campaign', label: 'Campaign' }],
            metrics: [],
          },
        },
      },
    };

    expect(uiContributions(network)).toEqual(uiContributions(manifest));
  });
});

describe('defineManifest', () => {
  it('returns the manifest unchanged', () => {
    expect(defineManifest(manifest)).toEqual(manifest);
  });
});
