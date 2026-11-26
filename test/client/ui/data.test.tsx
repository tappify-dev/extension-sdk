import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  BarChart,
  Funnel,
  KeyValueList,
  LineChart,
  Metric,
  MetricBand,
  Panel,
  Tabs,
} from '../../../src/ui';

describe('data display components', () => {
  it('heads a panel with its title and caption', () => {
    render(
      <Panel title="Revenue" caption="Last 30 days">
        <Metric label="Total" value="$31,420" />
      </Panel>,
    );

    expect(screen.getByText('Revenue')).toBeVisible();
    expect(screen.getByText('Last 30 days')).toBeVisible();
    expect(screen.getByText('$31,420')).toBeVisible();
  });

  it('draws no heading row for a panel with nothing to head', () => {
    const { container } = render(<Panel>Body</Panel>);

    expect(container.querySelector('[data-slot="panel-head"]')).toBeNull();
  });

  it('separates the figures of a metric band', () => {
    const { container } = render(
      <MetricBand>
        <Metric label="MRR" value="$24,860" size="lg" />
        <Metric label="Active subscriptions" value="1,842" />
        <Metric label="Active trials" value="164" />
      </MetricBand>,
    );

    expect(container.querySelectorAll('.tap-metric-band__rule')).toHaveLength(
      2,
    );
    expect(screen.getByText('$24,860').parentElement).toHaveAttribute(
      'data-size',
      'lg',
    );
  });

  it('marks the showing tab and reports the one the user chooses', async () => {
    const onChange = vi.fn();
    render(
      <Tabs
        label="Views"
        value="overview"
        onChange={onChange}
        tabs={[
          { id: 'overview', label: 'Overview' },
          { id: 'funnels', label: 'Funnels' },
        ]}
      />,
    );

    const tabs = within(screen.getByRole('tablist', { name: 'Views' }));
    expect(tabs.getByRole('tab', { name: 'Overview' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await userEvent.click(tabs.getByRole('tab', { name: 'Funnels' }));
    expect(onChange).toHaveBeenCalledWith('funnels');
  });

  it('lists each label with its value', () => {
    render(
      <KeyValueList
        rows={[
          { label: 'Plan', value: 'Annual' },
          { label: 'Renews', value: 'Aug 14, 2027' },
        ]}
      />,
    );

    expect(screen.getByText('Plan').nextElementSibling).toHaveTextContent(
      'Annual',
    );
    expect(screen.getByText('Renews').nextElementSibling).toHaveTextContent(
      'Aug 14, 2027',
    );
  });
});

describe('charts', () => {
  it('names a line chart and its series, and scales lines from zero', () => {
    const { container } = render(
      <LineChart
        label="Daily active users"
        categories={['Nov 1', 'Nov 2', 'Nov 3']}
        formatValue={value => `${value} users`}
        series={[
          { name: 'This period', values: [0, 50, 100] },
          {
            name: 'Previous period',
            values: [10, 20, 30],
            tone: 'muted',
            dashed: true,
          },
        ]}
      />,
    );

    const plot = screen.getByRole('img', { name: 'Daily active users' });
    expect(plot).toBeVisible();
    const legend = within(
      container.querySelector<HTMLElement>('[data-slot="chart-legend"]')!,
    );
    expect(legend.getByText('This period')).toBeVisible();
    expect(legend.getByText('Previous period')).toBeVisible();

    const lines = container.querySelectorAll('polyline');
    expect(lines[0]).toHaveAttribute('points', '0,100 50,50 100,0');
    expect(lines[0]).toHaveAttribute('data-tone', 'accent');
    expect(lines[1]).toHaveAttribute('data-tone', 'muted');
    expect(lines[1]).toHaveAttribute('data-dashed');

    const scale = container.querySelector('.tap-chart__scale');
    expect(scale).toHaveTextContent('100 users50 users0 users');
  });

  it('shows the values of the nearest point on hover and hides them on leave', () => {
    render(
      <LineChart
        label="Daily active users"
        categories={['Nov 1', 'Nov 2', 'Nov 3']}
        series={[
          { name: 'This period', values: [0, 50, 100] },
          { name: 'Previous period', values: [10, 20, 30] },
        ]}
      />,
    );
    const plot = screen.getByRole('img', { name: 'Daily active users' });
    vi.spyOn(plot, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 300, 200),
    );

    fireEvent.pointerMove(plot, { clientX: 160 });

    const tooltip = within(
      plot.querySelector<HTMLElement>('[data-slot="chart-tooltip"]')!,
    );
    expect(tooltip.getByText('Nov 2')).toBeInTheDocument();
    expect(tooltip.getByText('50')).toBeInTheDocument();
    expect(tooltip.getByText('20')).toBeInTheDocument();

    fireEvent.pointerLeave(plot);
    expect(plot.querySelector('[data-slot="chart-tooltip"]')).toBeNull();
  });

  it('gives assistive technology every value as a table', () => {
    render(
      <BarChart
        label="Trials by week"
        categories={['Nov 3', 'Nov 10']}
        series={[{ name: 'New trials', values: [50, 100] }]}
      />,
    );

    const table = within(screen.getByRole('table', { name: 'Trials by week' }));
    expect(table.getByRole('row', { name: 'Nov 10 100' })).toBeInTheDocument();
  });

  it('sizes each bar against the highest value', () => {
    const { container } = render(
      <BarChart
        label="Trials by week"
        categories={['Nov 3', 'Nov 10']}
        series={[
          { name: 'New trials', values: [50, 100] },
          { name: 'Converted to paid', values: [25, 0] },
        ]}
      />,
    );

    const bars = [
      ...container.querySelectorAll<HTMLElement>('.tap-chart__bar'),
    ];
    expect(bars.map(bar => bar.style.height)).toEqual([
      '50%',
      '25%',
      '100%',
      '0%',
    ]);
    expect(container.querySelector('.tap-chart__axis')).toHaveTextContent(
      'Nov 3Nov 10',
    );
  });

  it('shows each funnel stage as a share of the first', () => {
    const { container } = render(
      <Funnel
        steps={[
          { label: 'Opened the app', value: 12480 },
          { label: 'Finished onboarding', value: 8112 },
        ]}
        formatValue={value => `${value} people`}
      />,
    );

    expect(screen.getByText('12480 people')).toBeVisible();
    expect(screen.getByText('8112 people, 65%')).toBeVisible();
    const fills = [
      ...container.querySelectorAll<HTMLElement>('.tap-funnel__fill'),
    ];
    expect(fills.map(fill => fill.style.width)).toEqual(['100%', '65%']);
  });
});
