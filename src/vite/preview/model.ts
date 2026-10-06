import type {
  TapPageProps,
  TapRowActionProps,
  TapSettingsProps,
  TapSettingsValues,
  TapTabProps,
  TapWidgetProps,
} from '../../client/types';
import { uiContributions } from '../../manifest/define';
import type {
  ExposableKind,
  ExtensionManifest,
  UiContributionRef,
} from '../../manifest/types';
import { fixtureKeywords } from '../../testing/fixtures';

export interface PreviewSelection {
  contribution: UiContributionRef;
  label: string;
}

export interface PreviewState {
  settings: TapSettingsValues;
  onSettingsChange(values: TapSettingsValues): void;
}

export type PreviewProps =
  | TapWidgetProps
  | TapTabProps
  | TapPageProps
  | TapRowActionProps
  | TapSettingsProps;

const kindLabel: Record<ExposableKind, string> = {
  page: 'page',
  tab: 'tab',
  widget: 'widget',
  rowAction: 'row action',
  settings: 'settings',
};

function titleByExpose(manifest: ExtensionManifest): Map<string, string> {
  const titles = new Map<string, string>();
  const contributes = manifest.contributes;

  for (const page of contributes.pages ?? []) {
    titles.set(`./pages/${page.id}`, page.title);
  }
  for (const tab of contributes.tabs ?? []) {
    titles.set(`./tabs/${tab.id}`, tab.title);
  }
  for (const widget of contributes.widgets ?? []) {
    titles.set(`./widgets/${widget.id}`, widget.title);
  }
  for (const action of contributes.rowActions ?? []) {
    titles.set(`./rowActions/${action.id}`, action.title);
  }
  if (contributes.settings) titles.set('./settings', 'Settings');

  return titles;
}

export function previewSelections(
  manifest: ExtensionManifest,
): PreviewSelection[] {
  const titles = titleByExpose(manifest);
  return uiContributions(manifest).map(contribution => {
    const title = titles.get(contribution.expose) ?? contribution.id;
    return {
      contribution,
      label:
        contribution.kind === 'settings'
          ? title
          : `${title} (${kindLabel[contribution.kind]})`,
    };
  });
}

export function previewProps(
  contribution: UiContributionRef,
  state: PreviewState,
): PreviewProps {
  switch (contribution.kind) {
    case 'page':
      return { params: { pageId: contribution.id, path: '/' } };
    case 'tab':
      return {};
    case 'widget':
      return { config: {} };
    case 'rowAction':
      return { row: { ...fixtureKeywords[0] } };
    case 'settings':
      return {
        values: state.settings,
        onChange: values => state.onSettingsChange(values),
      };
  }
}

export function previewTopology(manifest: ExtensionManifest): string {
  return uiContributions(manifest)
    .map(({ kind, id, expose, entry }) =>
      JSON.stringify({ kind, id, expose, entry }),
    )
    .sort()
    .join('\n');
}
