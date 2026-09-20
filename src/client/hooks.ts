import { useCallback, useSyncExternalStore } from 'react';
import { useTap } from './context';
import type { Tap, TapChangeKey, TapFilters, TapSize } from './types';

function useTapSlice<T>(key: TapChangeKey, select: (tap: Tap) => T): T {
  const tap = useTap();

  const subscribe = useCallback(
    (listener: () => void) => tap.__subscribe(key, listener),
    [tap, key],
  );
  const snapshot = useCallback(() => select(tap), [tap, select]);

  return useSyncExternalStore(subscribe, snapshot, snapshot);
}

const selectAuth = (tap: Tap): Tap['auth'] => tap.auth;
const selectProject = (tap: Tap): Tap['project'] => tap.project;
const selectFilters = (tap: Tap): TapFilters => tap.filters;
const selectTheme = (tap: Tap): Tap['theme'] => tap.theme;
const selectSize = (tap: Tap): TapSize => tap.ui.size;
const selectParams = (tap: Tap): Record<string, string> => tap.params;
const selectContext = (tap: Tap): Record<string, unknown> => tap.context;

/**
 * Returns the install token, the signed-in teammate, the workspace id, the
 * granted scopes and `can(scope)`.
 *
 * @remarks
 * Re-renders the component when the host rotates the install token, and when the
 * signed-in teammate's role arrives after the mount. `scopes` and `can` report the
 * grant the mount was built with. Throws `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { TapEmptyState, useTapAuth } from '@tappify/extension-sdk';
 *
 * function RevenuePanel() {
 *   const auth = useTapAuth();
 *   if (!auth.can('revenue:read')) {
 *     return <TapEmptyState title="Revenue is not shared with this extension" />;
 *   }
 *   return <span>Signed in as {auth.user.id}</span>;
 * }
 * ```
 */
export function useTapAuth(): Tap['auth'] {
  return useTapSlice('auth', selectAuth);
}

/**
 * Returns the project the mount renders in, with its apps, releases and tracked
 * keywords.
 *
 * @remarks
 * Re-renders when the host loads or reloads the project. Throws
 * `TAP_OUTSIDE_HOST` outside a mount. An extension installed on the workspace
 * rather than a project still renders inside one project at a time.
 *
 * @example
 * ```tsx
 * import { useTapProject } from '@tappify/extension-sdk';
 *
 * function Platforms() {
 *   const project = useTapProject();
 *   return <span>{project.name} ships to {project.platforms.join(' and ')}</span>;
 * }
 * ```
 */
export function useTapProject(): Tap['project'] {
  return useTapSlice('project', selectProject);
}

/**
 * Returns the date range, platform and country the owner's filter bar is set to.
 *
 * @remarks
 * Re-renders on every filter change, which is how a surface follows the owner's
 * picker. Pass `range` into a `series`, `reviews`, `crashes` or `revenue` query
 * yourself; the host adds only the country to a data read, while a procedure call
 * carries all three. Throws `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { useTapFilters, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Downloads() {
 *   const filters = useTapFilters();
 *   const downloads = useTapQuery({
 *     kind: 'series',
 *     metric: 'downloads',
 *     range: filters.range,
 *   });
 *   return <span>{downloads.data?.points.length ?? 0} days</span>;
 * }
 * ```
 */
export function useTapFilters(): TapFilters {
  return useTapSlice('filters', selectFilters);
}

/**
 * Returns the mode the host is drawing in, as `{ mode: 'light' | 'dark' }`.
 *
 * @remarks
 * Re-renders when the owner switches theme. The host's CSS variables already
 * follow the theme, so reach for this only where a component has to branch in
 * code rather than restyle, such as a chart's series colours. Throws
 * `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { useTapTheme } from '@tappify/extension-sdk';
 *
 * function SeriesLine() {
 *   const theme = useTapTheme();
 *   const stroke = theme.mode === 'dark' ? '#a5b4fc' : '#4f46e5';
 *   return <svg><line x1="0" y1="0" x2="40" y2="10" stroke={stroke} /></svg>;
 * }
 * ```
 */
export function useTapTheme(): Tap['theme'] {
  return useTapSlice('theme', selectTheme);
}

/**
 * Returns how much room the mount has: `slot`, `panel` or `page`.
 *
 * @remarks
 * Expanding a widget mounts a second copy of the component in the panel rather
 * than resizing the one in the slot, so the change this hook reports is the
 * panel's own Widen and Narrow toggle moving between `panel` and `page`. Size
 * against the mount with a container query where CSS can do the work; this hook is
 * for the cases that need different markup. Throws `TAP_OUTSIDE_HOST` outside a
 * mount.
 *
 * @example
 * ```tsx
 * import { TapTable, useTapSize } from '@tappify/extension-sdk';
 *
 * function Keywords({ rows }: { rows: { term: string }[] }) {
 *   const size = useTapSize();
 *   const shown = size === 'slot' ? rows.slice(0, 3) : rows;
 *   return (
 *     <TapTable
 *       columns={[{ key: 'term', label: 'Term' }]}
 *       rows={shown}
 *       rowKey={row => row.term}
 *     />
 *   );
 * }
 * ```
 */
export function useTapSize(): TapSize {
  return useTapSlice('size', selectSize);
}

/**
 * Returns the route of the extension's own page: the page id, the whole sub-path,
 * and one key per segment.
 *
 * @remarks
 * The host builds `pageId`, `path` and then `0`, `1` and so on, one per segment of
 * the sub-path. Only a page entry is routed, so this is empty for a widget, a tab,
 * a row action and a settings panel. Re-renders when the owner navigates inside the
 * page. Throws `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { useTapParams } from '@tappify/extension-sdk';
 *
 * function FunnelDetail() {
 *   const params = useTapParams();
 *   const funnelId = params['1'];
 *   return <span>{funnelId ?? params.path}</span>;
 * }
 * ```
 */
export function useTapParams(): Record<string, string> {
  return useTapSlice('params', selectParams);
}

/**
 * Returns what the surface handed the mount: the payload Expand carried in, or
 * the row behind a row action.
 *
 * @remarks
 * Re-renders when the host hands the mount a new context. A row action reads the
 * row from its own `row` prop as well; this hook is the same value for a
 * component further down the tree. Throws `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { useTapContext } from '@tappify/extension-sdk';
 *
 * function ContextNote() {
 *   const context = useTapContext();
 *   const reviewId = context.reviewId;
 *   return <span>{typeof reviewId === 'string' ? reviewId : 'No review'}</span>;
 * }
 * ```
 */
export function useTapContext(): Record<string, unknown> {
  return useTapSlice('context', selectContext);
}

/**
 * Returns one value from the in-memory store every mount of the install shares,
 * with a setter for it.
 *
 * @remarks
 * The value is `undefined` until something sets it, and setting it re-renders
 * every mount reading the same key, including a sibling widget and the expand
 * panel. The store lives in the browser session: it is not persisted, not shared
 * between teammates or tabs, and never reaches Tappify or your server — use
 * `useTapStorage` for a value that has to come back tomorrow. Throws
 * `TAP_OUTSIDE_HOST` outside a mount.
 *
 * @example
 * ```tsx
 * import { TapButton, useTapState } from '@tappify/extension-sdk';
 *
 * function StepPicker() {
 *   const [step, setStep] = useTapState<string>('selectedStep');
 *   return (
 *     <TapButton onClick={() => setStep('install')}>
 *       {step ?? 'Pick a step'}
 *     </TapButton>
 *   );
 * }
 * ```
 */
export function useTapState<T>(
  key: string,
): [T | undefined, (value: T) => void] {
  const tap = useTap();

  const subscribe = useCallback(
    (listener: () => void) => tap.__subscribe(`state:${key}`, listener),
    [tap, key],
  );
  const snapshot = useCallback(() => tap.state.get<T>(key), [tap, key]);
  const set = useCallback(
    (value: T) => {
      tap.state.set(key, value);
    },
    [tap, key],
  );

  const value = useSyncExternalStore(subscribe, snapshot, snapshot);
  return [value, set];
}
