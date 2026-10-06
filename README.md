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
| `@tappify/extension-sdk`                | React hooks, host types, query helpers, and UI components              |
| `@tappify/extension-sdk/manifest`       | Manifest schema, validation, registry constants, and manifest types    |
| `@tappify/extension-sdk/server`         | Request handler, token verification, events, and Node/Express adapters |
| `@tappify/extension-sdk/vite`           | Vite and Module Federation configuration                               |
| `@tappify/extension-sdk/testing`        | Host mocks, fixtures, rendering helpers, and validators                |
| `@tappify/extension-sdk/testing/vitest` | Vitest matcher setup                                                   |
| `@tappify/extension-sdk/testing/jest`   | Jest matcher setup                                                     |
| `@tappify/extension-sdk/codegen`        | Manifest-driven TypeScript generation                                  |
| `@tappify/extension-sdk/styles.css`     | Base styles for SDK UI components                                      |

## Build a contribution

Declare each contribution in `tappify.extension.json`, then export the React
component from its configured entry file. Host data and capabilities are
available only when the manifest declares the corresponding scope.

```tsx
import {
  TapCard,
  TapSkeleton,
  TapStat,
  useTapFilters,
  useTapQuery,
  type TapWidgetProps,
} from '@tappify/extension-sdk';
import '@tappify/extension-sdk/styles.css';

export default function DownloadsWidget(_props: TapWidgetProps) {
  const filters = useTapFilters();
  const downloads = useTapQuery({
    kind: 'series',
    metric: 'downloads',
    range: filters.range,
  });

  return (
    <TapCard title="Downloads">
      {downloads.isLoading && <TapSkeleton lines={1} />}
      {downloads.data && (
        <TapStat
          label="Total"
          value={downloads.data.points.reduce(
            (total, point) => total + point.value,
            0,
          )}
        />
      )}
    </TapCard>
  );
}
```

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
