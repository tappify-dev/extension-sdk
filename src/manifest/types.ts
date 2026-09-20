import type {
  ContributionKind,
  ExtensionCategory,
  HostChart,
  HostEventName,
  HostPage,
  HostTable,
  ScopeKey,
  SlotId,
} from './constants';

export type JsonSchema = Record<string, unknown>;

export type ExtensionVisibility = 'public' | 'unlisted' | 'private';
export type ExtensionInstallScope = 'project' | 'organization';

export interface ScopeEntry {
  key: ScopeKey;
  justification?: string;
}

export interface ProcedureDeclaration {
  input: JsonSchema;
  output: JsonSchema;
  cache?: '1m' | '5m' | '1h';
  kind?: 'read' | 'write';
}

export interface StorageCollection {
  scope: 'user' | 'install' | 'organization';
  singleton?: boolean;
  schema: JsonSchema;
}

export interface PageContribution {
  id: string;
  title: string;
  entry: string;
  nav?: boolean;
  mobile?: boolean;
}

export interface TabContribution {
  id: string;
  title: string;
  entry: string;
  page: HostPage;
  mobile?: boolean;
}

export interface WidgetContribution {
  id: string;
  title: string;
  entry: string;
  page: HostPage;
  slot: SlotId;
  size: '1x1' | '2x1' | '2x2';
  expandable?: boolean;
}

export interface SeriesContribution {
  id: string;
  label: string;
  chart: HostChart;
  metric: string;
}

export interface BannerContribution {
  id: string;
  page: HostPage;
  event: string;
}

export interface RowActionContribution {
  id: string;
  title: string;
  table: HostTable;
  entry: string;
}

export interface MarkerContribution {
  id: string;
  label: string;
  chart: HostChart | '*';
  event: string;
  glyph: string;
}

export interface SettingsContribution {
  entry: string;
  schema: JsonSchema;
}

export interface CredentialField {
  name: string;
  label: string;
  type: 'text' | 'password' | 'textarea' | 'file' | 'select';
  required: boolean;
  options?: string[];
  help?: string;
}

export interface ConnectorAuth {
  method: 'none' | 'api_key' | 'oauth';
  fields?: CredentialField[];
  oauth?: { authorizationUrl: string; tokenUrl: string; scopes: string[] };
}

export interface DimensionDeclaration {
  key: string;
  label: string;
}

export interface MetricDeclaration {
  key: string;
  label: string;
  unit: 'count' | 'ratio' | 'currency' | 'seconds' | 'bytes';
  kind: 'gauge' | 'counter';
  dimensions?: DimensionDeclaration[];
  backfillDays?: number;
}

export interface ConnectorContribution {
  auth?: ConnectorAuth;
  sync?: '5m' | '15m' | '1h' | '6h' | '24h';
  metrics?: MetricDeclaration[];
}

export interface WebhookContribution {
  event: string;
  as: 'alert' | 'banner' | 'event';
  payload: JsonSchema;
}

export interface ToolDeclaration {
  id: string;
  description: string;
  input: JsonSchema;
  returns: 'comparison' | 'table' | 'series' | 'list' | 'value';
  cost: 'low' | 'medium' | 'high';
  cache?: '1m' | '5m' | '1h';
}

export interface MentionDeclaration {
  id: string;
  label: string;
  list: string;
}

export interface ActionDeclaration {
  id: string;
  description: string;
  input: JsonSchema;
  approval: true;
  reversible: boolean;
  scope: ScopeKey;
  estimatesCost?: boolean;
}

export interface KnowledgeDeclaration {
  id: string;
  category: 'metric_definitions' | 'gotchas' | 'setup';
  file: string;
}

export interface SkillDeclaration {
  id: string;
  name: string;
  description: string;
  file: string;
  tools?: string[];
}

export interface PromptDeclaration {
  id: string;
  title: string;
  template: string;
  surfaces: ('chat_suggestion' | 'widget' | 'page' | 'result_card')[];
  after?: string[];
  input?: JsonSchema;
}

export interface ContextDeclaration {
  id: string;
  description: string;
  when: ('turn_start' | 'mention')[];
  cache?: '1m' | '5m' | '1h';
}

export interface AiContribution {
  tools?: ToolDeclaration[];
  mentions?: MentionDeclaration[];
  actions?: ActionDeclaration[];
  knowledge?: KnowledgeDeclaration[];
  skills?: SkillDeclaration[];
  prompts?: PromptDeclaration[];
  context?: ContextDeclaration[];
}

export interface WorkContribution {
  kind: 'tracker' | 'docs' | 'chat';
  container: { label: string; list: string };
  creates: ('issue' | 'page' | 'message')[];
  fields: {
    priority?: string[];
    labels?: boolean;
    assignee?: boolean;
    required: string[];
  };
  attachments: ('image' | 'link')[];
  comments: 'two-way' | 'none';
  status?: {
    webhook: string;
    map: Record<'open' | 'in_progress' | 'done', string[]>;
  };
  identity: 'user' | 'install';
}

export interface ExtensionListing {
  longDescription?: string;
  screenshots?: string[];
  website?: string;
  supportUrl?: string;
  privacyUrl?: string;
}

export interface ExtensionManifest {
  $schema?: string;
  id: string;
  name: string;
  description: string;
  icon: string;
  category: ExtensionCategory;
  sdk: string;
  visibility: ExtensionVisibility;
  installScope: ExtensionInstallScope;
  scopes: ScopeEntry[];
  contributes: {
    pages?: PageContribution[];
    tabs?: TabContribution[];
    widgets?: WidgetContribution[];
    series?: SeriesContribution[];
    banners?: BannerContribution[];
    rowActions?: RowActionContribution[];
    markers?: MarkerContribution[];
    settings?: SettingsContribution;
    storage?: Record<string, StorageCollection>;
    connector?: ConnectorContribution;
    webhooks?: WebhookContribution[];
    ai?: AiContribution;
    work?: WorkContribution;
  };
  server?: {
    baseUrl: string;
    sandboxBaseUrl?: string;
    procedures?: Record<string, ProcedureDeclaration>;
    events?: HostEventName[];
  };
  telemetry?: string[];
  listing?: ExtensionListing;
  pricing?: never;
  score?: never;
}

export type ExposableKind =
  | 'page'
  | 'tab'
  | 'widget'
  | 'rowAction'
  | 'settings';

export interface UiContributionRef {
  kind: ExposableKind;
  id: string;
  entry: string;
  expose: string;
}

export interface ManifestIssue {
  path: string;
  message: string;
}

export type ManifestValidation =
  | { ok: true; manifest: ExtensionManifest }
  | { ok: false; issues: ManifestIssue[] };

export type { ContributionKind };
