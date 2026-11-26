# Tappify Extension SDK

Build extensions that run inside Tappify. The SDK provides the React host
bridge, UI components, manifest contracts, Vite integration, server handlers,
code generation, and test utilities used by Tappify extensions.

## Install

```bash
pnpm add @tappify/extension-sdk
```

New extensions should use the Tappify CLI, which creates a complete project
with a manifest, contribution examples, schemas, a server, and tests:

```bash
npm install --global @tappify/cli
tappify extension init my-extension
cd my-extension
pnpm dev
```

The SDK requires Node.js 20 or newer and React 19.

## Package entry points

| Import                                  | Purpose                                                                |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `@tappify/extension-sdk`                | React hooks, host types, and query helpers                             |
| `@tappify/extension-sdk/ui`             | One UI components and layout primitives                                |
| `@tappify/extension-sdk/manifest`       | Manifest schema, validation, registry constants, and manifest types    |
| `@tappify/extension-sdk/server`         | Request handler, token verification, events, and Node/Express adapters |
| `@tappify/extension-sdk/vite`           | Vite and Module Federation configuration                               |
| `@tappify/extension-sdk/testing`        | Host mocks, fixtures, rendering helpers, and validators                |
| `@tappify/extension-sdk/testing/vitest` | Vitest matcher setup                                                   |
| `@tappify/extension-sdk/testing/jest`   | Jest matcher setup                                                     |
| `@tappify/extension-sdk/codegen`        | Manifest-driven TypeScript generation                                  |
| `@tappify/extension-sdk/ui/styles.css`  | One UI component styles                                                |

## Build a contribution

Declare each contribution in `tappify.extension.json`, then export the React
component from its configured entry file. Host data and capabilities are
available only when the manifest declares the corresponding scope.

```tsx
import {
  useTapFilters,
  useTapQuery,
  type TapWidgetProps,
} from '@tappify/extension-sdk';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Metric,
  Skeleton,
} from '@tappify/extension-sdk/ui';
import '@tappify/extension-sdk/ui/styles.css';

export default function DownloadsWidget(_props: TapWidgetProps) {
  const filters = useTapFilters();
  const downloads = useTapQuery({
    kind: 'series',
    metric: 'downloads',
    range: filters.range,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Downloads</CardTitle>
      </CardHeader>
      <CardContent>
        {downloads.isLoading && <Skeleton lines={1} />}
        {downloads.data && (
          <Metric
            label="Total"
            value={downloads.data.points.reduce(
              (total, point) => total + point.value,
              0,
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
```

## Link extension resources to purchase products

A project-installed extension can list the project's in-app purchases and
subscriptions, then link them to its own resources, such as paywalls,
entitlements, or offerings. People create, edit, and submit purchases in Tappify.

Add the grants your extension uses to `scopes` in `tappify.extension.json` and
set `installScope` to `project`. The project owner grants access at install.
For an existing install, the owner must approve the new grants before use.
`purchases:link` requires a justification of 20 to 500 characters.

```json
{
  "installScope": "project",
  "scopes": [
    { "key": "ui:render" },
    { "key": "purchases:read" },
    {
      "key": "purchases:link",
      "justification": "Connect our paywalls to the products you select in this project."
    }
  ]
}
```

Use `useTapQuery({ kind: 'purchases' })` to render a product picker, or
`await tap.data.query({ kind: 'purchases' })` to load the catalogue on demand.
Both return `{ products }` across all apps in the project, including eligible
products still being provisioned. The catalogue is independent of the date,
platform, and country filters.

Pass the selected product's Tappify UUID (`product.id`) as the link's
`productId`. The catalogue's `product.productId` is the store identifier.
Call `link` once for each selected product. Each call adds one association and
returns the three fields you sent. Repeating a call with the same fields is safe.

```ts
import { useTap, useTapQuery } from '@tappify/extension-sdk';

export function usePaywallProducts(paywallId: string) {
  const tap = useTap();
  const catalogue = useTapQuery({ kind: 'purchases' });

  return {
    catalogue,
    linkProduct: (product: { id: string }) =>
      tap.products.link({
        productId: product.id,
        resourceType: 'paywall',
        resourceId: paywallId,
      }),
  };
}
```

Choose a `resourceType` of up to 64 ASCII characters. It starts with a letter or
digit and can also contain `.`, `_`, and `-`. Use your resource's stable ID as
`resourceId`, up to 200 characters, with at least one non-whitespace character
and no control characters. A call made without its grant rejects with
`TAP_SCOPE_MISSING`.

## Laying out a widget or page

Tappify draws the frame around everything an extension renders: its logo and
name, the title, the connection state and the loading and error states. A
widget, tab or page returns only its content.

- A widget sits on a grey surface. Return `Metric`, `MetricBand`, a chart or a
  `Table` directly, without a `Card` or a title of its own.
- A page sits on a white card. Group its content with `Panel` and `Grid`, and
  leave `PageHeader` out.

```tsx
import { Grid, LineChart, Metric, Panel } from '@tappify/extension-sdk/ui';

export default function Overview() {
  return (
    <Grid minColumnWidth={200}>
      <Panel>
        <Metric label="MRR" value="$24,860" delta={0.041} />
      </Panel>
      <Panel title="MRR" caption="Last 30 days">
        <LineChart
          label="MRR by day"
          categories={['Nov 15', 'Nov 16', 'Nov 17', 'Nov 18', 'Nov 19']}
          series={[{ name: 'MRR', values: [50, 52, 55, 58, 61] }]}
        />
      </Panel>
    </Grid>
  );
}
```

Charts, bars and funnels are drawn in the extension's accent color. Set it
once in the extension's stylesheet; everything else keeps Tappify's colors.

```css
.tap-root {
  --tap-accent: #7856ff;
}
```

## Migrating UI imports

Version 2 replaces the legacy UI surface with One UI. Import frontend components
from `@tappify/extension-sdk/ui` and load
`@tappify/extension-sdk/ui/styles.css`. The package root remains the entry for
hooks, host types, and query helpers.

```tsx
// Before
import { TapButton, TapCard } from '@tappify/extension-sdk';
import '@tappify/extension-sdk/styles.css';

// After
import { Button, Card } from '@tappify/extension-sdk/ui';
import '@tappify/extension-sdk/ui/styles.css';
```

Removed names map as follows: `TapButton` → `Button`, `TapCard` → the compound
`Card` parts, `TapPageHeader` → `PageHeader`, `TapSkeleton` → `Skeleton`,
`TapEmptyState` → `EmptyState`, `TapErrorState` → `ErrorState`, `TapStat` →
`Metric`, `TapInput` → `Field` with `Input` or `Textarea`, `TapSelect` → `Field`
with `Select`, `TapTable` → the compound `Table` parts, `TapDialog` → the
compound `Dialog` parts, `TapForm` → `SchemaForm`, and `formFields` →
`schemaFields`. No compatibility aliases are retained.

Add the SDK plugin to the extension's Vite config:

```ts
import { tappifyExtension } from '@tappify/extension-sdk/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tappifyExtension()],
  build: { target: 'esnext' },
});
```

## Add a server procedure

The server entry point exposes a fetch-style handler and adapters for common
Node runtimes. Procedure inputs, credentials, and responses are typed from the
extension manifest and its referenced JSON Schemas.

```ts
import {
  createTappifyHandler,
  type TappifyHandlerOptions,
} from '@tappify/extension-sdk/server';

const options: TappifyHandlerOptions = {
  extensionId: 'my-extension',
  health: () => ({ ok: true, version: '1.0.0' }),
  procedures: {
    getSummary: request => ({ projectId: request.context.projectId }),
  },
};

export const handler = createTappifyHandler(options);
```

## Test an extension

`renderWithTap` renders a contribution inside the same context contract the
host provides. It returns a mock for inspecting storage, telemetry, navigation,
toasts, events, and server calls.

```tsx
import { renderWithTap } from '@tappify/extension-sdk/testing';
import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import DownloadsWidget from './DownloadsWidget';

it('renders host data', async () => {
  renderWithTap(<DownloadsWidget config={{}} />, {
    scopes: ['ui:render', 'analytics:read'],
  });

  expect(await screen.findByText('Downloads')).toBeInTheDocument();
});
```

Register the SDK matchers from the appropriate test setup entry point:

```ts
// Vitest setup file
import '@tappify/extension-sdk/testing/vitest';
```

## Compatibility and releases

The `sdk` field in `tappify.extension.json` is the compatibility contract
between an extension and the Tappify host. Use a caret range within the major
version used to build the extension:

```json
{
  "sdk": "^2.0.0"
}
```

Releases follow semantic versioning. Conventional commits drive
`semantic-release`: `fix` creates a patch, `feat` creates a minor, and a
`BREAKING CHANGE` creates a major release. The `main` branch publishes stable
versions and `develop` publishes the `beta` channel.

## Documentation

- [Build your first extension](https://docs.tappify.ai/extensions/start/your-first-extension)
- [Manifest reference](https://docs.tappify.ai/extensions/reference/manifest)
- [Frontend API](https://docs.tappify.ai/extensions/reference/frontend-api)
- [Server API](https://docs.tappify.ai/extensions/reference/server-api)
- [Testing API](https://docs.tappify.ai/extensions/reference/testing-api)

## License

MIT
