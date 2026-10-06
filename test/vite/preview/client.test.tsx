import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type ComponentType } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useTap, useTapSize, useTapTheme } from '../../../src';
import { defineManifest } from '../../../src/manifest/define';
import type { ExtensionManifest } from '../../../src/manifest/types';
import {
  LocalPreview,
  componentFromModule,
  type PreviewModuleLoader,
} from '../../../src/vite/preview/client';

const manifest: ExtensionManifest = defineManifest({
  id: 'surface-lab',
  name: 'Surface Lab',
  description: 'Exercises every UI surface in the local preview host.',
  icon: 'icon.svg',
  category: 'product_analytics',
  sdk: '^2.0.0',
  visibility: 'private',
  installScope: 'project',
  scopes: [{ key: 'ui:render' }],
  contributes: {
    pages: [
      { id: 'explore', title: 'Explore', entry: 'src/pages/explore.tsx' },
    ],
    tabs: [
      {
        id: 'trends',
        title: 'Trends',
        entry: 'src/tabs/trends.tsx',
        page: 'analytics',
      },
    ],
    widgets: [
      {
        id: 'summary',
        title: 'Summary',
        entry: 'src/widgets/summary.tsx',
        page: 'analytics',
        slot: 'kpi-row',
        size: '1x1',
      },
    ],
    rowActions: [
      {
        id: 'inspect',
        title: 'Inspect',
        entry: 'src/row-actions/inspect.tsx',
        table: 'analytics.keywords',
      },
    ],
    settings: { entry: 'src/settings.tsx', schema: { type: 'object' } },
  },
});

function propsText(props: Record<string, unknown>): string {
  const serializable = Object.fromEntries(
    Object.entries(props).filter(([, value]) => typeof value !== 'function'),
  );
  return JSON.stringify(serializable);
}

const Surface: ComponentType<Record<string, unknown>> = props => (
  <output aria-label="surface props">{propsText(props)}</output>
);

const surfaceLoader: PreviewModuleLoader = vi.fn(async () => ({
  default: Surface,
}));

describe('LocalPreview', () => {
  it('loads every local contribution and supplies its host props', async () => {
    const user = userEvent.setup();
    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={surfaceLoader}
      />,
    );

    expect(await screen.findByLabelText('surface props')).toHaveTextContent(
      '{"params":{"pageId":"explore","path":"/"}}',
    );

    await user.selectOptions(
      screen.getByLabelText('Contribution'),
      './tabs/trends',
    );
    expect(await screen.findByLabelText('surface props')).toHaveTextContent(
      '{}',
    );

    await user.selectOptions(
      screen.getByLabelText('Contribution'),
      './widgets/summary',
    );
    expect(await screen.findByLabelText('surface props')).toHaveTextContent(
      '{"config":{}}',
    );

    await user.selectOptions(
      screen.getByLabelText('Contribution'),
      './rowActions/inspect',
    );
    expect(await screen.findByLabelText('surface props')).toHaveTextContent(
      '"term":"photo editor"',
    );

    await user.selectOptions(
      screen.getByLabelText('Contribution'),
      './settings',
    );
    expect(await screen.findByLabelText('surface props')).toHaveTextContent(
      '{"values":{}}',
    );
  });

  it('changes theme, viewport and host surface size', async () => {
    const user = userEvent.setup();
    const Probe = () => (
      <output aria-label="host context">
        {useTapTheme().mode}:{useTapSize()}
      </output>
    );
    const loader: PreviewModuleLoader = async () => ({ default: Probe });

    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={loader}
      />,
    );

    expect(await screen.findByLabelText('host context')).toHaveTextContent(
      'light:slot',
    );
    await user.selectOptions(screen.getByLabelText('Theme'), 'dark');
    await user.selectOptions(screen.getByLabelText('Surface size'), 'page');
    await user.selectOptions(screen.getByLabelText('Viewport'), 'mobile');

    expect(await screen.findByLabelText('host context')).toHaveTextContent(
      'dark:page',
    );
    expect(screen.getByLabelText('Preview canvas')).toHaveAttribute(
      'data-viewport',
      'mobile',
    );
  });

  it('resets fixture and component state without restarting Vite', async () => {
    const user = userEvent.setup();
    const Stateful = () => {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount(value => value + 1)}>
          Count {count}
        </button>
      );
    };
    const loader: PreviewModuleLoader = async () => ({ default: Stateful });

    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={loader}
      />,
    );

    await user.click(await screen.findByRole('button', { name: 'Count 0' }));
    expect(screen.getByRole('button', { name: 'Count 1' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset fixtures' }));
    expect(
      await screen.findByRole('button', { name: 'Count 0' }),
    ).toBeInTheDocument();
  });

  it('labels an explicitly deployed remote as external', async () => {
    render(
      <LocalPreview
        manifest={manifest}
        remote="https://cdn.example.com/remoteEntry.js"
        loader={surfaceLoader}
      />,
    );

    expect(await screen.findByText(/External remote/)).toBeInTheDocument();
    expect(screen.getByText(/Fixture data/)).toBeInTheDocument();
  });

  it('explains how to add UI when the manifest has no surfaces', () => {
    render(
      <LocalPreview
        manifest={{ ...manifest, contributes: {} }}
        remote="http://localhost:5273/remoteEntry.js"
        loader={surfaceLoader}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'No UI contributions' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/tappify extension add/)).toBeInTheDocument();
  });

  it('shows a remote load failure instead of a blank canvas', async () => {
    const loader: PreviewModuleLoader = async () => {
      throw new Error('remote entry refused the connection');
    };

    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={loader}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'remote entry refused the connection',
    );
  });

  it('reports a missing component export with the expose name', () => {
    expect(() => componentFromModule({}, './widgets/summary')).toThrow(
      './widgets/summary did not default-export a React component',
    );
  });

  it('catches a contribution render failure', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const Broken = () => {
      throw new Error('surface exploded');
    };
    const loader: PreviewModuleLoader = async () => ({ default: Broken });

    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={loader}
      />,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'surface exploded',
    );
    consoleError.mockRestore();
  });

  it('states that procedures require live preview', async () => {
    const ProcedureProbe = () => {
      const tap = useTap();
      void tap.server.getSummary({}).catch(() => undefined);
      return <div>Procedure requested</div>;
    };
    const loader: PreviewModuleLoader = async () => ({
      default: ProcedureProbe,
    });

    render(
      <LocalPreview
        manifest={manifest}
        remote="http://localhost:5273/remoteEntry.js"
        loader={loader}
      />,
    );

    expect(
      await screen.findByText(/Server procedures are unavailable locally/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText('Procedure requested')).toBeInTheDocument(),
    );
  });
});
