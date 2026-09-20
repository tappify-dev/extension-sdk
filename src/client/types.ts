import type {
  DataQueryKind,
  HostEventName,
  HostPage,
  ScopeKey,
  SlotId,
} from '../manifest/constants';

export type { DataQueryKind, HostEventName, HostPage, ScopeKey, SlotId };

/**
 * The storage collections the manifest declares, keyed by collection name, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapStorageMap {}
/**
 * The procedures the manifest declares, each with its `input` and `output` type,
 * which `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapProcedureMap {}
/**
 * The actions the manifest declares, each with its `input` type, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapActionMap {}
/**
 * The tools the manifest declares, each with its `input` type, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapToolMap {}
/**
 * The prompts the manifest declares, each with its `input` type, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapPromptMap {}
/**
 * The webhook events the manifest declares, keyed by event name and typed by
 * payload, which `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapWebhookMap {}
/**
 * The narrowed payload types for the Tappify events the manifest subscribes to,
 * which `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapHostEventMap {}
/**
 * The telemetry event names the manifest declares, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapTelemetryEvents {}
/**
 * The settings document the settings contribution's schema describes, which
 * `tappify extension types` writes into `src/tappify.d.ts`.
 */
export interface TapSettings {}
/**
 * The credential names the manifest declares, which `tappify extension types`
 * writes into `src/tappify.d.ts`.
 */
export interface TapCredentials {}

/** One of the two stores an owner's app ships to. */
export type TapPlatform = 'ios' | 'android';
/** The platform the owner's filter bar is set to, or `all` for both. */
export type TapPlatformFilter = TapPlatform | 'all';

/** The dates a read covers, as the host's filter bar holds them. */
export interface TapDateRange {
  /** Inclusive start, as `YYYY-MM-DD`. */
  from: string;
  /** Inclusive end, as `YYYY-MM-DD`. */
  to: string;
  /** Set when the owner picked one of the preset ranges rather than dates. */
  preset?: '7d' | '30d' | '90d';
}

/** The filter bar above the surface a mount renders in. */
export interface TapFilters {
  range: TapDateRange;
  platform: TapPlatformFilter;
  /** An ISO country code, or `all` when the owner has not narrowed to one. */
  country: string;
}

/** One of the owner's apps, as one store knows it. */
export interface TapApp {
  id: string;
  name: string;
  platform: TapPlatform;
  /** The numeric App Store id on iOS, the package name on Android. */
  storeId: string;
  bundleId: string | null;
}

/** One version of an owner's app, as the store reports it. */
export interface TapRelease {
  id: string;
  version: string;
  build: string | null;
  platform: TapPlatform;
  /** The store's own state string, such as `ready_for_sale` or `published`. */
  state: string;
  /**
   * When the store created the version. The type allows `null`, but the host
   * always sends a timestamp today.
   */
  shippedAt: string | null;
}

/** One term in the owner's tracked keyword set, on one platform and country. */
export interface TapKeyword {
  id: string;
  term: string;
  platform: TapPlatform;
  country: string;
  /** The rank the app holds for the term, or `null` when it does not rank. */
  position: number | null;
  /**
   * Tappify's own traffic score for the term, on a 1 to 10 scale, or `null` when
   * the term has not been scored. It is not a figure a store publishes: the host
   * hands over the raw score, while Tappify's own surfaces rescale it to 0 to 100
   * before drawing it.
   */
  popularity: number | null;
}

/** The store metadata for one app, in one country and locale. */
export interface TapListing {
  platform: TapPlatform;
  country: string;
  locale: string;
  title: string;
  subtitle: string | null;
  description: string;
  /** The keyword field as the store holds it, split into terms. */
  keywords: string[];
  updatedAt: string;
}

/** One store review of the owner's app. */
export interface TapReview {
  id: string;
  platform: TapPlatform;
  country: string;
  /** One to five stars. */
  rating: number;
  title: string | null;
  body: string;
  author: string | null;
  submittedAt: string;
  /** Whether the owner has answered the review. */
  replied: boolean;
}

/** One crash group, with how often it has been seen. */
export interface TapCrashIssue {
  id: string;
  title: string;
  count: number;
  build: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
}

/** One day of a series. */
export interface TapSeriesPoint {
  /** The day, as `YYYY-MM-DD`. */
  at: string;
  value: number;
}

/** The metrics a `series` query can ask for. */
export type TapSeriesMetric =
  | 'downloads'
  | 'impressions'
  | 'page_views'
  | 'conversion_rate';

/**
 * A read `tap.data.query` and `useTapQuery` accept, one member per kind of
 * Tappify data.
 */
export type TapQuery =
  | { kind: 'project' }
  | {
      kind: 'series';
      metric: TapSeriesMetric;
      range: TapDateRange;
      platform?: TapPlatform;
    }
  | { kind: 'keywords' }
  | { kind: 'listing' }
  | { kind: 'reviews'; range: TapDateRange }
  | { kind: 'crashes'; range: TapDateRange }
  | { kind: 'revenue'; range: TapDateRange };

/** What a `project` query answers with. */
export interface TapProjectResult {
  project: { id: string; name: string; platforms: TapPlatform[] };
  apps: TapApp[];
  releases: TapRelease[];
}

/** What a `series` query answers with. */
export interface TapSeriesResult {
  metric: TapSeriesMetric;
  /** `ratio` for `conversion_rate`, `count` for the other three metrics. */
  unit: 'count' | 'ratio';
  points: TapSeriesPoint[];
}

/** What a `keywords` query answers with. */
export interface TapKeywordsResult {
  keywords: TapKeyword[];
}

/** What a `listing` query answers with. */
export interface TapListingResult {
  listings: TapListing[];
}

/** What a `reviews` query answers with. */
export interface TapReviewsResult {
  /** The newest first, at most 200 of them. */
  reviews: TapReview[];
  /** The mean rating of the reviews the answer carries, or 0 when it carries none. */
  averageRating: number;
  /**
   * How many reviews the answer carries, which is `reviews.length` today: the
   * host reads at most 200 rows and counts what it returned, so this is not the
   * number of reviews in the range.
   */
  total: number;
}

/** What a `crashes` query answers with. */
export interface TapCrashesResult {
  /**
   * The percentage of users who did not hit a crash, between 0 and 100, taken
   * from the most recently measured crash group. `100` when nothing has been
   * measured yet.
   */
  crashFreeRate: number;
  /** The project's crash groups, the most affected first, at most 100 of them. */
  issues: TapCrashIssue[];
}

/** What a `revenue` query answers with. */
export interface TapRevenueResult {
  currency: string;
  /**
   * Monthly recurring revenue in the major unit of `currency`, so `41200` is
   * 41,200 dollars and not 412 dollars. Summed across the project's apps from
   * each one's latest subscription metric, which is not narrowed by the range.
   */
  mrr: number;
  /** How many refunded units fell in the range, across the project's apps. */
  refunds: number;
  points: TapSeriesPoint[];
}

/**
 * The result type a query of kind `Q` answers with, which is what
 * `tap.data.query` and `useTapQuery` return for it.
 */
export type TapResult<Q extends TapQuery> = Q extends { kind: 'project' }
  ? TapProjectResult
  : Q extends { kind: 'series' }
    ? TapSeriesResult
    : Q extends { kind: 'keywords' }
      ? TapKeywordsResult
      : Q extends { kind: 'listing' }
        ? TapListingResult
        : Q extends { kind: 'reviews' }
          ? TapReviewsResult
          : Q extends { kind: 'crashes' }
            ? TapCrashesResult
            : Q extends { kind: 'revenue' }
              ? TapRevenueResult
              : never;

/**
 * The handle `tap.storage.<name>` exposes for a singleton collection, which holds
 * one document per scope key.
 *
 * @remarks
 * A collection is a singleton when the manifest declares it with `singleton` set
 * to `true`. Every call needs the `storage:write` scope, `get` included.
 */
export interface TapSingleton<T> {
  /** Resolves to `null` until the document has been written once. */
  get(): Promise<T | null>;
  /** Replaces the whole document. */
  set(document: T): Promise<void>;
  /** Merges the fields into the document and resolves to the merged document. */
  patch(partial: Partial<T>): Promise<T>;
}

/**
 * The handle `tap.storage.<name>` exposes for an id-keyed collection, which holds
 * many documents under ids you choose.
 *
 * @remarks
 * A collection is id-keyed when the manifest leaves `singleton` off. Every call
 * needs the `storage:write` scope, `list` and `get` included.
 */
export interface TapCollection<T> {
  /** Pass the `cursor` a previous page answered with to read the next one. */
  list(options?: {
    limit?: number;
    cursor?: string;
  }): Promise<{ items: (T & { id: string })[]; cursor?: string }>;
  /** Resolves to `null` when the collection holds no document under that id. */
  get(id: string): Promise<T | null>;
  /** Writes the document under that id, replacing any document already there. */
  put(id: string, document: T): Promise<void>;
  /** Resolves whether or not a document was there to remove. */
  delete(id: string): Promise<void>;
}

/**
 * The `tap.storage` object, with one handle per collection the manifest
 * declares, read from the `TapStorageMap` augmentation.
 */
export type TapStorage = keyof TapStorageMap extends never
  ? Record<string, TapSingleton<unknown> | TapCollection<unknown>>
  : {
      [K in keyof TapStorageMap]: TapStorageMap[K] extends {
        kind: 'singleton';
        document: infer D;
      }
        ? TapSingleton<D>
        : TapStorageMap[K] extends { kind: 'collection'; document: infer D }
          ? TapCollection<D>
          : never;
    };

/**
 * The names of the singleton collections in the `TapStorageMap` augmentation,
 * which is what `useTapStorage` accepts.
 */
export type TapSingletonName = keyof TapStorageMap extends never
  ? string
  : Extract<
      {
        [K in keyof TapStorageMap]: TapStorageMap[K] extends {
          kind: 'singleton';
        }
          ? K
          : never;
      }[keyof TapStorageMap],
      string
    >;

/**
 * The document type collection `C` holds, read from the `TapStorageMap`
 * augmentation.
 */
export type TapSingletonDocument<C extends TapSingletonName> =
  C extends keyof TapStorageMap
    ? TapStorageMap[C] extends { document: infer D }
      ? D
      : unknown
    : unknown;

type TapProcedureEntries = keyof TapProcedureMap extends never
  ? Record<string, { input: unknown; output: unknown }>
  : TapProcedureMap;

/**
 * The procedure names in the `TapProcedureMap` augmentation, which is what
 * `useTapServer` and `tap.invalidate` accept.
 */
export type TapProcedureName = Extract<keyof TapProcedureEntries, string>;

/**
 * The input type procedure `N` takes, read from the `TapProcedureMap`
 * augmentation.
 */
export type TapProcedureInput<N extends TapProcedureName> =
  (TapProcedureEntries[N] & { input: unknown })['input'];

/**
 * The output type procedure `N` resolves to, read from the `TapProcedureMap`
 * augmentation.
 */
export type TapProcedureOutput<N extends TapProcedureName> =
  (TapProcedureEntries[N] & { output: unknown })['output'];

/**
 * The `tap.server` object, with one call per procedure in the
 * `TapProcedureMap` augmentation.
 */
export type TapProcedures = {
  [N in TapProcedureName]: (
    input: TapProcedureInput<N>,
  ) => Promise<TapProcedureOutput<N>>;
};

/**
 * The action names in the `TapActionMap` augmentation, which is what
 * `tap.actions.run` and the handler's `actions` table accept.
 */
export type ActionId = keyof TapActionMap extends never
  ? string
  : Extract<keyof TapActionMap, string>;

/**
 * The input type action `A` takes, read from the `TapActionMap` augmentation.
 */
export type ActionInput<A extends ActionId> = A extends keyof TapActionMap
  ? TapActionMap[A] extends { input: infer I }
    ? I
    : unknown
  : unknown;

/**
 * The tool names in the `TapToolMap` augmentation, which is what the handler's
 * `tools` table accepts.
 */
export type ToolId = keyof TapToolMap extends never
  ? string
  : Extract<keyof TapToolMap, string>;

/** The input type tool `T` takes, read from the `TapToolMap` augmentation. */
export type ToolInput<T extends ToolId> = T extends keyof TapToolMap
  ? TapToolMap[T] extends { input: infer I }
    ? I
    : unknown
  : unknown;

/** The prompt names in the `TapPromptMap` augmentation. */
export type PromptId = keyof TapPromptMap extends never
  ? string
  : Extract<keyof TapPromptMap, string>;

/**
 * The input type prompt `P` takes, read from the `TapPromptMap` augmentation.
 */
export type PromptInput<P extends PromptId> = P extends keyof TapPromptMap
  ? TapPromptMap[P] extends { input: infer I }
    ? I
    : Record<string, never>
  : Record<string, unknown>;

/**
 * The webhook event names in the `TapWebhookMap` augmentation, which is what
 * `sendEvent` accepts.
 */
export type WebhookName = keyof TapWebhookMap extends never
  ? string
  : Extract<keyof TapWebhookMap, string>;

/**
 * The payload type webhook event `E` carries, read from the `TapWebhookMap`
 * augmentation.
 */
export type WebhookPayload<E extends WebhookName> =
  E extends keyof TapWebhookMap ? TapWebhookMap[E] : Record<string, unknown>;

/**
 * Every Tappify event name with the payload it carries, narrowed by the
 * `TapHostEventMap` augmentation and permissive for the rest.
 */
export type TapHostEvents = Omit<
  Record<HostEventName, Record<string, unknown>>,
  keyof TapHostEventMap
> &
  TapHostEventMap;

/**
 * The telemetry names in the `TapTelemetryEvents` augmentation, which is what
 * `tap.telemetry.event` accepts.
 */
export type TelemetryEvent = keyof TapTelemetryEvents extends never
  ? string
  : Extract<keyof TapTelemetryEvents, string>;

/**
 * The settings document, typed by the `TapSettings` augmentation, as
 * `TapSettingsProps` carries it and the server reads it from `documents`.
 */
export type TapSettingsValues = keyof TapSettings extends never
  ? Record<string, unknown>
  : TapSettings;

/**
 * The credential values Tappify passes to the server, typed by the
 * `TapCredentials` augmentation.
 */
export type TapCredentialValues = keyof TapCredentials extends never
  ? Record<string, string>
  : TapCredentials;

/** How much room the mount has: a slot, the expand panel, or a whole page. */
export type TapSize = 'slot' | 'panel' | 'page';
/** Which of the host's three toast styles `tap.ui.toast` raises. */
export type TapToastTone = 'neutral' | 'success' | 'error';
/**
 * A path `tap.nav.push` accepts: absolute under `/projects`, or relative to the
 * extension's own pages.
 */
export type TapPath = `/${string}`;

/** What the host's confirmation dialog shows for `tap.ui.confirm`. */
export interface TapConfirmOptions {
  title: string;
  body?: string;
  /** Labels the confirming button. The host labels it when this is left out. */
  confirmLabel?: string;
  /** Draws the confirming button in the host's destructive styling. */
  destructive?: boolean;
}

/** One column of a `table` card sent to chat through `tap.ui.openInChat`. */
export interface TapTableColumn {
  /** The key to read from each row object. */
  key: string;
  label: string;
}

/** One side of a `comparison` card sent through `tap.ui.openInChat`. */
export interface TapComparisonSide {
  label: string;
  value: string | number;
}

/** A card `tap.ui.openInChat` sends to the owner's chat, one member per shape. */
export type TapChatCard =
  | { type: 'value'; label: string; value: string | number; delta?: number }
  | { type: 'series'; label: string; points: TapSeriesPoint[] }
  | {
      type: 'table';
      columns: TapTableColumn[];
      rows: Record<string, unknown>[];
    }
  | {
      type: 'list';
      items: { id: string; label: string; description?: string }[];
    }
  | {
      type: 'comparison';
      label: string;
      left: TapComparisonSide;
      right: TapComparisonSide;
    };

/**
 * What `tap.actions.run` resolves to: the run the owner approves or rejects on
 * the host's approval card.
 */
export interface TapActionRun {
  id: string;
  actionId: ActionId;
  status: 'pending' | 'approved' | 'rejected' | 'succeeded' | 'failed';
  requestedAt: string;
}

/**
 * The `tap.format` helpers, which format in `tap.locale` and `tap.timezone` so a
 * number or a date reads the way the rest of the host reads.
 *
 * @remarks
 * The host takes both from the browser. The testing mock does not: it formats in
 * `en-US` and UTC so an expected string does not move with the machine running the
 * test, and its `date` and `relative` answer differently from the host's — `date`
 * ignores `style` and returns `YYYY-MM-DD`, and `relative` returns a whole ISO
 * timestamp rather than a phrase. Assert on your own formatting, not on either of
 * those two strings.
 */
export interface TapFormatters {
  /** Groups digits the way the owner's locale does. */
  number(value: number, options?: Intl.NumberFormatOptions): string;
  /** `code` is an ISO currency code, such as `USD`. */
  currency(value: number, code: string): string;
  /**
   * Formats the date alone, with no time part. In the host, `long` is the only
   * style that changes anything: every other value renders the medium form.
   */
  date(value: string | Date, style?: 'short' | 'long'): string;
  /** In the host, the distance from now in whole days, such as `3 days ago`. */
  relative(value: string | Date): string;
}

/**
 * The channels the host emits a change on, which every slice hook subscribes to.
 *
 * @remarks
 * `state:<key>` and `storage:<collection>` carry the key or the collection name;
 * the rest are fixed. The hooks subscribe through `tap.__subscribe`, so an
 * extension does not name a channel itself.
 */
export type TapChangeKey =
  | 'auth'
  | 'project'
  | 'filters'
  | 'theme'
  | 'size'
  | 'params'
  | 'context'
  | `state:${string}`
  | `storage:${string}`;

/**
 * The two members of `Tap` the host and the SDK's own hooks use. Extensions do
 * not call these.
 */
export interface TapInternals {
  /**
   * The portal node inside the mount's shadow root, or `null` until the shadow
   * root exists.
   */
  __portal: HTMLElement | null;
  /**
   * The host replaces the member a key names with a new object and only then
   * calls the key's listeners; it never mutates a member in place, because the
   * `useTap*` hooks compare snapshots by reference. Returns an unsubscribe
   * function.
   */
  __subscribe(key: TapChangeKey, listener: () => void): () => void;
}

/**
 * The bridge a mount talks to the host through, which `useTap` returns.
 *
 * @remarks
 * The host replaces `auth`, `project`, `filters`, `theme`, `ui`, `params` and
 * `context` with new objects rather than mutating them, so the `useTap*` hooks
 * can compare snapshots by reference. Read a value through its hook when the
 * component has to re-render on a change, and through `tap` when it does not.
 *
 * @example
 * ```tsx
 * import { TapStat, useTap } from '@tappify/extension-sdk';
 *
 * function Installs({ count }: { count: number }) {
 *   const tap = useTap();
 *   return <TapStat label="Installs" value={tap.format.number(count)} />;
 * }
 * ```
 */
export interface Tap extends TapInternals {
  extension: {
    id: string;
    name: string;
    installId: string;
    /** `null` when the extension is installed on the workspace, not a project. */
    projectId: string | null;
  };
  /** `dev` while the dev server serves the mount, else the install's channel. */
  env: 'dev' | 'sandbox' | 'production';
  host: { version: string; sdkMajors: number[] };
  auth: {
    /** The install token to send to your own server as a bearer token. */
    token: string;
    user: { id: string; role: 'admin' | 'member' };
    organizationId: string;
    scopes: ScopeKey[];
    /** Whether the install granted the scope. */
    can(scope: ScopeKey): boolean;
  };
  project: {
    id: string;
    name: string;
    platforms: TapPlatform[];
    apps: TapApp[];
    releases: TapRelease[];
    keywords: TapKeyword[];
  };
  filters: TapFilters;
  theme: { mode: 'light' | 'dark' };
  locale: string;
  timezone: string;
  format: TapFormatters;
  nav: {
    /** Refused with a toast when the path leaves the project or the extension. */
    push(path: TapPath): void;
    /** Sets the query string on the host's URL; a `null` drops that parameter. */
    setSearch(params: Record<string, string | null>): void;
    /** Opens the owner's settings page for this install. */
    openSettings(): void;
    /**
     * Opens the owner's chat and fills the composer with the prompt. The owner
     * reads it and sends it — nothing here sends by itself. The context goes
     * under it as JSON on a visible `From <extension name>:` line the owner can
     * edit or delete, cut to 2 KB, the same ceiling every vendor block the
     * assistant reads is held to.
     */
    openChat(prompt: string, context?: Record<string, unknown>): void;
    /** Asks the owner to confirm, then opens the url in a new tab. */
    openExternal(url: string): void;
  };
  data: {
    /** Rejects with `TAP_SCOPE_MISSING` when the query's scope is not granted. */
    query<Q extends TapQuery>(query: Q): Promise<TapResult<Q>>;
    /** Returns an unsubscribe function; call it when the component unmounts. */
    subscribe<E extends keyof TapHostEvents>(
      event: E,
      handler: (payload: TapHostEvents[E]) => void,
    ): () => void;
  };
  server: TapProcedures;
  state: {
    /**
     * Returns the same reference for the same key until `set` replaces it, so
     * `useTapState` can use the value as a `useSyncExternalStore` snapshot.
     */
    get<T>(key: string): T | undefined;
    /** Notifies every mount of the install that reads the same key. */
    set<T>(key: string, value: T): void;
    /** Returns an unsubscribe function. */
    subscribe(key: string, handler: () => void): () => void;
  };
  ui: {
    size: TapSize;
    /** Raises a host toast; the tone defaults to `neutral`. */
    toast(message: string, tone?: TapToastTone): void;
    /** Resolves to what the owner chose in the host's confirmation dialog. */
    confirm(options: TapConfirmOptions): Promise<boolean>;
    /**
     * Puts the card in the owner's chat, drawn by the host from the values you
     * send. Needs `insights:write`; without it the host fills the composer with
     * a sentence describing the card instead, and the owner sends that.
     */
    openInChat(card: TapChatCard): void;
    /** Opens the widget's expand panel. */
    expand(): void;
    /** Saves the blob to the owner's downloads under that filename. */
    download(blob: Blob, filename: string): void;
    /** Copies the text to the clipboard and toasts that it was copied. */
    copy(text: string): Promise<void>;
  };
  /** What Expand carried in, or the row behind a row action. */
  context: Record<string, unknown>;
  /** A page's route: `pageId`, `path`, and one key per sub-path segment. */
  params: Record<string, string>;
  storage: TapStorage;
  telemetry: {
    /** Queued and sent by the host; the call itself does no network work. */
    event(
      name: TelemetryEvent,
      props?: Record<string, string | number | boolean>,
    ): void;
  };
  actions: {
    /**
     * Creates the run and resolves with it as soon as it exists. `status` is
     * `pending` while the owner has still to approve — the host draws the
     * approval card — and `succeeded` or `failed` when the owner has turned
     * asking off for this install, which no action-declaring extension can do
     * today. Rejects with a `TapServerError` when the host refuses the run.
     */
    run<A extends ActionId>(
      actionId: A,
      input: ActionInput<A>,
    ): Promise<TapActionRun>;
  };
  /**
   * Drops the cached answers for one procedure, or for everything of yours when
   * the name is left out, across every mount of the install.
   */
  invalidate(name?: TapProcedureName): void;
}

/** The props the host renders a widget entry with. */
export interface TapWidgetProps {
  /** Reserved, and always an empty object today: the host puts nothing in it yet. */
  config: Record<string, unknown>;
}

/** The props the host renders a tab entry with, which carries nothing. */
export type TapTabProps = Record<string, never>;

/** The props the host renders a page entry with. */
export interface TapPageProps {
  /** The same value as `tap.params`: `pageId`, `path`, and one key per segment. */
  params: Record<string, string>;
}

/** The props the host renders a row action entry with. */
export interface TapRowActionProps {
  /** The row the owner opened the action from. */
  row: Record<string, unknown>;
}

/** The props the host renders a settings entry with. */
export interface TapSettingsProps {
  values: TapSettingsValues;
  /**
   * Hands the values to the host, which merges them into the settings document
   * and validates them against the schema the manifest declares.
   */
  onChange(values: TapSettingsValues): void;
}
