# Local Extension Preview Implementation Plan

<!-- cspell:words agentic lockfiles worktree -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tappify extension dev` open a complete fixture-backed preview at the local Vite root, keep `--live` as the explicit real-host integration path, and remove localhost previewing from the developer portal.

**Architecture:** The SDK's serve-only Vite plugins own the preview document, manifest virtual module, module-federation host, fixtures, and UI. The CLI owns offline type generation, the Vite child lifecycle, readiness, browser opening, and manifest-topology restarts. The portal retains redirects and a command hint only; it no longer loads extension code.

**Tech Stack:** TypeScript, React 19, Vite 8, Module Federation runtime, Vitest/Testing Library, Nest Commander/Jest, Next.js 16 App Router, Mintlify

**Spec:** `docs/superpowers/specs/2026-10-06-local-extension-preview-design.md`

## Global Constraints

- Work directly in the existing checkouts. Do not create a git worktree.
- Default local preview must make zero Tappify API, authentication, registry, portal, tunnel, or workspace-data requests.
- Bind the default server to loopback. Permit an explicit remote only when it is HTTPS or loopback HTTP; never proxy arbitrary URLs.
- Keep the preview runtime out of production extension artifacts. `vite build` must continue to emit only extension federation entries.
- Preserve the CLI JSON keys `id`, `remoteEntry`, `previewUrl`, `hostUrl`, and `installId`; only the meaning of `previewUrl` changes to the local root.
- Do not manually bump semantic-release package versions. Release the SDK before consuming its preview contract in downstream repositories.
- Stage exact files in every repository. In particular, preserve the unrelated existing `documentation/SDK-DOCS-SPEC.md` modification.
- Portal implementation must first read the relevant installed Next.js 16 documentation under `developers/node_modules/next/dist/docs/` as required by `developers/AGENTS.md`.
- Follow the delivery gate: SDK replacement available, then CLI/starter, then portal removal, then docs and acceptance.

## Interfaces and Ownership

| Owner                       | Interface                                                                                              | Contract                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| SDK Vite plugin             | `tappifyExtension(options?: TappifyExtensionOptions): Plugin[]`                                        | Adds the preview plugins in `serve` mode without changing the published call site.                |
| SDK/CLI boundary            | `TAPPIFY_PREVIEW_REMOTE`                                                                               | Optional process environment value set by the CLI for `--remote`; absent means `/remoteEntry.js`. |
| SDK preview virtual modules | `virtual:tappify-preview/client`, `virtual:tappify-preview/manifest`, `virtual:tappify-preview/remote` | Serve-only entry, validated local manifest, and selected remote URL.                              |
| CLI registry                | `RegistryService.get({ refresh?: boolean, localOnly?: boolean })`                                      | `localOnly: true` returns the SDK mirror immediately and never reads the cache or calls the API.  |
| CLI types                   | `TypesService.render/write(root, { localOnly?: boolean })`                                             | Dev calls with `localOnly: true`; other commands retain current cached/network behavior.          |
| CLI dev URLs                | `DevService.previewUrl(port)` and `DevService.remoteEntry(port)`                                       | Return `http://localhost:<port>/` and `http://localhost:<port>/remoteEntry.js`.                   |
| CLI readiness               | `DevService.waitUntilReady(urls, options?)`                                                            | Polls both endpoints until all answer successfully or throws a timeout with the failing URLs.     |
| CLI flag                    | `--no-open`                                                                                            | Suppresses opening either the local preview or the live sandbox host.                             |

## Review Focus

The reviewer should concentrate on these cross-cutting failure modes in addition to the task-local assertions:

1. **Dependency identity:** the preview and the remote must share one React, React DOM, JSX runtime, TanStack Query, and SDK instance. Assigned to the SDK federation integration test in Task 3.
2. **No accidental network:** a cold machine with no registry cache must still reach local preview without calling `ApiService`. Assigned to the CLI runner test in Task 5.
3. **Restart races:** a manifest topology edit must not let the old child's normal exit terminate the replacement server or leave two children listening. Assigned to lifecycle tests in Task 5.
4. **Preview leakage:** neither preview HTML nor the fixture runtime may be reachable from or emitted by `vite build`. Assigned to the SDK build-output test in Task 3.
5. **Migration dead ends:** every old portal/docs preview URL must redirect to a useful destination after the interactive runtime is deleted. Assigned to portal and documentation checks in Tasks 7 and 8.

---

### Task 1: Add the SDK preview model and surface props

**Repo:** `extension-sdk`

**Files:**

- Create: `src/vite/preview/model.ts`
- Create: `test/vite/preview/model.test.ts`
- Modify: `src/testing/fixtures.ts`
- Modify: `src/host/provider.tsx`
- Modify: `test/entry.test.ts`

**Interfaces:**

- `PreviewSelection { contribution: UiContributionRef; label: string }`
- `previewSelections(manifest: ExtensionManifest): PreviewSelection[]`
- `previewProps(contribution, state): TapWidgetProps | TapTabProps | TapPageProps | TapRowActionProps | TapSettingsProps`
- `previewTopology(manifest): string`, a stable sorted signature of `kind`, `id`, `expose`, and `entry`

- [ ] Write failing model tests covering page, tab, widget, row action, and settings ordering, labels, fixture props, settings updates, an empty manifest, and a stable topology signature.
- [ ] Run `pnpm vitest run test/vite/preview/model.test.ts` and confirm the missing module/functions fail.
- [ ] Implement the smallest pure model that derives all selections from `uiContributions`, supplies deterministic props from SDK fixtures, and produces the stable topology signature.
- [ ] Update SDK comments that still say fixtures or `TapHostProvider` belong to the portal preview so they describe the local preview host.
- [ ] Run `pnpm vitest run test/vite/preview/model.test.ts test/entry.test.ts` and confirm both pass.
- [ ] Run `pnpm type-check`.
- [ ] Commit with `git add src/vite/preview/model.ts test/vite/preview/model.test.ts src/testing/fixtures.ts src/host/provider.tsx test/entry.test.ts && git commit -m "feat(preview): model local extension surfaces"`.

### Task 2: Build the SDK-owned local preview runtime

**Repo:** `extension-sdk`

**Files:**

- Create: `src/vite/preview/client.tsx`
- Create: `src/vite/preview/error-boundary.tsx`
- Create: `src/vite/preview/styles.ts`
- Create: `src/vite-preview.ts`
- Create: `test/vite/preview/client.test.tsx`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `tsup.config.ts`

**Interfaces:**

- Internal package entry `@tappify/extension-sdk/vite/preview` exports `mountLocalPreview(options)` for the Vite virtual client only.
- `LocalPreviewOptions { manifest; remote; mount: HTMLElement }`
- `loadContribution({ extensionId, remote, expose }): Promise<ComponentType<Record<string, unknown>>>`
- The UI controls contribution, light/dark theme, desktop/tablet/mobile viewport, supported surface size, and fixture reset.

- [ ] Write failing component tests that mock module-federation loading and assert every supported contribution kind mounts under `TapHostProvider` with the correct props.
- [ ] Add failing tests for contribution switching, theme, viewport, surface size, fixture reset, external-remote labeling, and no-UI-contribution guidance.
- [ ] Add failing tests for remote unavailable, missing expose, missing default component export, render-boundary failure, and procedure-unavailable diagnostics; each must render visible text instead of a blank root.
- [ ] Run `pnpm vitest run test/vite/preview/client.test.tsx` and confirm the missing runtime fails.
- [ ] Add `@module-federation/runtime` as a runtime dependency, add the internal preview entry to package exports/tsup, and implement the minimal preview shell and loader using the SDK's own host/testing primitives.
- [ ] Configure the loader's federation share scope for React, React DOM, JSX runtime, TanStack Query, and `@tappify/extension-sdk`; do not hard-code a duplicate SDK version.
- [ ] Run `pnpm vitest run test/vite/preview/client.test.tsx` and confirm all cases pass.
- [ ] Run `pnpm type-check && pnpm build` and inspect `dist` to confirm the internal browser entry was produced.
- [ ] Commit with `git add package.json pnpm-lock.yaml tsup.config.ts src/vite-preview.ts src/vite/preview/client.tsx src/vite/preview/error-boundary.tsx src/vite/preview/styles.ts test/vite/preview/client.test.tsx && git commit -m "feat(preview): render extensions in a local host"`.

### Task 3: Serve the preview at the Vite root only in development

**Repo:** `extension-sdk`

**Files:**

- Create: `src/vite/preview/plugin.ts`
- Create: `test/vite/preview/server.test.ts`
- Modify: `src/vite/plugin.ts`
- Modify: `src/vite.ts`
- Modify: `test/vite/plugin.test.ts`

**Interfaces:**

- `createPreviewPlugins({ manifestFile, loadManifest, port, remote? }): Plugin[]`
- `PREVIEW_REMOTE_ENV = "TAPPIFY_PREVIEW_REMOTE"`
- The document at `/` imports `virtual:tappify-preview/client`; manifest and remote data are supplied by virtual modules, never serialized from backend state.
- In serve mode the manifest virtual module carries either `{ ok: true, manifest }` or `{ ok: false, issues }`, allowing `/` to explain an invalid edit. Build mode retains the current hard failure.

- [ ] Extend plugin unit tests first: assert loopback host, `/` preview configuration, virtual manifest/client/remote modules, full reload on non-topology manifest edits, and the current `onManifestChange` callback.
- [ ] Add an integration test that starts Vite on an ephemeral loopback port and asserts `/` returns preview HTML while `/remoteEntry.js` returns the federation remote.
- [ ] Add failing security tests that accept HTTPS and loopback HTTP `TAPPIFY_PREVIEW_REMOTE` values but refuse non-loopback HTTP and malformed URLs with a visible startup error.
- [ ] Add a failing integration test proving an invalid manifest still serves `/` with validation paths/messages and no federation exposes, while the same manifest makes a production build fail.
- [ ] Add a failing production-build test that inventories build output and asserts it contains neither preview HTML nor fixture-runtime/client chunks.
- [ ] Run `pnpm vitest run test/vite/plugin.test.ts test/vite/preview/server.test.ts` and confirm the new expectations fail.
- [ ] Implement the serve-only preview plugins and connect them to `tappifyExtension()` without changing its public call site.
- [ ] Ensure valid and invalid manifest edits invalidate the manifest virtual module and send a full page reload; leave valid topology restart ownership to the CLI callback.
- [ ] Run `pnpm vitest run test/vite/plugin.test.ts test/vite/preview/server.test.ts` and confirm they pass.
- [ ] Run `pnpm test && pnpm lint && pnpm format:check && pnpm build`.
- [ ] Commit with `git add src/vite/preview/plugin.ts src/vite/plugin.ts src/vite.ts test/vite/plugin.test.ts test/vite/preview/server.test.ts && git commit -m "feat(vite): serve extension preview at root"`.

### Task 4: Make CLI dev startup offline and readiness-aware

**Repo:** `cli`

**Files:**

- Modify: `src/core/registry/registry.service.ts`
- Modify: `src/core/registry/registry.service.spec.ts`
- Modify: `src/domains/extension/services/types.service.ts`
- Modify: `src/domains/extension/services/types.service.spec.ts`
- Modify: `src/domains/extension/services/dev.service.ts`
- Modify: `src/domains/extension/services/dev.service.spec.ts`

**Interfaces:** Use the registry, types, URL, and readiness interfaces listed above. `waitUntilReady` accepts an injectable fetch function and clock/delay seam in tests so no test sleeps.

- [ ] Add a failing registry test proving `{ localOnly: true }` ignores fresh/stale caches and never calls `ApiService`.
- [ ] Run `pnpm jest src/core/registry/registry.service.spec.ts --runInBand` and confirm it fails.
- [ ] Implement the local-only SDK mirror path and pass it through `TypesService.render/write` options.
- [ ] Add failing type-service tests proving local-only generation requests the mirror and retains the offline-event behavior.
- [ ] Run `pnpm jest src/domains/extension/services/types.service.spec.ts --runInBand` and confirm it fails, then implement and rerun it to green.
- [ ] Replace portal-base/portal-preview URL tests with failing local root URL and readiness tests: delayed success, non-2xx response, timeout, and both root/remote endpoints required.
- [ ] Run `pnpm jest src/domains/extension/services/dev.service.spec.ts --runInBand` and confirm the new tests fail.
- [ ] Implement local URL generation and bounded readiness polling while leaving live-session start/end behavior unchanged.
- [ ] Run the three targeted service suites and `pnpm build`.
- [ ] Commit with `git add src/core/registry/registry.service.ts src/core/registry/registry.service.spec.ts src/domains/extension/services/types.service.ts src/domains/extension/services/types.service.spec.ts src/domains/extension/services/dev.service.ts src/domains/extension/services/dev.service.spec.ts && git commit -m "feat(dev): prepare local preview without network"`.

### Task 5: Orchestrate browser launch and topology-safe restarts in the CLI

**Repo:** `cli`

**Files:**

- Modify: `src/domains/extension/runners/dev.runner.ts`
- Modify: `src/domains/extension/runners/dev.runner.spec.ts`
- Modify: `src/domains/extension/runners/__snapshots__/help.spec.ts.snap`
- Modify: `src/domains/extension/kinds.ui.ts`
- Modify: `src/domains/extension/runners/init.runner.ts`
- Modify: `src/domains/extension/runners/init.runner.spec.ts`

**Behavior:** The runner always starts one local Vite host, including for `--remote`. It passes `TAPPIFY_PREVIEW_REMOTE` in the child environment when supplied, waits for root plus the selected remote entry, opens local root by default, opens `hostUrl` under `--live`, and opens nothing under `--no-open` or `--json`.

- [ ] Rewrite runner tests first for local `previewUrl`, exact human output, offline type generation, readiness-before-open, `--no-open`, JSON keys, `--remote`, and live-host opening.
- [ ] Add failing validation tests proving explicit remote values accept HTTPS/loopback HTTP and reject malformed or non-loopback HTTP before a child starts.
- [ ] Add failing lifecycle tests for non-topology manifest reload, topology-triggered child restart, replacement readiness, old-child exit suppression, restart failure, rapid consecutive edits, Ctrl+C, child failure, watcher closure, and live-session teardown.
- [ ] Add a failing cold-start test whose registry/API mocks throw if called; default `extension dev` must still reach readiness and emit its local URL.
- [ ] Run `pnpm jest src/domains/extension/runners/dev.runner.spec.ts --runInBand` and confirm the new contract fails.
- [ ] Add `--no-open`, call `types.write(root, { localOnly: true })`, start Vite with the preview-remote environment contract, and wait for readiness before output/browser launch.
- [ ] Track the current manifest topology and serialize restarts: kill and await the old managed child, start exactly one replacement, wait for it, then let the SDK page reload expose the new selector.
- [ ] Treat an invalid/half-written watched manifest as a visible diagnostic without killing the last good server; restart only after a later valid topology is available.
- [ ] Keep signal handlers installed across managed restarts and make only an unexpected current-child exit resolve the command; cleanup must be idempotent.
- [ ] Update generic CLI copy from “the preview” to “local preview” where the command creates or adds UI.
- [ ] Run `pnpm jest src/domains/extension/runners/dev.runner.spec.ts src/domains/extension/runners/init.runner.spec.ts src/domains/extension/runners/help.spec.ts --runInBand`.
- [ ] Run `pnpm test && pnpm lint && pnpm format:check && pnpm build`.
- [ ] Commit with `git add src/domains/extension/runners/dev.runner.ts src/domains/extension/runners/dev.runner.spec.ts src/domains/extension/runners/__snapshots__/help.spec.ts.snap src/domains/extension/kinds.ui.ts src/domains/extension/runners/init.runner.ts src/domains/extension/runners/init.runner.spec.ts && git commit -m "feat(dev): open and manage the local preview"`.

### Task 6: Release the SDK contract and update starter/scaffold consumers

**Repos:** `extension-sdk`, then `extension-starter`, `cli`, and `extensions-lab`

**Files:**

- Modify: `extension-starter/package.json`
- Modify: `extension-starter/pnpm-lock.yaml`
- Modify: `extension-starter/README.md`
- Modify: `cli/package.json`
- Modify: `cli/pnpm-lock.yaml`
- Regenerate: `cli/templates/starter/**`
- Modify: `extensions-lab/kitchen-sink/package.json`
- Modify: `extensions-lab/kitchen-sink/pnpm-lock.yaml`
- Modify: `extensions-lab/kitchen-sink/README.md`

- [ ] Push the SDK feature commits through its normal `develop` to `main` release flow and record the semantic-release version; do not proceed with consumer lockfiles until the package is installable.
- [ ] Update the CLI, starter, and Kitchen Sink SDK ranges/lockfiles to that released version.
- [ ] Update starter and Kitchen Sink README copy so `/` is the local fixture preview and `--live` is the real sandbox host; remove every portal-preview reference.
- [ ] Run starter `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] Commit the starter with `git add package.json pnpm-lock.yaml README.md && git commit -m "docs: use the local extension preview"`.
- [ ] From `cli`, run `pnpm sync:starter`, review the generated diff, and verify no identity placeholders or excluded files regressed.
- [ ] Run CLI template/init tests plus `pnpm build`, then commit exact dependency/template files with `git commit -m "chore(starter): sync local preview scaffold"`.
- [ ] Run Kitchen Sink `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, and `pnpm build`.
- [ ] Commit Kitchen Sink dependency/docs files in `extensions-lab` with `git commit -m "test(lab): adopt local extension preview"`.

### Task 7: Remove interactive previewing from the developer portal

**Repo:** `developers`

**Files:**

- Modify: `src/components/extensions/step-nav.tsx`
- Create: `src/components/extensions/step-nav.test.tsx`
- Modify: `src/app/(portal)/extensions/[id]/page.tsx`
- Create: `src/app/(portal)/extensions/[id]/page.test.tsx`
- Replace: `src/app/(portal)/extensions/[id]/preview/page.tsx`
- Create: `src/app/(portal)/extensions/[id]/preview/page.test.tsx`
- Replace: `src/app/preview/[id]/page.tsx`
- Create: `src/app/preview/[id]/page.test.tsx`
- Delete: `src/app/(portal)/extensions/[id]/preview/preview-controls.tsx`
- Delete: `src/app/preview/[id]/frame.tsx`
- Delete: `src/app/preview/[id]/frame.server.test.tsx`
- Delete: `src/app/preview/layout.tsx`
- Delete: `src/lib/preview-remote.ts`
- Delete: `src/lib/preview-remote.test.ts`
- Modify: `next.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] Read `node_modules/next/dist/docs/01-app/02-guides/redirecting.md`, `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`, and the App Router page convention before editing.
- [ ] Add failing tests proving Preview is absent from step navigation and the extension overview shows one `tappify extension dev` local-development instruction.
- [ ] Add failing route tests proving both legacy URLs redirect to `/extensions/<id>` while preserving no remote/query data.
- [ ] Run the targeted Vitest files and confirm the tests fail against the current interactive pages.
- [ ] Remove the navigation item, add the overview command card, replace both legacy pages with server-side redirects, and delete the controls/frame/helper runtime.
- [ ] Remove dependencies used only by the portal preview (`@module-federation/runtime`, TanStack Query, and extension SDK only if repository-wide search confirms no other imports); regenerate the lockfile.
- [ ] Remove the preview-only font CORS header only if repository-wide search confirms no other cross-origin consumer.
- [ ] Run `rg -n "preview-remote|PreviewFrame|PreviewControls|module-federation|localhost.*remoteEntry|portal preview" src package.json next.config.ts` and resolve every preview-runtime hit while preserving unrelated listing/auth visual previews.
- [ ] Run targeted tests, `pnpm test`, `pnpm lint`, `pnpm typecheck`, and `pnpm build`.
- [ ] Commit with exact paths and `git commit -m "feat(extensions): move previewing out of the portal"`.

### Task 8: Replace portal-preview documentation with local-preview documentation

**Repo:** `documentation`

**Files:**

- Create: `extensions/test/local-preview.mdx`
- Delete: `extensions/test/preview-in-the-portal.mdx`
- Modify: `extensions/test/dev-server.mdx`
- Modify: `extensions/test/live-preview.mdx`
- Modify: `extensions/test/testing-with-the-sdk.mdx`
- Modify: `extensions/start/your-first-extension.mdx`
- Modify: `extensions/start/create-a-vendor-account.mdx`
- Modify: `extensions/build/add-a-settings-panel.mdx`
- Modify: `extensions/reference/testing-api.mdx`
- Modify: `extensions/reference/testing-api/Variable.fixtures.mdx`
- Modify: `docs.json`
- Regenerate: `extensions/reference/cli.mdx`

- [ ] Write the new local-preview page first with the root URL, fixture boundary, contribution/theme/viewport/size controls, errors, `--no-open`, `--port`, `--remote`, and when to use `--live`.
- [ ] Change Test navigation from `preview-in-the-portal` to `local-preview` and configure the supported Mintlify redirect from the old path to the new one.
- [ ] Replace all portal-preview language and links in the listed authored pages; keep tunnels confined to the live server-procedure workflow.
- [ ] From `cli`, run `pnpm build:cli-reference`; copy/use the generated CLI reference through the repository's established generation workflow instead of hand-editing it.
- [ ] Run `rg -n "portal preview|preview-in-the-portal|developers\.tappify\.ai/.*/preview" extensions docs.json` and resolve all stale references.
- [ ] Run `node scripts/check-docs.mjs` and the Mintlify validation/build command available in this repository.
- [ ] Review `git diff -- SDK-DOCS-SPEC.md` and verify the pre-existing user edit is untouched and unstaged.
- [ ] Commit only the files listed above with `git commit -m "docs(extensions): document local preview"`.

### Task 9: Run offline and Kitchen Sink acceptance before shipping

**Repos:** `extension-starter`, `cli`, `extensions-lab`, `extension-sdk`, `developers`, `documentation`

**Files:** No intended source changes; any discovered fix returns to its owning task and receives its own test/commit.

- [ ] Scaffold a fresh temporary extension through the built CLI, remove/redirect Tappify credentials and registry cache for the test process, and run `tappify extension dev --no-open`; assert root and remote entry answer without an API call.
- [ ] Open the starter root and manually verify its widget and settings panel, fixture label, controls, reset behavior, visible procedure-unavailable state, component HMR, and clean Ctrl+C port release.
- [ ] Add a temporary UI contribution to the scaffold manifest, verify one managed restart and a new selector entry, then revert only that temporary fixture edit.
- [ ] Run Kitchen Sink locally and verify page, tab, widget, every row-action flavor, and settings render from its local manifest; capture any unsupported-prop mismatch as a failing SDK test before fixing it.
- [ ] Run `--remote` against an HTTPS Kitchen Sink remote and verify the browser remains on localhost and labels the remote as external.
- [ ] Run `--live --no-open`, verify registration/host URL output and teardown, then run `--live` and verify it opens the sandbox host rather than the portal.
- [ ] Run every repository's full test, typecheck, lint/format-check, and build command; record command outputs and exact commits in the handoff.
- [ ] Request code review with special attention to the five Review Focus items and address findings test-first.
- [ ] Ship in dependency order through each repository's normal `develop` to `main` flow: SDK, CLI, starter/template, portal, documentation, then the staging Kitchen Sink validation.
