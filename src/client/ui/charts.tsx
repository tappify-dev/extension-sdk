import { useState, type PointerEvent, type ReactNode } from 'react';
import { cn } from './cn';

/**
 * The color a series is drawn in: the extension's accent, Tappify's dark
 * green, or a quiet grey for a comparison.
 */
export type ChartTone = 'accent' | 'ink' | 'muted';

/** One named run of values in a chart. */
export interface ChartSeries {
  /** Draws a line series dashed, for a comparison such as the previous period. */
  dashed?: boolean;
  name: string;
  tone?: ChartTone;
  /** One value per category, in order. */
  values: readonly number[];
}

const DEFAULT_TONES: readonly ChartTone[] = ['accent', 'ink', 'muted'];
const NICE_STEPS = [1, 2, 2.5, 5, 10];

function toneOf(series: ChartSeries, index: number): ChartTone {
  return series.tone ?? DEFAULT_TONES[index % DEFAULT_TONES.length] ?? 'accent';
}

function ceiling(series: readonly ChartSeries[]): number {
  const peak = Math.max(0, ...series.flatMap(entry => entry.values));
  if (peak <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const step = NICE_STEPS.find(candidate => candidate * magnitude >= peak);
  return (step ?? 10) * magnitude;
}

function compact(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function Legend({ series }: { series: readonly ChartSeries[] }) {
  return (
    <ul className="tap-chart__legend" data-slot="chart-legend">
      {series.map((entry, index) => (
        <li className="tap-chart__legend-item" key={entry.name}>
          <span
            aria-hidden="true"
            className="tap-chart__swatch"
            data-dashed={entry.dashed ? '' : undefined}
            data-tone={toneOf(entry, index)}
          />
          {entry.name}
        </li>
      ))}
    </ul>
  );
}

function DataTable({
  categories,
  formatValue,
  label,
  series,
}: {
  categories: readonly string[];
  formatValue: (value: number) => string;
  label: string;
  series: readonly ChartSeries[];
}) {
  return (
    <table className="tap-chart__data">
      <caption>{label}</caption>
      <thead>
        <tr>
          <td />
          {series.map(entry => (
            <th key={entry.name} scope="col">
              {entry.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {categories.map((category, position) => (
          <tr key={category}>
            <th scope="row">{category}</th>
            {series.map(entry => (
              <td key={entry.name}>
                {entry.values[position] === undefined
                  ? ''
                  : formatValue(entry.values[position])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface FrameProps {
  /** Which categories get a label under the plot. */
  axisPositions: readonly number[];
  categories: readonly string[];
  children: ReactNode;
  className?: string;
  formatValue: (value: number) => string;
  height: number;
  label: string;
  /** Where along the plot, from 0 to 1, category `position` sits. */
  place: (position: number) => number;
  series: readonly ChartSeries[];
  slot: string;
  top: number;
}

function Frame({
  axisPositions,
  categories,
  children,
  className,
  formatValue,
  height,
  label,
  place,
  series,
  slot,
  top,
}: FrameProps) {
  const [active, setActive] = useState<number | null>(null);
  const count = categories.length;

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    if (box.width === 0 || count === 0) return;
    const ratio = Math.min(
      Math.max((event.clientX - box.left) / box.width, 0),
      1,
    );
    let nearest = 0;
    for (let position = 1; position < count; position += 1) {
      if (
        Math.abs(place(position) - ratio) < Math.abs(place(nearest) - ratio)
      ) {
        nearest = position;
      }
    }
    setActive(nearest);
  };

  return (
    <div className={cn('tap-ui-chart', className)} data-slot={slot}>
      <div className="tap-chart__body">
        <div aria-hidden="true" className="tap-chart__scale" style={{ height }}>
          <span>{formatValue(top)}</span>
          <span>{formatValue(top / 2)}</span>
          <span>{formatValue(0)}</span>
        </div>
        <div className="tap-chart__main">
          <div
            aria-label={label}
            className="tap-chart__plot"
            data-slot="chart-plot"
            onPointerLeave={() => setActive(null)}
            onPointerMove={onMove}
            role="img"
            style={{ height }}
          >
            {children}
            {active === null ? null : (
              <>
                <span
                  className="tap-chart__cursor"
                  style={{ left: `${place(active) * 100}%` }}
                />
                <div
                  className="tap-chart__tooltip"
                  data-side={place(active) > 0.5 ? 'start' : 'end'}
                  data-slot="chart-tooltip"
                  style={{ left: `${place(active) * 100}%` }}
                >
                  <div className="tap-chart__tooltip-title">
                    {categories[active]}
                  </div>
                  {series.map((entry, index) => (
                    <div className="tap-chart__tooltip-row" key={entry.name}>
                      <span
                        className="tap-chart__swatch"
                        data-dashed={entry.dashed ? '' : undefined}
                        data-tone={toneOf(entry, index)}
                      />
                      <span>{entry.name}</span>
                      <strong>
                        {entry.values[active] === undefined
                          ? ''
                          : formatValue(entry.values[active])}
                      </strong>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
          <div aria-hidden="true" className="tap-chart__axis">
            {axisPositions.map(position => (
              <span
                data-edge={
                  place(position) === 0
                    ? 'start'
                    : place(position) === 1
                      ? 'end'
                      : undefined
                }
                key={position}
                style={{ left: `${place(position) * 100}%` }}
              >
                {categories[position]}
              </span>
            ))}
          </div>
        </div>
      </div>
      <Legend series={series} />
      <DataTable
        categories={categories}
        formatValue={formatValue}
        label={label}
        series={series}
      />
    </div>
  );
}

/** Props shared by {@link LineChart} and {@link BarChart}. */
export interface ChartProps {
  /** The label of each point along the bottom, in order. */
  categories: readonly string[];
  className?: string;
  /** Formats a value on the scale and in the hover details. */
  formatValue?: (value: number) => string;
  /** Height of the plot in pixels. */
  height?: number;
  /** Describes the chart for assistive technology. */
  label: string;
  /** Each series has one value per category. */
  series: readonly ChartSeries[];
}

/** Props for a line chart. */
export type LineChartProps = ChartProps;

/**
 * Draws one line per series on a scale from zero, with the values of a point
 * shown on hover.
 *
 * @example
 * ```tsx
 * import { LineChart } from '@tappify/extension-sdk/ui';
 *
 * function ActiveUsers() {
 *   return (
 *     <LineChart
 *       label="Daily active users"
 *       categories={['Nov 13', 'Nov 14', 'Nov 15', 'Nov 16']}
 *       series={[
 *         { name: 'This period', values: [4200, 4500, 4000, 5000] },
 *         {
 *           name: 'Previous period',
 *           values: [3800, 4000, 3900, 4300],
 *           tone: 'muted',
 *           dashed: true,
 *         },
 *       ]}
 *     />
 *   );
 * }
 * ```
 */
export function LineChart({
  categories,
  className,
  formatValue = compact,
  height = 200,
  label,
  series,
}: LineChartProps) {
  const top = ceiling(series);
  const last = Math.max(categories.length - 1, 1);
  const ends = new Set([0, Math.floor(last / 2), categories.length - 1]);
  return (
    <Frame
      axisPositions={[...ends].filter(position => position >= 0)}
      categories={categories}
      className={className}
      formatValue={formatValue}
      height={height}
      label={label}
      place={position => position / last}
      series={series}
      slot="line-chart"
      top={top}
    >
      <svg
        aria-hidden="true"
        className="tap-chart__lines"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
      >
        {series.map((entry, index) => (
          <polyline
            className="tap-chart__line"
            data-dashed={entry.dashed ? '' : undefined}
            data-tone={toneOf(entry, index)}
            key={entry.name}
            points={entry.values
              .map(
                (value, position) =>
                  `${(position / last) * 100},${100 - (value / top) * 100}`,
              )
              .join(' ')}
          />
        ))}
      </svg>
    </Frame>
  );
}

/** Props for a grouped bar chart. */
export type BarChartProps = ChartProps;

/**
 * Draws one group of bars per category on a scale from zero, with the values
 * of a group shown on hover.
 *
 * @example
 * ```tsx
 * import { BarChart } from '@tappify/extension-sdk/ui';
 *
 * function Trials() {
 *   return (
 *     <BarChart
 *       label="New trials and conversions by week"
 *       categories={['Oct 27', 'Nov 3', 'Nov 10']}
 *       series={[
 *         { name: 'New trials', values: [70, 78, 74] },
 *         { name: 'Converted to paid', values: [26, 29, 27] },
 *       ]}
 *     />
 *   );
 * }
 * ```
 */
export function BarChart({
  categories,
  className,
  formatValue = compact,
  height = 200,
  label,
  series,
}: BarChartProps) {
  const top = ceiling(series);
  const count = Math.max(categories.length, 1);
  return (
    <Frame
      axisPositions={categories.map((_, position) => position)}
      categories={categories}
      className={className}
      formatValue={formatValue}
      height={height}
      label={label}
      place={position => (position + 0.5) / count}
      series={series}
      slot="bar-chart"
      top={top}
    >
      <div className="tap-chart__groups">
        {categories.map((category, position) => (
          <div className="tap-chart__group" key={category}>
            {series.map((entry, index) => (
              <span
                className="tap-chart__bar"
                data-tone={toneOf(entry, index)}
                key={entry.name}
                style={{
                  height: `${((entry.values[position] ?? 0) / top) * 100}%`,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </Frame>
  );
}

/** One stage of a {@link Funnel}. */
export interface FunnelStep {
  label: string;
  value: number;
}

/** Props for a funnel. */
export interface FunnelProps {
  className?: string;
  /** Formats a step's value. Defaults to the reader's locale number format. */
  formatValue?: (value: number) => string;
  /** The stages in order; each bar is sized against the first. */
  steps: readonly FunnelStep[];
}

/**
 * Shows how many reach each stage, as a share of the first.
 *
 * @example
 * ```tsx
 * import { Funnel } from '@tappify/extension-sdk/ui';
 *
 * function Onboarding() {
 *   return (
 *     <Funnel
 *       steps={[
 *         { label: 'Opened the app', value: 12480 },
 *         { label: 'Finished onboarding', value: 8112 },
 *       ]}
 *     />
 *   );
 * }
 * ```
 */
export function Funnel({
  className,
  formatValue = value => value.toLocaleString(),
  steps,
}: FunnelProps) {
  const first = steps[0]?.value ?? 0;
  return (
    <ol className={cn('tap-ui-funnel', className)} data-slot="funnel">
      {steps.map((step, index) => {
        const share = first > 0 ? Math.round((step.value / first) * 100) : 0;
        return (
          <li className="tap-funnel__step" key={step.label}>
            <div className="tap-funnel__row">
              <span>{step.label}</span>
              <span className="tap-funnel__value">
                {formatValue(step.value)}
                {index > 0 ? `, ${share}%` : ''}
              </span>
            </div>
            <div aria-hidden="true" className="tap-funnel__track">
              <span
                className="tap-funnel__fill"
                style={{ width: `${Math.min(share, 100)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
