import {
  Children,
  Fragment,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from 'react';
import { cn } from './cn';

/** Props for a grey content surface. */
export interface PanelProps extends Omit<
  ComponentPropsWithoutRef<'section'>,
  'title'
> {
  /** A control shown at the end of the heading row. */
  action?: ReactNode;
  /** Short context shown at the end of the heading row, such as the period. */
  caption?: ReactNode;
  title?: ReactNode;
}

/**
 * Groups one chart, table or figure on a grey surface.
 *
 * @example
 * ```tsx
 * import { Metric, Panel } from '@tappify/extension-sdk/ui';
 *
 * function Revenue() {
 *   return (
 *     <Panel title="Revenue" caption="Last 30 days">
 *       <Metric label="Total" value="$31,420" delta={0.027} />
 *     </Panel>
 *   );
 * }
 * ```
 */
export function Panel({
  action,
  caption,
  children,
  className,
  title,
  ...props
}: PanelProps) {
  const hasHead = Boolean(title) || Boolean(caption) || Boolean(action);
  return (
    <section
      {...props}
      className={cn('tap-ui-panel', className)}
      data-slot="panel"
    >
      {hasHead ? (
        <div className="tap-panel__head" data-slot="panel-head">
          <div className="tap-panel__title" data-slot="panel-title">
            {title}
          </div>
          {caption ? (
            <div className="tap-panel__caption" data-slot="panel-caption">
              {caption}
            </div>
          ) : null}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Props for a row of figures on one grey surface. */
export type MetricBandProps = ComponentPropsWithoutRef<'div'>;

/**
 * Lays its children out in one row on a grey surface, split by thin rules.
 *
 * @example
 * ```tsx
 * import { Metric, MetricBand } from '@tappify/extension-sdk/ui';
 *
 * function Subscriptions() {
 *   return (
 *     <MetricBand>
 *       <Metric label="MRR" value="$24,860" />
 *       <Metric label="Active subscriptions" value="1,842" />
 *     </MetricBand>
 *   );
 * }
 * ```
 */
export function MetricBand({ children, className, ...props }: MetricBandProps) {
  const items = Children.toArray(children);
  return (
    <div
      {...props}
      className={cn('tap-ui-metric-band', className)}
      data-slot="metric-band"
    >
      {items.map((item, index) => (
        <Fragment key={index}>
          {index > 0 ? (
            <span aria-hidden="true" className="tap-metric-band__rule" />
          ) : null}
          <div className="tap-metric-band__item">{item}</div>
        </Fragment>
      ))}
    </div>
  );
}

/** One choice in {@link Tabs}. */
export interface TabItem {
  id: string;
  label: ReactNode;
}

/** Props for a row of views the user switches between. */
export interface TabsProps {
  className?: string;
  /** Names the group for assistive technology. */
  label: string;
  /** Called with the id of the tab the user chose. */
  onChange: (id: string) => void;
  tabs: readonly TabItem[];
  /** The id of the tab that is showing. */
  value: string;
}

/**
 * Switches between the views of one surface.
 *
 * @example
 * ```tsx
 * import { useState } from 'react';
 * import { Tabs } from '@tappify/extension-sdk/ui';
 *
 * function Views() {
 *   const [view, setView] = useState('overview');
 *   return (
 *     <Tabs
 *       label="Views"
 *       value={view}
 *       onChange={setView}
 *       tabs={[
 *         { id: 'overview', label: 'Overview' },
 *         { id: 'funnels', label: 'Funnels' },
 *       ]}
 *     />
 *   );
 * }
 * ```
 */
export function Tabs({ className, label, onChange, tabs, value }: TabsProps) {
  return (
    <div
      aria-label={label}
      className={cn('tap-ui-tabs', className)}
      data-slot="tabs"
      role="tablist"
    >
      {tabs.map(tab => (
        <button
          aria-selected={tab.id === value}
          className="tap-tabs__tab"
          data-slot="tab"
          key={tab.id}
          onClick={() => onChange(tab.id)}
          role="tab"
          type="button"
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** One line in {@link KeyValueList}. */
export interface KeyValueRow {
  label: ReactNode;
  value: ReactNode;
}

/** Props for a list of labeled values. */
export interface KeyValueListProps {
  className?: string;
  rows: readonly KeyValueRow[];
}

/**
 * Lists labels with their values, one per line.
 *
 * @example
 * ```tsx
 * import { KeyValueList } from '@tappify/extension-sdk/ui';
 *
 * function Subscriber() {
 *   return (
 *     <KeyValueList
 *       rows={[
 *         { label: 'Plan', value: 'Annual' },
 *         { label: 'Renews', value: 'Aug 14, 2027' },
 *       ]}
 *     />
 *   );
 * }
 * ```
 */
export function KeyValueList({ className, rows }: KeyValueListProps) {
  return (
    <dl
      className={cn('tap-ui-key-value-list', className)}
      data-slot="key-value-list"
    >
      {rows.map((row, index) => (
        <div className="tap-key-value__row" key={index}>
          <dt className="tap-key-value__label">{row.label}</dt>
          <dd className="tap-key-value__value">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
