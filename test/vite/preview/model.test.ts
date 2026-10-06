import { describe, expect, it, vi } from 'vitest';
import { defineManifest } from '../../../src/manifest/define';
import type { ExtensionManifest } from '../../../src/manifest/types';
import {
  previewProps,
  previewSelections,
  previewTopology,
} from '../../../src/vite/preview/model';

const manifest: ExtensionManifest = defineManifest({
  id: 'surface-lab',
  name: 'Surface Lab',
  description: 'Exercises every UI surface in the local preview host.',
  icon: 'icon.svg',
  category: 'product_analytics',
  sdk: '^2.0.0',
  visibility: 'private',
  installScope: 'project',
  scopes: [{ key: 'ui:render' }],
  contributes: {
    pages: [
      { id: 'explore', title: 'Explore', entry: 'src/pages/explore.tsx' },
    ],
    tabs: [
      {
        id: 'trends',
        title: 'Trends',
        entry: 'src/tabs/trends.tsx',
        page: 'analytics',
      },
    ],
    widgets: [
      {
        id: 'summary',
        title: 'Summary',
        entry: 'src/widgets/summary.tsx',
        page: 'analytics',
        slot: 'kpi-row',
        size: '1x1',
      },
    ],
    rowActions: [
      {
        id: 'inspect',
        title: 'Inspect',
        entry: 'src/row-actions/inspect.tsx',
        table: 'analytics.keywords',
      },
    ],
    settings: {
      entry: 'src/settings.tsx',
      schema: { type: 'object' },
    },
  },
});

describe('previewSelections', () => {
  it('lists every UI surface in host order with a human label', () => {
    expect(previewSelections(manifest)).toEqual([
      {
        contribution: {
          kind: 'page',
          id: 'explore',
          entry: 'src/pages/explore.tsx',
          expose: './pages/explore',
        },
        label: 'Explore (page)',
      },
      {
        contribution: {
          kind: 'tab',
          id: 'trends',
          entry: 'src/tabs/trends.tsx',
          expose: './tabs/trends',
        },
        label: 'Trends (tab)',
      },
      {
        contribution: {
          kind: 'widget',
          id: 'summary',
          entry: 'src/widgets/summary.tsx',
          expose: './widgets/summary',
        },
        label: 'Summary (widget)',
      },
      {
        contribution: {
          kind: 'rowAction',
          id: 'inspect',
          entry: 'src/row-actions/inspect.tsx',
          expose: './rowActions/inspect',
        },
        label: 'Inspect (row action)',
      },
      {
        contribution: {
          kind: 'settings',
          id: 'settings',
          entry: 'src/settings.tsx',
          expose: './settings',
        },
        label: 'Settings',
      },
    ]);
  });

  it('returns no selections when the manifest exposes no UI', () => {
    expect(
      previewSelections({ ...manifest, contributes: { storage: {} } }),
    ).toEqual([]);
  });
});

describe('previewProps', () => {
  const selections = previewSelections(manifest);
  const settings = { refreshMinutes: 15 };
  const onSettingsChange = vi.fn();
  const state = { settings, onSettingsChange };

  it('supplies the host props each surface receives', () => {
    expect(previewProps(selections[0].contribution, state)).toEqual({
      params: { pageId: 'explore', path: '/' },
    });
    expect(previewProps(selections[1].contribution, state)).toEqual({});
    expect(previewProps(selections[2].contribution, state)).toEqual({
      config: {},
    });
    expect(previewProps(selections[3].contribution, state)).toEqual({
      row: {
        id: 'kw_1',
        term: 'photo editor',
        platform: 'ios',
        country: 'US',
        position: 4,
        popularity: 6.6,
      },
    });
    expect(previewProps(selections[4].contribution, state)).toEqual({
      values: settings,
      onChange: expect.any(Function),
    });
  });

  it('passes settings changes to preview state', () => {
    const props = previewProps(selections[4].contribution, state);
    if (!('onChange' in props)) throw new Error('settings props missing');

    props.onChange({ refreshMinutes: 30 });

    expect(onSettingsChange).toHaveBeenCalledWith({ refreshMinutes: 30 });
  });
});

describe('previewTopology', () => {
  it('is stable when declarations are reordered', () => {
    const reordered: ExtensionManifest = {
      ...manifest,
      contributes: {
        ...manifest.contributes,
        pages: [...(manifest.contributes.pages ?? [])].reverse(),
        tabs: [...(manifest.contributes.tabs ?? [])].reverse(),
        widgets: [...(manifest.contributes.widgets ?? [])].reverse(),
        rowActions: [...(manifest.contributes.rowActions ?? [])].reverse(),
      },
    };

    expect(previewTopology(reordered)).toBe(previewTopology(manifest));
  });

  it('changes when an exposed entry changes', () => {
    const changed: ExtensionManifest = {
      ...manifest,
      contributes: {
        ...manifest.contributes,
        pages: [
          {
            ...(manifest.contributes.pages?.[0] as NonNullable<
              ExtensionManifest['contributes']['pages']
            >[number]),
            entry: 'src/pages/rebuilt.tsx',
          },
        ],
      },
    };

    expect(previewTopology(changed)).not.toBe(previewTopology(manifest));
  });
});
