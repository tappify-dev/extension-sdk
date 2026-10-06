import type { ToolDeclaration } from './types';

export const SCOPES = [
  {
    key: 'ui:render',
    label: 'Render UI',
    description:
      'Render the declared pages, tabs, widgets, row actions and settings panel, and open chat with a visible prompt',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'projects:read',
    label: 'Read the project',
    description: 'Project name, platforms and store identity',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'analytics:read',
    label: 'Read analytics',
    description: 'Downloads, impressions, page views and conversion series',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'store.metadata:read',
    label: 'Read store metadata',
    description: 'Listing metadata, keyword set and keyword positions',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'reviews:read',
    label: 'Read store reviews',
    description: 'Review text, ratings and replies',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'crashes:read',
    label: 'Read crash data',
    description: 'Crash-free rate and issue counts',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'revenue:read',
    label: 'Read revenue',
    description: 'MRR, revenue series and refund counts',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
  {
    key: 'metrics:write',
    label: 'Write connector metrics',
    description:
      'Write the metrics this extension declares into the metrics store',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'alerts:write',
    label: 'Raise alerts and banners',
    description:
      'Turn declared webhooks into alerts and banners, at most three a day per project',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
  {
    key: 'insights:write',
    label: 'Post insights',
    description: 'Post insights to Home and to chat',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
  {
    key: 'ai:tools',
    label: 'Add assistant tools',
    description: 'Offer tools and mentions to the assistant',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'ai:actions',
    label: 'Run assistant actions',
    description: 'Run declared actions, each behind the approval card',
    requiresSecurityReview: true,
    requiresJustification: true,
  },
  {
    key: 'store.metadata:write',
    label: 'Propose store metadata changes',
    description: 'Propose listing changes through a Tappify approval',
    requiresSecurityReview: true,
    requiresJustification: true,
  },
  {
    key: 'autopilot:trigger',
    label: 'Trigger automated store actions',
    description: 'Start automated store actions on the owner’s behalf',
    requiresSecurityReview: true,
    requiresJustification: true,
  },
  {
    key: 'work:create',
    label: 'Create work items',
    description: 'Create issues, pages or messages in the vendor’s system',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
  {
    key: 'work:sync',
    label: 'Sync work items',
    description: 'Two-way comments and status on created work items',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
  {
    key: 'storage:write',
    label: 'Use hosted storage',
    description:
      'Read and write this extension’s own hosted storage collections',
    requiresSecurityReview: false,
    requiresJustification: false,
  },
  {
    key: 'messaging:send',
    label: 'Send messages to end users',
    description:
      'Send messages or push notifications to the owner’s end users through owner-supplied credentials',
    requiresSecurityReview: true,
    requiresJustification: true,
  },
  {
    key: 'ai:skills',
    label: 'Shape the assistant',
    description:
      'Add skills, prompt templates and context providers that shape the assistant’s behaviour',
    requiresSecurityReview: false,
    requiresJustification: true,
  },
] as const;

export type ScopeDefinition = (typeof SCOPES)[number];
/** Every scope an extension can ask for under `scopes` in its manifest. */
export type ScopeKey = ScopeDefinition['key'];

export const SCOPE_KEYS: readonly ScopeKey[] = SCOPES.map(scope => scope.key);

export const SLOTS = [
  'kpi-row',
  'insights',
  'sidebar',
  'below-chart',
  'below-list',
] as const;
/** The anchors on a host page a widget can be declared at. */
export type SlotId = (typeof SLOTS)[number];

export const CHARTS = [
  'installs-activity',
  'conversion',
  'release-cadence',
] as const;
export type HostChart = (typeof CHARTS)[number];

export const PAGES = [
  {
    key: 'overview',
    label: 'Home',
    route: '/projects/:id/overview',
    slots: ['kpi-row', 'insights', 'sidebar'],
    charts: ['installs-activity'],
    tabs: true,
    banners: true,
  },
  {
    key: 'analytics',
    label: 'Analytics',
    route: '/projects/:id/analytics',
    slots: ['kpi-row', 'below-chart', 'sidebar'],
    charts: ['installs-activity', 'conversion'],
    tabs: true,
    banners: true,
  },
  {
    key: 'deployments',
    label: 'Deployments',
    route: '/projects/:id/deployments',
    slots: ['sidebar', 'below-list'],
    charts: ['release-cadence'],
    tabs: true,
    banners: false,
  },
  {
    key: 'ai_chat',
    label: 'Assistant',
    route: 'chat',
    slots: [],
    charts: [],
    tabs: false,
    banners: false,
  },
] as const;

export type PageDefinition = (typeof PAGES)[number];
/** The host pages a contribution can attach a tab, widget or banner to. */
export type HostPage = PageDefinition['key'];

export const PAGE_KEYS: readonly HostPage[] = PAGES.map(page => page.key);

export const TABLES = [
  { key: 'analytics.keywords', label: 'Keywords' },
  { key: 'analytics.reviews', label: 'Reviews' },
  { key: 'deployments.releases', label: 'Releases' },
  { key: 'deployments.builds', label: 'Builds' },
] as const;

export type TableDefinition = (typeof TABLES)[number];
export type HostTable = TableDefinition['key'];

export const TABLE_KEYS: readonly HostTable[] = TABLES.map(table => table.key);

export const KINDS = [
  'page',
  'tab',
  'widget',
  'series',
  'banner',
  'rowAction',
  'marker',
  'settings',
  'storage',
  'connector',
  'webhook',
  'tool',
  'mention',
  'action',
  'knowledge',
  'skill',
  'prompt',
  'context',
  'work',
] as const;
export type ContributionKind = (typeof KINDS)[number];

export const CATEGORIES = [
  'market_data',
  'subscriptions',
  'product_analytics',
  'crashes',
  'attribution',
  'experiments',
  'messaging',
  'session_replay',
  'localization',
  'design',
  'ci_cd',
  'trackers',
  'support',
  'chat',
  'ad_monetization',
  'warehouse',
  'compliance',
  'additional_stores',
] as const;
export type ExtensionCategory = (typeof CATEGORIES)[number];

export const EVENTS = [
  'release.shipped',
  'metadata.changed',
  'keyword.set_changed',
  'screenshots.updated',
  'price.changed',
  'featuring.started',
  'score.changed',
  'incident.opened',
  'incident.resolved',
  'playbook.step_approved',
  'review.thread_opened',
  'review.thread_resolved',
  'approval.requested',
  'digest.sent',
  'install.created',
  'install.paused',
  'install.resumed',
  'install.revoked',
  'install.token_rotated',
  'scopes.changed',
  'settings.changed',
] as const;
/** Every event Tappify emits, which a mount or a server can subscribe to. */
export type HostEventName = (typeof EVENTS)[number];

export const SERVED_SDK_MAJORS: readonly number[] = [2];

/** The `kind` of every read `tap.data.query` accepts, one per scope it needs. */
export type DataQueryKind =
  | 'project'
  | 'series'
  | 'keywords'
  | 'listing'
  | 'reviews'
  | 'crashes'
  | 'revenue';

export const QUERY_SCOPES: Record<DataQueryKind, ScopeKey> = {
  project: 'projects:read',
  series: 'analytics:read',
  keywords: 'store.metadata:read',
  listing: 'store.metadata:read',
  reviews: 'reviews:read',
  crashes: 'crashes:read',
  revenue: 'revenue:read',
};

/**
 * The keys a tool's answer carries for each `returns` kind it may declare.
 * `validateToolResponse`, `tappify extension doctor` and the host all read
 * this one table, so a wrong body fails the same way wherever it is checked.
 */
export const CARD_KEYS: Record<ToolDeclaration['returns'], string[]> = {
  value: ['label', 'value'],
  series: ['label', 'points'],
  table: ['columns', 'rows'],
  list: ['items'],
  comparison: ['label', 'left', 'right'],
};

export const findScope = (key: string): ScopeDefinition | undefined =>
  SCOPES.find(scope => scope.key === key);

export const findPage = (key: string): PageDefinition | undefined =>
  PAGES.find(page => page.key === key);

export const findTable = (key: string): TableDefinition | undefined =>
  TABLES.find(table => table.key === key);

export const slotsForPage = (page: string): readonly SlotId[] =>
  findPage(page)?.slots ?? [];
