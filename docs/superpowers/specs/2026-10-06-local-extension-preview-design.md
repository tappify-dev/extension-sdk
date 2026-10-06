# Local Extension Preview Design

**Date:** 2026-10-06
**Status:** Approved; implementation pending

## Purpose

`tappify extension dev` must provide a complete local UI preview without
depending on the developer portal, Tappify authentication, a registered
extension, a published release, or an internet connection.

The developer portal will no longer render local extension code. Its existing
Preview step, localhost remote-entry input, and hosted preview frame will be
removed.

## Current problem

The current command starts the extension's Vite server, then points the
developer at a hosted developer-portal page. That hosted page attempts to load
`http://localhost:5273/remoteEntry.js` inside a restricted iframe. It also gets
its contribution list from a live or pending backend release instead of the
manifest in the developer's checkout.

This creates the wrong ownership boundary and several failure modes:

- a hosted application is responsible for reaching a process on the user's
  machine;
- the portal and local manifest can disagree about available contributions;
- portal authentication, iframe restrictions, mixed-content rules, CORS, and
  private-network rules sit in the local edit loop;
- the preview runtime can drift from the SDK used by the extension;
- an unpublished extension cannot rely on the portal having the state needed
  to describe its local UI.

## Product model

There are two distinct development modes.

### Local preview

```bash
tappify extension dev
```

This mode is for developing UI contributions quickly. It uses the local
manifest, local bundle, SDK fixtures, and an in-memory Tap bridge. It does not
contact Tappify services or use real workspace data.

### Live sandbox preview

```bash
tappify extension dev --live
```

This mode creates a temporary dev installation on the vendor's sandbox
project and opens the real Tappify host. It tests real placement, permissions,
data, storage, events, tools, and backend relays. A tunnel is relevant only
when a Tappify-hosted backend must call a server running on the developer's
machine.

Local preview is the default. Live preview is an explicit integration test.

## Local URLs

The default Vite server owns these URLs in development:

```text
http://localhost:5273/                 local preview UI
http://localhost:5273/remoteEntry.js   federated extension bundle
```

The root URL is the public developer experience. No internal or underscored
preview path is printed or documented. Tappify extensions are hosted modules,
not standalone websites, so the SDK's development plugin owns `/` while the
development server is running.

Production builds remain bundles. The preview HTML and its fixture runtime
must never be emitted into the publishable extension artifact.

## Architecture

### SDK Vite plugin

`@tappify/extension-sdk/vite` will provide the local preview host as part of
the existing `tappifyExtension()` plugin.

In serve mode, the plugin will:

1. serve the preview document at `/`;
2. expose the validated local manifest to the preview runtime through a
   Vite virtual module;
3. load the local remote entry from `/remoteEntry.js`;
4. provide the same module-federation shared dependencies as the real host;
5. send a full preview reload when the manifest changes;
6. keep the existing extension component HMR behavior;
7. bind to loopback by default and carry no Tappify credentials.

The preview host is SDK-owned internal code. Extension projects do not copy,
configure, or maintain it.

The plugin currently derives federation exposes once at startup. If a
manifest edit changes the contribution/expose topology, the CLI must restart
the managed Vite child before reopening the preview. Edits that do not change
the expose topology can use a normal full-page reload. This avoids pretending
that Vite's federation configuration can be mutated after startup.

### Local preview runtime

The runtime will:

- list every UI contribution from the local manifest;
- render pages, tabs, widgets, row actions, and settings panels;
- use `TapHostProvider`, `createHostQueryClient`, and `createTapMock` from the
  installed SDK version;
- share React, React DOM, JSX runtime, TanStack Query, and the SDK with the
  loaded remote exactly as the host contract requires;
- provide contribution, light/dark theme, viewport, and supported surface-size
  controls;
- display load, missing-export, render-boundary, and bridge errors in the
  preview rather than leaving a blank canvas;
- reset fixture state without restarting the development server;
- clearly label fixture data so it cannot be mistaken for workspace data.

The first implementation preserves the current fixture-preview boundary:
server procedures have no implicit external destination and render their
normal unavailable/error state. Testing real procedures belongs to live
preview. A future local procedure adapter can be designed separately; it must
not delay removal of the hosted localhost preview.

### CLI orchestration

`tappify extension dev` remains the single command. It will:

1. validate the local manifest and refresh generated types from the installed
   SDK contract without refreshing the remote registry;
2. start the extension's Vite server;
3. wait until the preview root and remote entry are reachable;
4. open `http://localhost:<port>/` unless `--no-open` was supplied;
5. print the preview root and remote-entry URL;
6. watch the manifest and regenerate types;
7. restart the managed Vite process when expose topology changes;
8. stop all owned processes cleanly on Ctrl+C.

Expected output:

```text
Serving kitchen-sink on http://localhost:5273/remoteEntry.js.
Preview: http://localhost:5273/
```

The structured result retains `remoteEntry`, `previewUrl`, `hostUrl`, and
`installId`; `previewUrl` becomes the local root URL. This preserves the CLI's
machine-readable shape while correcting its meaning.

`--port` controls the one local Vite server. `--no-open` suppresses browser
launching. `--live` additionally registers the dev session and prints/opens
the sandbox host URL. The existing `--remote` option remains supported: the
CLI still starts the local preview host but tells it to load the explicit HTTPS
remote instead of the local remote entry. It never sends the developer to the
developer portal.

Default local preview performs no login check, registry refresh, extension
registration, or API request. Any registry facts needed for validation and
generated types come from the installed SDK/CLI contract. `--live` is the
point at which authentication and backend access begin.

### Live mode

`--live` continues to register a dev session with the backend. It is not the
implementation of local preview.

The real Tappify host loads the local `remoteEntry.js` from the developer's
browser. Backend-originated calls cannot reach localhost; `--server` continues
to accept a reachable server URL for those calls. This external connectivity
is isolated to explicit live integration testing and is absent from the
default local preview.

## Developer portal removal

The developer portal will remove:

- the Preview item from the extension step navigation;
- `/extensions/[id]/preview` as an interactive page;
- the public `/preview/[id]` iframe route;
- the remote-entry form and contribution selector;
- the portal-specific module-federation preview runtime;
- localhost/remote preview URL helpers and their tests;
- copy directing developers to paste or load a localhost remote in the portal.

Old extension preview URLs will redirect to the extension detail page. That
page will contain one short local-development instruction:

```bash
tappify extension dev
```

It will not embed, proxy, inspect, or connect to the local server.

Removing the portal runtime also removes duplicated shared-dependency and
mock-bridge configuration. The SDK becomes the single owner of fixture preview
behavior.

## Documentation and starter changes

The starter README and extension documentation will describe:

- `tappify extension dev` opening the local root preview;
- the difference between fixture-based local preview and real sandbox preview;
- `--no-open`, `--port`, and the corrected `previewUrl` output;
- `--live` as the only path involving registration and Tappify services;
- tunnels only in the live server-procedure workflow.

The existing "Preview in the portal" documentation page will be replaced by
"Local preview" at `/extensions/test/local-preview`, and its old URL will
redirect there. Generated CLI documentation must be regenerated from the CLI
source rather than edited manually.

## Error behavior

The local root must never fail as a blank page. It must distinguish at least:

- invalid manifest, with validation paths and messages;
- no UI contributions, with a command/example for adding one;
- remote entry unavailable;
- contribution expose missing;
- contribution does not default-export a component;
- render failure caught by the extension boundary;
- manifest topology changed and the Vite server is restarting.

CLI startup fails non-zero if the preview root or remote entry does not become
ready within the startup timeout. A browser must not be opened to a known-dead
server.

## Security boundary

Local preview:

- binds to `127.0.0.1`/localhost by default;
- contains fixture data only;
- stores fixture writes in memory;
- receives no portal cookies, WorkOS session, API token, or workspace data;
- makes no authenticated Tappify API calls;
- does not proxy arbitrary URLs.

An explicitly supplied HTTPS `--remote` is loaded as code by developer choice
and is labeled as non-local in the preview. HTTP remotes other than loopback
remain refused.

## Verification

### SDK

- Vite integration test proves `/` serves the preview and
  `/remoteEntry.js` remains available.
- The preview reads contributions from the local manifest, including a
  contribution that does not exist in any backend release.
- Each supported UI contribution kind renders through the mock bridge.
- Runtime failures produce visible diagnostics.
- Component edits reload and manifest topology changes trigger the required
  restart signal.
- Production build output contains no preview application.

### CLI

- Default `extension dev` starts one local server and reports a local
  `previewUrl`.
- Browser launch waits for readiness and `--no-open` suppresses it.
- JSON output retains its documented keys.
- `--live` still registers and tears down a dev session.
- `--remote` never creates a developer-portal URL.
- Ctrl+C leaves no child process or live dev session behind.

### Developer portal

- Preview is absent from extension navigation.
- Legacy preview routes redirect to extension details.
- No developer-portal bundle contains the preview federation runtime or
  localhost allowlist.

### End-to-end acceptance

From a newly scaffolded extension, with no login and no network connection:

1. run `tappify extension dev`;
2. observe the browser open `http://localhost:5273/`;
3. select and render every local UI contribution;
4. edit a component and observe the update;
5. add a contribution to the manifest and observe the managed restart and new
   selector entry;
6. stop the command and confirm the port and child process are gone.

## Delivery order

1. Add the local preview host and serve-mode contract to the SDK.
2. Release the SDK and update the CLI to orchestrate/open the local root.
3. Update the extension starter to the released SDK version.
4. Remove the developer-portal preview UI and redirect legacy routes.
5. Update and regenerate extension documentation.
6. Exercise the flow with the starter and Kitchen Sink before shipping each
   repository through its normal develop-to-main process.

The portal preview is removed only after the released CLI and SDK provide the
local replacement, so developers are never left without a working preview
path.
