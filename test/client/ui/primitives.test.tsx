import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  TapButton,
  TapCard,
  TapEmptyState,
  TapErrorState,
  TapInput,
  TapPageHeader,
  TapSelect,
  TapSkeleton,
  TapStat,
  TapTable,
} from '../../../src/client/ui/primitives';

describe('TapButton', () => {
  it('renders a primary button that calls its handler', async () => {
    const onClick = vi.fn();
    render(<TapButton onClick={onClick}>Refresh</TapButton>);

    const button = screen.getByRole('button', { name: 'Refresh' });
    expect(button).toHaveClass('tap-btn', 'tap-btn--primary');

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('blocks clicks while loading and announces the busy state', async () => {
    const onClick = vi.fn();
    render(
      <TapButton loading onClick={onClick}>
        Save
      </TapButton>,
    );

    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('TapCard', () => {
  it('renders a title, body and footer', () => {
    render(
      <TapCard title="Funnel" footer="Updated 2 minutes ago">
        <p>Body</p>
      </TapCard>,
    );

    expect(screen.getByText('Funnel')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
    expect(screen.getByText('Updated 2 minutes ago')).toBeInTheDocument();
  });
});

describe('TapPageHeader, TapSkeleton, TapEmptyState, TapErrorState, TapStat', () => {
  it('renders a page header with a description', () => {
    render(<TapPageHeader title="Explore" description="Every funnel" />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Explore' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Every funnel')).toBeInTheDocument();
  });

  it('renders the requested number of skeleton lines', () => {
    const { container } = render(<TapSkeleton lines={3} />);

    expect(container.querySelectorAll('.tap-skeleton')).toHaveLength(3);
  });

  it('renders an empty state and an error state with a retry', async () => {
    const onRetry = vi.fn();
    render(
      <div>
        <TapEmptyState title="No funnels yet" description="Ship a release." />
        <TapErrorState
          title="Could not load the funnel"
          description="Your server returned 503."
          code="FUNNEL_UNAVAILABLE"
          onRetry={onRetry}
        />
      </div>,
    );

    expect(screen.getByText('No funnels yet')).toBeInTheDocument();
    expect(screen.getByText('FUNNEL_UNAVAILABLE')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('renders a stat with a signed delta', () => {
    render(<TapStat label="Installs" value="1,204" delta={-0.08} />);

    expect(screen.getByText('Installs')).toBeInTheDocument();
    expect(screen.getByText('1,204')).toBeInTheDocument();
    expect(screen.getByText('-8%')).toBeInTheDocument();
  });
});

describe('TapInput and TapSelect', () => {
  it('associates labels, hints and errors with their control', () => {
    render(
      <div>
        <TapInput label="Refresh minutes" hint="Between 5 and 120" />
        <TapSelect
          label="Platform"
          error="Pick a platform"
          options={[
            { value: 'ios', label: 'iOS' },
            { value: 'android', label: 'Android' },
          ]}
        />
      </div>,
    );

    const input = screen.getByLabelText('Refresh minutes');
    expect(input).toHaveAccessibleDescription('Between 5 and 120');

    const select = screen.getByLabelText('Platform');
    expect(select).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pick a platform')).toBeInTheDocument();
  });

  it('renders a textarea when multiline is set', () => {
    render(<TapInput label="Notes" multiline />);

    expect(screen.getByLabelText('Notes').tagName).toBe('TEXTAREA');
  });
});

describe('TapTable', () => {
  interface Row {
    id: string;
    term: string;
    position: number;
  }

  const rows: Row[] = [
    { id: '1', term: 'photo editor', position: 4 },
    { id: '2', term: 'collage', position: 11 },
  ];

  it('renders columns and rows and reports clicks', async () => {
    const onRowClick = vi.fn();
    render(
      <TapTable<Row>
        columns={[
          { key: 'term', label: 'Term' },
          { key: 'position', label: 'Position', align: 'end' },
        ]}
        rows={rows}
        rowKey={row => row.id}
        onRowClick={onRowClick}
      />,
    );

    expect(screen.getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByText('collage'));
    expect(onRowClick).toHaveBeenCalledWith(rows[1]);
  });

  it('activates a clickable row from the keyboard', async () => {
    const onRowClick = vi.fn();
    render(
      <TapTable<Row>
        columns={[{ key: 'term', label: 'Term' }]}
        rows={rows}
        rowKey={row => row.id}
        onRowClick={onRowClick}
      />,
    );

    await userEvent.tab();
    expect(screen.getAllByRole('row')[1]).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);

    await userEvent.keyboard(' ');
    expect(onRowClick).toHaveBeenCalledTimes(2);
  });

  it('renders the empty slot when there are no rows', () => {
    render(
      <TapTable<Row>
        columns={[{ key: 'term', label: 'Term' }]}
        rows={[]}
        rowKey={row => row.id}
        empty={<TapEmptyState title="No keywords" />}
      />,
    );

    expect(screen.getByText('No keywords')).toBeInTheDocument();
  });
});
