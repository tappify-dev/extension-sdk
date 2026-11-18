import type {
  AdsChangeKind,
  AdsLevel,
  AdsSharedMetric,
  ContributionKind,
  CrashesOperation,
  ExtensionCategory,
  HostChart,
  HostEventName,
  HostPage,
  HostTable,
  KeywordDataOperation,
  KeywordDataPlatform,
  ScopeKey,
  SlotId,
} from './constants';
import type { StandardMetricKey } from './standard-metrics';

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

export type OAuthTokenRequestEncoding = 'form' | 'json';

export interface ConnectorAuth {
  method: 'none' | 'api_key' | 'oauth';
  fields?: CredentialField[];
  oauth?: {
    authorizationUrl: string;
    tokenUrl: string;
    scopes: string[];
    /** The token request body encoding. When omitted, uses form encoding. */
    tokenRequestEncoding?: OAuthTokenRequestEncoding;
  };
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
  /** The standard metric this one reports. Tappify features read standard metrics without knowing which extension supplied them. */
  standard?: StandardMetricKey;
  /** How many days before the newest stored value Tappify asks for again on each sync, for numbers that settle late. */
  restateDays?: number;
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

export type WorkDirection =
  | 'none'
  | 'to_provider'
  | 'from_provider'
  | 'two-way';

export type WorkAuth =
  | { method: 'oauth'; provider: string; scopes: string[] }
  | { method: 'api_key'; fields: CredentialField[] };

export interface AdsLevelDeclaration {
  level: AdsLevel;
  label: string;
  changes?: AdsChangeKind[];
}

export interface AdsSharedMetricDeclaration {
  key: AdsSharedMetric;
  definition: string;
}

export interface AdsExtraMetricDeclaration {
  key: string;
  label: string;
  unit: MetricDeclaration['unit'];
  definition: string;
}

export interface AdsPanelDeclaration {
  id: string;
  level: 'campaign' | 'ad_group';
  entry: string;
}

export interface AdsAcquisition {
  levels: AdsLevelDeclaration[];
  metrics: AdsSharedMetricDeclaration[];
  extraMetrics?: AdsExtraMetricDeclaration[];
  detailPanels?: AdsPanelDeclaration[];
  createPanel?: { id: string; entry: string };
}

export interface AdsContribution {
  auth: WorkAuth;
  sync: '15m' | '1h' | '6h' | '24h';
  backfillDays?: number;
  acquisition: AdsAcquisition;
  /** Not available yet. */
  attribution?: undefined;
  /** Not available yet. */
  monetization?: undefined;
}

export interface KeywordDataContribution {
  supports: KeywordDataOperation[];
  platforms: KeywordDataPlatform[];
}

/** The crash groups, and optionally their details, this extension reads from a crash reporter. */
export interface CrashesContribution {
  /** What your server answers: `groups` always, `details` when it can return one group's stack trace. */
  supports: CrashesOperation[];
}

export interface WorkContribution {
  kind: 'tracker' | 'docs' | 'chat';
  creates: ('issue' | 'page' | 'message')[];
  identity: 'install' | 'user';
  comments:
    | 'two-way'
    | 'none'
    | {
        direction: WorkDirection;
        supportsEdits: false;
        supportsDeletes: false;
      };
  status?: {
    direction: WorkDirection;
    webhook?: string;
    map?: Record<'open' | 'in_progress' | 'done', string[]>;
  };
  attachments: ('image' | 'link')[];
  auth: WorkAuth;
  /** @deprecated resolved dynamically by describe_container */
  container?: { label: string; list: string };
  /** @deprecated resolved dynamically by describe_container */
  fields?: {
    priority?: string[];
    labels?: boolean;
    assignee?: boolean;
    required: string[];
  };
}

/** @deprecated Migrate to WorkContribution during the SDK v2 compatibility window. */
export interface LegacyWorkContribution extends Omit<
  WorkContribution,
  'auth' | 'container' | 'fields' | 'comments' | 'status'
> {
  container: NonNullable<WorkContribution['container']>;
  fields: NonNullable<WorkContribution['fields']>;
  comments: 'two-way' | 'none';
  status?: {
    webhook: string;
    map: Record<'open' | 'in_progress' | 'done', string[]>;
  };
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
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Published v2 manifests retain the legacy contract.
    work?: WorkContribution | LegacyWorkContribution;
    ads?: AdsContribution;
    keywordData?: KeywordDataContribution;
    /** The crash reporter this extension reads crash groups from. Needs the `crashes:write` scope. */
    crashes?: CrashesContribution;
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
  | 'settings'
  | 'adsPanel';

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
