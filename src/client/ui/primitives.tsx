import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from './cn';

/** The props `TapButton` takes, on top of the native button attributes. */
export interface TapButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Defaults to `primary`. */
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  /** Defaults to `md`. */
  size?: 'sm' | 'md';
  /** Disables the button and marks it `aria-busy`. */
  loading?: boolean;
}

/**
 * Renders a button in the host's styling, in one of four variants.
 *
 * @remarks
 * Draws on `--tap-accent` and `--tap-accent-fg` for `primary`, `--bg-raised`,
 * `--fg-default` and `--divider` for `secondary`, `--fg-muted` for `ghost` and
 * `--tap-danger` for `danger`, and takes its radius from `--tap-radius`. The
 * element defaults to `type="button"`, so a button inside a `TapForm` does not
 * submit it unless you pass `type="submit"`. `loading` disables the button, so a
 * click cannot land twice.
 *
 * @example
 * ```tsx
 * import { TapButton } from '@tappify/extension-sdk';
 *
 * function ExportRow({ busy, onExport }: { busy: boolean; onExport: () => void }) {
 *   return (
 *     <TapButton variant="secondary" size="sm" loading={busy} onClick={onExport}>
 *       Export
 *     </TapButton>
 *   );
 * }
 * ```
 */
export function TapButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  className,
  children,
  ...rest
}: TapButtonProps): ReactElement {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      className={cn(
        'tap-btn',
        `tap-btn--${variant}`,
        size === 'sm' && 'tap-btn--sm',
        className,
      )}
    >
      {children}
    </button>
  );
}

/** The props `TapCard` takes. */
export interface TapCardProps {
  /** Rendered in the header, which appears only with a `title` or an `action`. */
  title?: ReactNode;
  /** Sits at the end of the header, for a button or a link. */
  action?: ReactNode;
  /** Rendered under a divider below the body. */
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * Renders the bordered surface a widget, tab or page section sits in.
 *
 * @remarks
 * Renders as a `section` on `--bg-raised` with a `--divider` border and the
 * `--tap-radius` corner, and the footer in `--fg-muted`. The header appears only
 * when `title` or `action` is given, and the body carries its own padding, so
 * nest content directly rather than wrapping it in another padded box. A widget
 * belongs in one card.
 *
 * @example
 * ```tsx
 * import { TapButton, TapCard, TapStat } from '@tappify/extension-sdk';
 *
 * function InstallSummary() {
 *   return (
 *     <TapCard
 *       title="Install summary"
 *       action={<TapButton variant="ghost" size="sm">Compact</TapButton>}
 *       footer={<span>Last seven days</span>}
 *     >
 *       <TapStat label="Installs" value="1,260" delta={0.087} />
 *     </TapCard>
 *   );
 * }
 * ```
 */
export function TapCard({
  title,
  action,
  footer,
  className,
  children,
}: TapCardProps): ReactElement {
  return (
    <section className={cn('tap-card', className)}>
      {(title !== undefined || action !== undefined) && (
        <header className="tap-card__head">
          <span>{title}</span>
          {action}
        </header>
      )}
      <div className="tap-card__body">{children}</div>
      {footer !== undefined && (
        <footer className="tap-card__foot">{footer}</footer>
      )}
    </section>
  );
}

/** The props `TapPageHeader` takes. */
export interface TapPageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Laid out in a row at the end of the header. */
  actions?: ReactNode;
}

/**
 * Renders the title, description and actions at the top of a tab, a page or a
 * settings panel.
 *
 * @remarks
 * The title renders as an `h2`, because the host owns the page's `h1`. The
 * description follows `--fg-muted` and the rule under the header follows
 * `--divider`. Under 360 pixels of mount width the actions stack under the title.
 * A widget in a slot uses `TapCard`'s own header instead.
 *
 * @example
 * ```tsx
 * import { TapButton, TapPageHeader } from '@tappify/extension-sdk';
 *
 * function FunnelsHeader() {
 *   return (
 *     <TapPageHeader
 *       title="Funnels"
 *       description="Every step from impression to install."
 *       actions={<TapButton size="sm">New funnel</TapButton>}
 *     />
 *   );
 * }
 * ```
 */
export function TapPageHeader({
  title,
  description,
  actions,
}: TapPageHeaderProps): ReactElement {
  return (
    <div className="tap-page-header">
      <div>
        <h2 className="tap-page-header__title">{title}</h2>
        {description !== undefined && (
          <p className="tap-page-header__description">{description}</p>
        )}
      </div>
      {actions !== undefined && <div className="tap-row">{actions}</div>}
    </div>
  );
}

/** The props `TapSkeleton` takes. */
export interface TapSkeletonProps {
  /** How many bars to draw. Defaults to one. */
  lines?: number;
  /** A CSS width for every bar. Left out, each bar is 12% shorter than the last. */
  width?: string;
  className?: string;
}

/**
 * Renders the placeholder bars that stand in for content while a read is in
 * flight.
 *
 * @remarks
 * The bars are `aria-hidden`, so a screen reader is not told about them, and they
 * take their tone from `--bg-subtle`. The pulse stops under
 * `prefers-reduced-motion`. Render this while `isLoading` is `true`, in place of
 * the content rather than beside it.
 *
 * @example
 * ```tsx
 * import { TapSkeleton, TapStat, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Keywords() {
 *   const keywords = useTapQuery({ kind: 'keywords' });
 *   if (keywords.isLoading) return <TapSkeleton lines={3} />;
 *   return <TapStat label="Tracked" value={keywords.data?.keywords.length ?? 0} />;
 * }
 * ```
 */
export function TapSkeleton({
  lines = 1,
  width,
  className,
}: TapSkeletonProps): ReactElement {
  return (
    <div aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className={cn('tap-skeleton', className)}
          style={{ width: width ?? `${String(100 - index * 12)}%` }}
        />
      ))}
    </div>
  );
}

/** The props `TapEmptyState` takes. */
export interface TapEmptyStateProps {
  title: string;
  description?: string;
  /** Rendered under the text, for the one thing the owner can do next. */
  action?: ReactNode;
}

/**
 * Renders the centred message that stands in for content when there is nothing to
 * show.
 *
 * @remarks
 * Centres its text in `--fg-muted` with the title in `--fg-default`. Use it for an
 * empty result or a surface the install has not been granted; a failure belongs in
 * `TapErrorState`, which carries a retry and announces itself as an alert.
 *
 * @example
 * ```tsx
 * import { TapEmptyState, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Reviews() {
 *   const reviews = useTapQuery({
 *     kind: 'reviews',
 *     range: { from: '2026-09-01', to: '2026-09-08' },
 *   });
 *   if (reviews.data?.total === 0) {
 *     return <TapEmptyState title="No reviews in this range" />;
 *   }
 *   return <span>{reviews.data?.total ?? 0} reviews</span>;
 * }
 * ```
 */
export function TapEmptyState({
  title,
  description,
  action,
}: TapEmptyStateProps): ReactElement {
  return (
    <div className="tap-state">
      <span className="tap-state__title">{title}</span>
      {description !== undefined && <span>{description}</span>}
      {action}
    </div>
  );
}

/** The props `TapErrorState` takes. */
export interface TapErrorStateProps {
  title: string;
  /** The failure's own message, which is what a caller shows the owner. */
  description?: string;
  /** An error code, rendered small in `--font-mono` under the description. */
  code?: string;
  /** Renders a Retry button, and is called by it. */
  onRetry?: () => void;
}

/**
 * Renders the centred failure message a surface shows in place of its content.
 *
 * @remarks
 * Carries `role="alert"`, so the host announces it, and draws the title in
 * `--tap-danger`. The Retry button appears only with `onRetry`; wire it to the
 * `refetch` of every read the surface needs. Pass the failure's own `message` as
 * the description — an error from `useTapServer` carries the text your server sent
 * the owner — and the `code` of a `TapError` or `TapServerError` as `code`.
 *
 * @example
 * ```tsx
 * import { TapErrorState, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Crashes() {
 *   const crashes = useTapQuery({
 *     kind: 'crashes',
 *     range: { from: '2026-09-01', to: '2026-09-08' },
 *   });
 *   if (crashes.error !== null) {
 *     return (
 *       <TapErrorState
 *         title="Crashes did not load"
 *         description={crashes.error.message}
 *         onRetry={crashes.refetch}
 *       />
 *     );
 *   }
 *   return <span>{crashes.data?.issues.length ?? 0} issues</span>;
 * }
 * ```
 */
export function TapErrorState({
  title,
  description,
  code,
  onRetry,
}: TapErrorStateProps): ReactElement {
  return (
    <div className="tap-state tap-state--error" role="alert">
      <span className="tap-state__title">{title}</span>
      {description !== undefined && <span>{description}</span>}
      {code !== undefined && <span className="tap-state__code">{code}</span>}
      {onRetry !== undefined && (
        <TapButton variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </TapButton>
      )}
    </div>
  );
}

/** The props `TapStat` takes. */
export interface TapStatProps {
  label: string;
  value: ReactNode;
  /** A share of the previous period, so `0.087` renders as `+9%`. */
  delta?: number;
  /** A line of context under the number. */
  hint?: string;
}

/**
 * Renders one labelled number, with an optional change against the previous
 * period.
 *
 * @remarks
 * The label is uppercased in `--fg-muted` and the number uses tabular figures, so
 * a row of stats stays aligned as values change. `delta` is a ratio, not a
 * percentage: it renders as whole percent with a plus in front when it is above
 * zero, and is coloured `--tap-danger` below zero and `--tap-accent` at or above
 * it. Format `value`
 * yourself with `tap.format.number` or `tap.format.currency`, so it follows the
 * owner's locale.
 *
 * @example
 * ```tsx
 * import { TapStat, useTap } from '@tappify/extension-sdk';
 *
 * function Installs({ installs, delta }: { installs: number; delta: number }) {
 *   const tap = useTap();
 *   return (
 *     <TapStat
 *       label="Installs"
 *       value={tap.format.number(installs)}
 *       delta={delta}
 *       hint="Against the previous seven days"
 *     />
 *   );
 * }
 * ```
 */
export function TapStat({
  label,
  value,
  delta,
  hint,
}: TapStatProps): ReactElement {
  const percent =
    delta === undefined
      ? undefined
      : `${delta > 0 ? '+' : ''}${String(Math.round(delta * 100))}%`;

  return (
    <div className="tap-stat">
      <span className="tap-stat__label">{label}</span>
      <span className="tap-stat__value">{value}</span>
      {percent !== undefined && (
        <span
          className={cn(
            delta !== undefined && delta < 0
              ? 'tap-stat__delta--down'
              : 'tap-stat__delta--up',
          )}
        >
          {percent}
        </span>
      )}
      {hint !== undefined && <span className="tap-field__hint">{hint}</span>}
    </div>
  );
}

interface FieldFrameProps {
  id: string;
  label?: string;
  hint?: string;
  error?: string;
  hintId: string;
  errorId: string;
  children: ReactNode;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  hintId,
  errorId,
  children,
}: FieldFrameProps): ReactElement {
  return (
    <div className="tap-field">
      {label !== undefined && (
        <label className="tap-field__label" htmlFor={id}>
          {label}
        </label>
      )}
      {children}
      {hint !== undefined && (
        <span className="tap-field__hint" id={hintId}>
          {hint}
        </span>
      )}
      {error !== undefined && (
        <span className="tap-field__error" id={errorId}>
          {error}
        </span>
      )}
    </div>
  );
}

function describedByOf(
  fieldId: string,
  hint: string | undefined,
  error: string | undefined,
): string | undefined {
  const value = cn(
    hint !== undefined && `${fieldId}-hint`,
    error !== undefined && `${fieldId}-error`,
  );
  return value === '' ? undefined : value;
}

/**
 * The `TapInput` props for a single-line control, on top of the native input
 * attributes minus `size`.
 */
export interface TapSingleLineInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'size'
> {
  /** Rendered as a `label` bound to the control by id. */
  label?: string;
  /** Marks the control invalid and renders the message under it. */
  error?: string;
  /** A line of guidance under the control, referenced by `aria-describedby`. */
  hint?: string;
}

function TapSingleLineInput({
  label,
  error,
  hint,
  className,
  id,
  ...rest
}: TapSingleLineInputProps): ReactElement {
  const generated = useId();
  const fieldId = id ?? generated;

  if (rest.type === 'checkbox') {
    return (
      <div className="tap-field tap-field--checkbox">
        <label className="tap-checkbox-row" htmlFor={fieldId}>
          <input
            {...rest}
            id={fieldId}
            className={cn(
              'tap-control',
              'tap-control--checkbox',
              error !== undefined && 'tap-control--invalid',
              className,
            )}
            aria-invalid={error !== undefined || undefined}
            aria-describedby={describedByOf(fieldId, hint, error)}
          />
          {label !== undefined && (
            <span className="tap-field__label">{label}</span>
          )}
        </label>
        {hint !== undefined && (
          <span className="tap-field__hint" id={`${fieldId}-hint`}>
            {hint}
          </span>
        )}
        {error !== undefined && (
          <span className="tap-field__error" id={`${fieldId}-error`}>
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      hintId={`${fieldId}-hint`}
      errorId={`${fieldId}-error`}
    >
      <input
        {...rest}
        id={fieldId}
        className={cn(
          'tap-control',
          error !== undefined && 'tap-control--invalid',
          className,
        )}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedByOf(fieldId, hint, error)}
      />
    </FieldFrame>
  );
}

/**
 * The `TapInput` props for a multiline control, on top of the native textarea
 * attributes.
 */
export interface TapTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Rendered as a `label` bound to the control by id. */
  label?: string;
  /** Marks the control invalid and renders the message under it. */
  error?: string;
  /** A line of guidance under the control, referenced by `aria-describedby`. */
  hint?: string;
}

function TapTextarea({
  label,
  error,
  hint,
  className,
  id,
  rows,
  ...rest
}: TapTextareaProps): ReactElement {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      hintId={`${fieldId}-hint`}
      errorId={`${fieldId}-error`}
    >
      <textarea
        {...rest}
        id={fieldId}
        rows={rows ?? 4}
        className={cn(
          'tap-control',
          error !== undefined && 'tap-control--invalid',
          className,
        )}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedByOf(fieldId, hint, error)}
      />
    </FieldFrame>
  );
}

/**
 * The props `TapInput` takes: the single-line set, or the textarea set behind
 * `multiline`.
 */
export type TapInputProps =
  | ({ multiline?: false } & TapSingleLineInputProps)
  | ({ multiline: true } & TapTextareaProps);

/**
 * Renders a labelled text control with its hint and error, as an input or, with
 * `multiline`, a textarea.
 *
 * @remarks
 * Generates an id when none is passed and binds the label, the hint and the error
 * to the control, so the field is announced whole; an `error` also sets
 * `aria-invalid` and the `--tap-danger` border. The textarea starts at four rows
 * and is resizable in height. Pass `type="checkbox"` with
 * `className="tap-control--checkbox"` for a boolean, which is what `TapForm`
 * does.
 *
 * @example
 * ```tsx
 * import { TapInput } from '@tappify/extension-sdk';
 *
 * function TermField({ term, onTerm }: { term: string; onTerm: (next: string) => void }) {
 *   return (
 *     <TapInput
 *       label="Keyword"
 *       hint="One term per row in the report."
 *       value={term}
 *       onChange={event => onTerm(event.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function TapInput(props: TapInputProps): ReactElement {
  if (props.multiline === true) {
    const { multiline: _multiline, ...rest } = props;
    return <TapTextarea {...rest} />;
  }

  const { multiline: _multiline, ...rest } = props;
  return <TapSingleLineInput {...rest} />;
}

/** The props `TapSelect` takes, on top of the native select attributes. */
export interface TapSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** Rendered as a `label` bound to the control by id. */
  label?: string;
  /** Marks the control invalid and renders the message under it. */
  error?: string;
  /** A line of guidance under the control, referenced by `aria-describedby`. */
  hint?: string;
  /** Rendered in order; the component adds no empty option of its own. */
  options: { value: string; label: string }[];
}

/**
 * Renders a labelled select over a list of options, with its hint and error.
 *
 * @remarks
 * Carries the same label, hint, error and `aria-describedby` wiring as
 * `TapInput`. Add your own empty option when the field starts unset — `TapForm`
 * puts a `Choose one` option in front of a schema's enum values.
 *
 * @example
 * ```tsx
 * import { TapSelect } from '@tappify/extension-sdk';
 *
 * function PlatformPicker({ value, onPick }: { value: string; onPick: (next: string) => void }) {
 *   return (
 *     <TapSelect
 *       label="Platform"
 *       value={value}
 *       options={[
 *         { value: 'ios', label: 'iOS' },
 *         { value: 'android', label: 'Android' },
 *       ]}
 *       onChange={event => onPick(event.target.value)}
 *     />
 *   );
 * }
 * ```
 */
export function TapSelect({
  label,
  error,
  hint,
  options,
  className,
  id,
  ...rest
}: TapSelectProps): ReactElement {
  const generated = useId();
  const fieldId = id ?? generated;

  return (
    <FieldFrame
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      hintId={`${fieldId}-hint`}
      errorId={`${fieldId}-error`}
    >
      <select
        {...rest}
        id={fieldId}
        className={cn(
          'tap-control',
          error !== undefined && 'tap-control--invalid',
          className,
        )}
        aria-invalid={error !== undefined || undefined}
        aria-describedby={describedByOf(fieldId, hint, error)}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldFrame>
  );
}

/** One column of a `TapTable`. */
export interface TapTableColumnDef<T> {
  /** The key read from each row when there is no `render`. */
  key: string;
  label: string;
  /** `end` right-aligns the column and gives it tabular figures. */
  align?: 'start' | 'end';
  /** Draws the cell. Without it the cell shows the row's own string or number. */
  render?(row: T): ReactNode;
}

/** The props `TapTable` takes. */
export interface TapTableProps<T> {
  columns: TapTableColumnDef<T>[];
  rows: T[];
  /** Returns a stable key per row, which React uses for reconciliation. */
  rowKey: (row: T) => string;
  /** Rendered in place of the whole table when `rows` is empty. */
  empty?: ReactNode;
  /** Makes each row clickable and focusable, and is called on click or Enter. */
  onRowClick?: (row: T) => void;
}

function cellText(row: unknown, key: string): string {
  if (row === null || typeof row !== 'object') return '';
  const value: unknown = Reflect.get(row, key);
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }
  return '';
}

/**
 * Renders rows under column headers, scrolling sideways inside the mount rather
 * than widening it.
 *
 * @remarks
 * A cell with no `render` shows the row's own value under `key` when that value is
 * a string, number, boolean or bigint, and nothing otherwise, so an object or an
 * array needs a `render`. With `empty` and no rows, the table is replaced whole by
 * that node. With `onRowClick` each row becomes focusable and answers Enter and
 * Space as well as a click, and hovers on `--bg-subtle`; the headers and rules
 * follow `--fg-muted` and `--divider`.
 *
 * @example
 * ```tsx
 * import { TapEmptyState, TapTable, useTapQuery } from '@tappify/extension-sdk';
 *
 * function Keywords() {
 *   const keywords = useTapQuery({ kind: 'keywords' });
 *   return (
 *     <TapTable
 *       columns={[
 *         { key: 'term', label: 'Term' },
 *         { key: 'position', label: 'Rank', align: 'end' },
 *       ]}
 *       rows={keywords.data?.keywords ?? []}
 *       rowKey={keyword => keyword.id}
 *       empty={<TapEmptyState title="No keywords tracked yet" />}
 *     />
 *   );
 * }
 * ```
 */
export function TapTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
}: TapTableProps<T>): ReactElement {
  if (rows.length === 0 && empty !== undefined) {
    return <>{empty}</>;
  }

  return (
    <div className="tap-table-wrap">
      <table className="tap-table">
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                className={cn(column.align === 'end' && 'tap-table__end')}
                scope="col"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr
              key={rowKey(row)}
              data-clickable={onRowClick !== undefined}
              tabIndex={onRowClick === undefined ? undefined : 0}
              onClick={
                onRowClick === undefined ? undefined : () => onRowClick(row)
              }
              onKeyDown={
                onRowClick === undefined
                  ? undefined
                  : event => {
                      if (event.key !== 'Enter' && event.key !== ' ') return;
                      event.preventDefault();
                      onRowClick(row);
                    }
              }
            >
              {columns.map(column => (
                <td
                  key={column.key}
                  className={cn(column.align === 'end' && 'tap-table__end')}
                >
                  {column.render
                    ? column.render(row)
                    : cellText(row, column.key)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
