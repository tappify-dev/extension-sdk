import type {
  ExposableKind,
  ExtensionManifest,
  UiContributionRef,
} from './types';

const EXPOSE_FOLDER: Record<Exclude<ExposableKind, 'settings'>, string> = {
  page: 'pages',
  tab: 'tabs',
  widget: 'widgets',
  rowAction: 'rowActions',
};

export function defineManifest(manifest: ExtensionManifest): ExtensionManifest {
  return manifest;
}

export function exposeName(kind: 'settings'): string;
export function exposeName(
  kind: Exclude<ExposableKind, 'settings'>,
  id: string,
): string;
export function exposeName(kind: ExposableKind, id?: string): string {
  if (kind === 'settings') return './settings';
  return `./${EXPOSE_FOLDER[kind]}/${id ?? ''}`;
}

export function remoteName(extensionId: string): string {
  return `ext_${extensionId.replace(/-/g, '_')}`;
}

export function uiContributions(
  manifest: ExtensionManifest,
): UiContributionRef[] {
  const contributes = manifest.contributes;
  const refs: UiContributionRef[] = [];

  for (const page of contributes.pages ?? []) {
    refs.push({
      kind: 'page',
      id: page.id,
      entry: page.entry,
      expose: exposeName('page', page.id),
    });
  }
  for (const tab of contributes.tabs ?? []) {
    refs.push({
      kind: 'tab',
      id: tab.id,
      entry: tab.entry,
      expose: exposeName('tab', tab.id),
    });
  }
  for (const widget of contributes.widgets ?? []) {
    refs.push({
      kind: 'widget',
      id: widget.id,
      entry: widget.entry,
      expose: exposeName('widget', widget.id),
    });
  }
  for (const rowAction of contributes.rowActions ?? []) {
    refs.push({
      kind: 'rowAction',
      id: rowAction.id,
      entry: rowAction.entry,
      expose: exposeName('rowAction', rowAction.id),
    });
  }
  if (contributes.settings) {
    refs.push({
      kind: 'settings',
      id: 'settings',
      entry: contributes.settings.entry,
      expose: exposeName('settings'),
    });
  }

  return refs;
}
