# One UI Extension SDK Components Implementation Plan

<!-- cspell:ignore agentic uppercasing vulakh worktree -->

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every legacy `Tap*` frontend component with a portable One UI component API at `@tappify/extension-sdk/ui`, migrate all in-repository consumers, and remove the legacy implementation completely.

**Architecture:** The SDK owns small React primitives backed by one shadow-root-safe One UI stylesheet and stable `data-slot` attributes. The package root retains non-UI SDK contracts, while UI code and CSS move behind dedicated `/ui` exports; the web host, starter, lab extensions, fixtures, authored guides, and generated reference pages all migrate in the same change.

**Tech Stack:** React 19, TypeScript, semantic HTML, CSS custom properties and container queries, Zod JSON Schema validation, Vitest, Testing Library, tsup, TypeDoc, pnpm.

**Spec:** `docs/superpowers/specs/2026-10-14-one-ui-sdk-components-design.md`

## Global Constraints

- Work directly in the existing checkouts; do not create a Git worktree.
- LocalFigma nodes `19607:821`, `19610:8654`, `19191:1004`, `18802:7270`, `19162:13200`, and `18785:7062` are the visual source of truth.
- Export UI only from `@tappify/extension-sdk/ui` and CSS only from `@tappify/extension-sdk/ui/styles.css`.
- Do not leave aliases, wrappers, source files, selectors, tests, examples, or generated pages for the removed `Tap*` UI API.
- Keep all non-UI SDK behavior and public contracts unchanged.
- Use React and semantic HTML with portable scoped CSS; do not require Tailwind or private web aliases in extension bundles.
- Preserve loading, empty, error, disabled, invalid, partial, narrow-layout, keyboard, focus, screen-reader, and reduced-motion behavior.
- Preserve unrelated user changes in every checkout, especially the currently dirty `web` repository.
- Follow red-green-refactor: add one failing behavior test, confirm its expected failure, implement the smallest production change, and rerun the focused test before proceeding.

## Review Focus

- A component rendered without host variables must use the documented One UI fallback tokens; pin this in Task 1's stylesheet contract test.
- A consumer class name must compose with, not replace, a primitive's required class and `data-slot`; pin this in Tasks 2, 3, and 5.
- A schema Zod cannot compile must still render and enforce required fields; pin this in Task 4.
- A dialog opened in a shadow root must trap focus there, restore its opener, and fail clearly when no portal exists; pin this in Task 5.
- A mount at or below 360 pixels must stack actions without creating horizontal overflow; pin the container-query contract in Task 1 and exercise the structure in Tasks 2 and 4.

---

### Task 1: Establish the `/ui` package boundary and One UI foundations

**Files:**

- Create: `src/ui.ts`
- Replace: `src/client/ui/index.ts`
- Create: `src/client/ui/layout.tsx`
- Replace: `src/client/ui/styles.css`
- Modify: `src/index.ts`
- Modify: `package.json`
- Modify: `tsup.config.ts`
- Modify: `scripts/copy-styles.mjs`
- Modify: `test/entry.test.ts`
- Create: `test/client/ui/layout.test.tsx`
- Create: `test/client/ui/styles.test.ts`
- Modify: `test/vite/plugin.test.ts`
- Modify: `test/vite/preview/server.test.ts`

**Interfaces:**

- Produces: `Stack(props: StackProps): ReactElement`, `Inline(props: InlineProps): ReactElement`, and `cn(...values: ClassValue[]): string` from `@tappify/extension-sdk/ui`.
- `StackProps` and `InlineProps` extend `HTMLAttributes<HTMLDivElement>` and accept `gap?: 4 | 8 | 12 | 16 | 24 | 32 | 40`; `InlineProps` additionally accepts `align?: 'start' | 'center' | 'end' | 'stretch'` and `justify?: 'start' | 'center' | 'end' | 'between'`.
- Produces: `@tappify/extension-sdk/ui/styles.css` copied to `dist/ui/styles.css`.
- Removes: the `./styles.css` package export; the package root stops re-exporting `./client/ui`.

- [ ] **Step 1: Write failing package-boundary and layout tests**

  In `test/entry.test.ts`, import `../src/ui`, assert that it initially exposes `Stack`, `Inline`, and `cn`, and assert that the root client entry exposes none of those UI symbols or legacy `TapButton`/`TapForm` symbols. In `test/client/ui/layout.test.tsx`, assert `data-slot="stack"`/`"inline"`, tokenized `data-gap`, alignment data attributes, and custom-class composition. In `test/client/ui/styles.test.ts`, read the source stylesheet and assert the fallback values for paper, canvas, light gray, main/sub text, divider, lime, deep green, spacing, radii, control height, the `@container tap-mount (max-width: 360px)` rule, and `prefers-reduced-motion`.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `pnpm vitest run test/entry.test.ts test/client/ui/layout.test.tsx test/client/ui/styles.test.ts`

  Expected: FAIL because `src/ui.ts`, the layout primitives, the new exports, and One UI stylesheet contract do not exist.

- [ ] **Step 3: Implement the package boundary, layout primitives, and foundation stylesheet**

  Add `ui` to the tsup entry map and package exports, add `./ui/styles.css`, remove `./styles.css`, update the copy script to create `dist/ui/` and copy the stylesheet there, and keep UI out of `src/index.ts`. Scope styles under `.tap-root`; expose stable `data-slot` selectors; define the spec's One UI fallback custom properties; retain box sizing, base typography, container setup, narrow action stacking, and reduced-motion handling.

- [ ] **Step 4: Update stylesheet collection fixtures and verify GREEN**

  Change SDK fixture strings and Vite expectations from `@tappify/extension-sdk/styles.css` to `@tappify/extension-sdk/ui/styles.css`, then run the focused command from Step 2 plus `pnpm vitest run test/vite/plugin.test.ts test/vite/preview/server.test.ts`.

  Expected: PASS; the built package has a UI entry and the preview collector recognizes the new stylesheet path.

- [ ] **Step 5: Commit Task 1**

  ```bash
  git add package.json tsup.config.ts scripts/copy-styles.mjs src/ui.ts src/client/ui test/entry.test.ts test/client/ui test/vite/plugin.test.ts test/vite/preview/server.test.ts
  git commit -m "feat(ui): establish One UI package boundary"
  ```

### Task 2: Add actions, cards, and page structure

**Files:**

- Create: `src/client/ui/button.tsx`
- Create: `src/client/ui/card.tsx`
- Create: `src/client/ui/page-header.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/client/ui/styles.css`
- Create: `test/client/ui/button.test.tsx`
- Create: `test/client/ui/card.test.tsx`
- Create: `test/client/ui/page-header.test.tsx`

**Interfaces:**

- Produces: `Button(props: ButtonProps): ReactElement` with `variant?: 'primary' | 'secondary' | 'tertiary' | 'inverse' | 'destructive'`, `size?: 'default' | 'compact' | 'xs' | 'sm' | 'lg' | 'icon' | 'icon-xs' | 'icon-sm' | 'icon-lg'`, and `loading?: boolean` plus native button props.
- Produces: `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, and `CardFooter`, each accepting its native `div` props; `Card` additionally accepts `size?: 'default' | 'sm'`.
- Produces: `PageHeader({ title, description?, actions?, ...divProps }: PageHeaderProps): ReactElement` with an `h2` because the host owns the page `h1`.

- [ ] **Step 1: Write failing action and surface tests**

  Assert every Button variant/size data attribute, default `type="button"`, custom-class composition, disabled/loading click suppression, and `aria-busy`. Assert the card compound slots and the Home-extension defaults (paper, 14 pixel radius, 24 pixel spacing through stylesheet selectors). Assert `PageHeader` renders an `h2`, optional description/actions, and a structure that the narrow container rule can stack.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `pnpm vitest run test/client/ui/button.test.tsx test/client/ui/card.test.tsx test/client/ui/page-header.test.tsx`

  Expected: FAIL because the new action and surface exports do not exist.

- [ ] **Step 3: Implement actions and surfaces**

  Use semantic button/div/header markup, `data-slot`, `data-variant`, and `data-size`. Match Figma button rest/hover/pressed/disabled values and the connected extension card's paper surface, 14 pixel radius, 24 pixel padding, and 16 pixel gap. Keep presentational logic in `styles.css`.

- [ ] **Step 4: Verify GREEN and the public declarations**

  Run the Step 2 command, then `pnpm type-check`.

  Expected: PASS with typed native attribute forwarding and no root UI export.

- [ ] **Step 5: Commit Task 2**

  ```bash
  git add src/client/ui test/client/ui
  git commit -m "feat(ui): add One UI actions and surfaces"
  ```

### Task 3: Add accessible field primitives

**Files:**

- Create: `src/client/ui/field.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/client/ui/styles.css`
- Create: `test/client/ui/field.test.tsx`

**Interfaces:**

- Produces: `Field`, `FieldLabel`, `FieldDescription`, and `FieldError` using a private field context that owns stable control, description, and error IDs.
- Produces: ref-forwarding `Input`, `Textarea`, `Checkbox`, and `Select` components with their native element props; `CheckboxProps` adds `indeterminate?: boolean`.
- Field controls merge caller IDs and ARIA attributes with context-provided `aria-describedby`/`aria-invalid` rather than overwriting caller values.

- [ ] **Step 1: Write the failing field test suite**

  Assert label association, combined description/error accessible descriptions, invalid state, forwarded refs, custom classes, native input/select/textarea events, checkbox checked and indeterminate states, disabled state, and standalone controls outside `Field`.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm vitest run test/client/ui/field.test.tsx`

  Expected: FAIL because the field compound API and controls do not exist.

- [ ] **Step 3: Implement field context and native controls**

  Match the current One UI input treatment: 49 pixel input height, paper surface, divider border, 8 pixel control radius, Inter typography, deep-green focus border, light-gray disabled surface, and destructive invalid state. Implement the checkbox mark with the stylesheet, including indeterminate and disabled marks.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm vitest run test/client/ui/field.test.tsx && pnpm type-check`

  Expected: PASS with no accessibility warnings.

- [ ] **Step 5: Commit Task 3**

  ```bash
  git add src/client/ui test/client/ui/field.test.tsx
  git commit -m "feat(ui): add One UI field primitives"
  ```

### Task 4: Replace schema-driven forms

**Files:**

- Create: `src/client/ui/schema-form.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/client/ui/styles.css`
- Create: `test/client/ui/schema-form.test.tsx`

**Interfaces:**

- Produces: `schemaFields(schema: JsonSchema): SchemaField[]` where `SchemaFieldKind = 'text' | 'textarea' | 'date' | 'number' | 'boolean' | 'enum'` and fields retain `name`, `label`, `kind`, `required`, optional `description`, and optional enum `options`.
- Produces: `SchemaForm<T>({ schema, value?, submitLabel?, cancelLabel?, busy?, onSubmit, onCancel? }: SchemaFormProps<T>): ReactElement`.
- Consumes: Task 2 `Button`; Task 3 field and control primitives; existing Zod JSON Schema conversion.

- [ ] **Step 1: Write failing schema mapping and form behavior tests**

  Port the existing field-kind, required, validation, coercion, busy, and cancel assertions to `SchemaForm`/`schemaFields`. Add the Review Focus case with a schema Zod cannot compile and assert the form still renders and rejects an empty required field. Assert actions use `Inline` and stack under the narrow container contract.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm vitest run test/client/ui/schema-form.test.tsx`

  Expected: FAIL because the replacement form API does not exist.

- [ ] **Step 3: Implement `schemaFields` and `SchemaForm`**

  Preserve current field order, title humanization, blank-value cleaning, whole-schema validation, number conversion, boolean values, one initial read of `value`, and async-compatible `onSubmit`. Render enum options as native `option` children and boolean fields as a checkbox row with description/error indentation.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm vitest run test/client/ui/schema-form.test.tsx && pnpm type-check`

  Expected: PASS with submission payloads identical to the legacy behavior.

- [ ] **Step 5: Commit Task 4**

  ```bash
  git add src/client/ui test/client/ui/schema-form.test.tsx
  git commit -m "feat(ui): add One UI schema forms"
  ```

### Task 5: Replace the host-aware dialog

**Files:**

- Create: `src/client/ui/dialog.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/client/ui/styles.css`
- Create: `test/client/ui/dialog.test.tsx`

**Interfaces:**

- Produces: `Dialog({ open, onOpenChange, children }: DialogProps): ReactElement | null`.
- Produces: `DialogContent` with `size?: 'compact' | 'default' | 'medium' | 'confirmation' | 'large' | 'wide'`, `surface?: 'paper' | 'canvas'`, and native div props; plus `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogBody`, `DialogFooter`, and `DialogClose`.
- Consumes: the existing host portal exposed by `useTap()` and the existing `tap:dialog-close` event.

- [ ] **Step 1: Write failing dialog behavior tests**

  Port portal placement, closed rendering, missing-portal `TAP_NO_PORTAL`, accessible naming, Escape, scrim dismissal, host close event, Tab/Shift+Tab trapping, and shadow-root focus restoration tests. Assert compound `data-slot` values, custom-class composition, size/surface attributes, and close-button activation.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `pnpm vitest run test/client/ui/dialog.test.tsx`

  Expected: FAIL because the controlled compound dialog API does not exist.

- [ ] **Step 3: Implement the dialog context and compound parts**

  Keep portal lookup and focus behavior from the functional source while changing the API to `open`/`onOpenChange`. Match the current One UI overlay, 18 pixel panel radius, size map, paper/canvas surfaces, responsive maximum height, header/body/footer spacing, and reduced-motion transitions. Keep the close action semantic and screen-reader named.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm vitest run test/client/ui/dialog.test.tsx && pnpm type-check`

  Expected: PASS both in document and shadow-root test setups.

- [ ] **Step 5: Commit Task 5**

  ```bash
  git add src/client/ui test/client/ui/dialog.test.tsx
  git commit -m "feat(ui): add host-aware One UI dialogs"
  ```

### Task 6: Add tables, metrics, and feedback states

**Files:**

- Create: `src/client/ui/table.tsx`
- Create: `src/client/ui/feedback.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/client/ui/styles.css`
- Create: `test/client/ui/table.test.tsx`
- Create: `test/client/ui/feedback.test.tsx`

**Interfaces:**

- Produces native-prop `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`; `TableRow` accepts `variant?: 'header' | 'body'`.
- Produces `Metric({ label, value, delta?, description? }: MetricProps)` where `delta` remains a ratio and renders as a signed whole percentage.
- Produces `Skeleton({ lines?, width?, className? }: SkeletonProps)`, `EmptyState({ title, description?, action? })`, and `ErrorState({ title, description?, code?, onRetry? })`.
- Consumes: Task 2 `Button` for retry and Task 1 layout primitives.

- [ ] **Step 1: Write failing table and feedback tests**

  Assert semantic table roles, compound slots, header/body row variants, native event/class forwarding, and horizontal overflow containment. Assert metric labels/values/signed deltas/descriptions, skeleton line count and explicit width, empty actions, error `role="alert"`, optional code, retry behavior, and reduced-motion selector coverage.

- [ ] **Step 2: Run focused tests and verify RED**

  Run: `pnpm vitest run test/client/ui/table.test.tsx test/client/ui/feedback.test.tsx`

  Expected: FAIL because the table and feedback exports do not exist.

- [ ] **Step 3: Implement table and feedback primitives**

  Match One UI's 36 pixel header rows, 52 pixel body rows, divider rules, 13 pixel secondary headings, and 14 pixel cells. Match the Home extension's metric hierarchy without uppercasing labels. Keep skeleton width as the only data-driven inline presentation and stop animation under reduced motion.

- [ ] **Step 4: Verify GREEN**

  Run: `pnpm vitest run test/client/ui/table.test.tsx test/client/ui/feedback.test.tsx && pnpm type-check`

  Expected: PASS.

- [ ] **Step 5: Commit Task 6**

  ```bash
  git add src/client/ui test/client/ui/table.test.tsx test/client/ui/feedback.test.tsx
  git commit -m "feat(ui): add One UI data and feedback primitives"
  ```

### Task 7: Remove the legacy SDK UI and finalize public contracts

**Files:**

- Delete: `src/client/ui/primitives.tsx`
- Delete: `src/client/ui/TapDialog.tsx`
- Delete: `src/client/ui/TapForm.tsx`
- Delete: `test/client/ui/primitives.test.tsx`
- Delete: `test/client/ui/TapDialog.test.tsx`
- Delete: `test/client/ui/TapForm.test.tsx`
- Modify: `src/client/ui/index.ts`
- Modify: `src/testing/environment.ts`
- Modify: `src/testing/render.tsx`
- Modify: `test/testing/mock.test.tsx`
- Modify: `test/entry.test.ts`
- Modify: `test/fixtures/extension/src/widgets/summary.tsx`
- Modify: `README.md`

**Interfaces:**

- Final `/ui` runtime exports: `Button`, card parts, `PageHeader`, `Stack`, `Inline`, field parts and controls, dialog parts, table parts, `Metric`, `Skeleton`, `EmptyState`, `ErrorState`, `SchemaForm`, `schemaFields`, and `cn`.
- Final package-root runtime exports: the existing non-UI symbols only.
- `installHostTheme(root)` installs the One UI host token set and no legacy UI tokens.

- [ ] **Step 1: Strengthen the public-entry and test-theme tests**

  Make `test/entry.test.ts` assert the exact sorted `/ui` runtime surface and exact non-UI root surface. Update the testing-environment assertion to require One UI variables and reject `--tap-accent`, `--tap-radius`, `--fg-default`, `--fg-muted`, `--bg-raised`, and `--bg-subtle`.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run: `pnpm vitest run test/entry.test.ts test/testing/mock.test.tsx`

  Expected: FAIL because legacy files, root exports, and host-theme variables remain.

- [ ] **Step 3: Delete legacy implementation and migrate SDK-owned fixtures/docs**

  Remove the three legacy modules and tests physically. Update `installHostTheme`, its TSDoc count/copy, SDK fixture imports/markup, and README import examples. Add a migration section that lists every removed `Tap*` symbol, the `/ui` import path, the `/ui/styles.css` path, and representative before/after imports. Do not leave re-export aliases. Update any `TapDialog` portal comments to refer generically to SDK dialogs.

- [ ] **Step 4: Prove the SDK is clean and green**

  Run:

  ```bash
  pnpm test
  pnpm type-check
  pnpm format:check
  pnpm lint
  pnpm build
  rg -n "\b(TapButton|TapCard|TapPageHeader|TapSkeleton|TapEmptyState|TapErrorState|TapStat|TapInput|TapSelect|TapTable|TapDialog|TapForm|formFields)\b|\.tap-(btn|card|page-header|skeleton|state|stat|field|control|table|dialog|form)\b|@tappify/extension-sdk/styles\.css" src test README.md package.json
  ```

  Expected: all commands PASS and `rg` returns no matches.

- [ ] **Step 5: Commit Task 7**

  ```bash
  git add -A src test README.md package.json scripts tsup.config.ts
  git commit -m "feat(ui)!: replace Tap components with One UI" -m "BREAKING CHANGE: frontend components now import from @tappify/extension-sdk/ui and styles from @tappify/extension-sdk/ui/styles.css; legacy Tap* UI exports were removed."
  ```

### Task 8: Migrate the web host to the new UI entry

**Files:**

- Modify: `../web/src/extensions/chat/PromptChips.test.tsx`
- Modify: `../web/src/extensions/chat/PromptChips.tsx`
- Modify: `../web/src/extensions/mount/ExtensionMount.test.tsx`
- Modify: `../web/src/extensions/mount/ExtensionMount.tsx`

**Interfaces:**

- Consumes: `SchemaForm` from `@tappify/extension-sdk/ui` and stylesheet text from `@tappify/extension-sdk/ui/styles.css?inline`.
- Preserves: prompt submission payloads, extension shadow-root mounting, portal creation, and stylesheet adoption.

- [ ] **Step 1: Update web tests to require the new integration contract**

  Add assertions that prompt-chip schema submission still yields the same payload and that the extension mount adopts the `/ui/styles.css` text. Keep all existing host behavior assertions.

- [ ] **Step 2: Run focused web tests against the local SDK and verify RED**

  Build the SDK, link it without changing `web/package.json`, then run from `../web`:

  ```bash
  pnpm --dir ../web link /Users/vulakh/Desktop/Work/Tappify/extension-sdk
  pnpm --dir ../web vitest run src/extensions/chat/PromptChips.test.tsx src/extensions/mount/ExtensionMount.test.tsx
  ```

  Expected: FAIL while production imports still use `TapForm` and the old stylesheet path.

- [ ] **Step 3: Migrate only the two host consumers**

  Replace `TapForm` with `SchemaForm`, move the component import to `/ui`, and change both inline stylesheet imports to `/ui/styles.css?inline`. Preserve unrelated working-tree edits and do not reformat unrelated files.

- [ ] **Step 4: Verify focused behavior and types**

  Run from `../web`:

  ```bash
  pnpm vitest run src/extensions/chat/PromptChips.test.tsx src/extensions/mount/ExtensionMount.test.tsx
  pnpm type-check
  ```

  Expected: PASS, or report unrelated pre-existing type failures by exact file without modifying them.

- [ ] **Step 5: Commit only scoped web files**

  ```bash
  git -C ../web add src/extensions/chat/PromptChips.tsx src/extensions/chat/PromptChips.test.tsx src/extensions/mount/ExtensionMount.tsx src/extensions/mount/ExtensionMount.test.tsx
  git -C ../web commit -m "refactor(extensions): adopt SDK One UI entry"
  ```

### Task 9: Migrate the extension starter

**Files:**

- Modify: `../extension-starter/src/settings.tsx`
- Modify: `../extension-starter/src/widgets/summary.tsx`
- Modify: `../extension-starter/src/styles.css`
- Modify: `../extension-starter/test/settings.test.tsx`
- Modify: `../extension-starter/test/summary.test.tsx`

**Interfaces:**

- Consumes: `PageHeader`, `SchemaForm`, `Card` parts, `Button`, `Metric`, `Skeleton`, and `ErrorState` from `/ui`, plus `/ui/styles.css`.
- Preserves: settings values/validation, summary data, compact preference, telemetry, host event refresh, and error behavior.

- [ ] **Step 1: Update starter tests for One UI structure**

  Retain all behavioral assertions and add checks for card/metric/page-header `data-slot` structure so a partial import rename cannot pass.

- [ ] **Step 2: Run starter tests against the built local SDK and verify RED**

  Build the SDK, link it without changing the starter manifest, then run its tests:

  ```bash
  pnpm build
  pnpm --dir ../extension-starter link /Users/vulakh/Desktop/Work/Tappify/extension-sdk
  pnpm --dir ../extension-starter test
  ```

  Expected: FAIL until starter source imports and compound card markup migrate.

- [ ] **Step 3: Migrate starter source and remove redundant legacy styling**

  Use compound cards and explicit layout primitives; update the stylesheet import path; keep starter-specific chart/layout CSS only when One UI does not own it.

- [ ] **Step 4: Verify the starter**

  Run:

  ```bash
  pnpm --dir ../extension-starter test
  pnpm --dir ../extension-starter typecheck
  pnpm --dir ../extension-starter build
  ```

  Expected: PASS.

- [ ] **Step 5: Commit the starter migration**

  ```bash
  git -C ../extension-starter add src test
  git -C ../extension-starter commit -m "refactor(ui): adopt extension SDK One UI"
  ```

### Task 10: Migrate every affected Extensions Lab package

**Files:**

- Modify: `../extensions-lab/broken-on-purpose/src/settings.tsx`
- Modify: `../extensions-lab/broken-on-purpose/src/widgets/summary.tsx`
- Modify: `../extensions-lab/broken-on-purpose/test/fixtures/never-resolves.tsx`
- Modify: `../extensions-lab/broken-on-purpose/variants/never-resolves/widget.tsx.txt`
- Modify: `../extensions-lab/broken-on-purpose/variants/no-default-export/widget.tsx.txt`
- Modify: `../extensions-lab/kitchen-sink/src/pages/lab-console.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/row-actions/build-action.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/row-actions/inspect-row.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/row-actions/keyword-action.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/row-actions/release-action.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/row-actions/review-action.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/settings.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/tabs/lab-status.tsx`
- Modify: `../extensions-lab/kitchen-sink/src/widgets/summary.tsx`
- Modify: `../extensions-lab/kpi-pulse/src/settings.tsx`
- Modify: `../extensions-lab/kpi-pulse/src/widgets/metric-card.tsx`
- Modify: `../extensions-lab/kpi-pulse/src/widgets/overview-kpis.tsx`
- Modify: `../extensions-lab/release-notes/src/pages/notes.tsx`
- Modify: `../extensions-lab/release-notes/src/release-note-panel.tsx`
- Modify: `../extensions-lab/release-notes/src/tabs/analytics-notes.tsx`
- Modify: `../extensions-lab/release-notes/src/tabs/deployment-notes.tsx`
- Modify: `../extensions-lab/release-notes/src/tabs/overview-notes.tsx`
- Modify: `../extensions-lab/work-bridge/src/row-actions/open-ticket.tsx`
- Modify: affected tests under the same five packages when their structural assertions name legacy components.

**Interfaces:**

- Consumes: the complete `/ui` API built in Tasks 1–7.
- Preserves: each lab contribution's data hooks, storage, events, actions, fixtures, deliberate failure mode, and visible copy.

- [ ] **Step 1: Add or update structural assertions package by package**

  For `broken-on-purpose`, `kitchen-sink`, `kpi-pulse`, `release-notes`, and `work-bridge`, retain existing behavior tests and require the appropriate new `data-slot` structures in at least one representative test per used primitive family.

- [ ] **Step 2: Link the local SDK and verify RED in affected packages**

  For each affected package, run `pnpm --dir ../extensions-lab/<package> link /Users/vulakh/Desktop/Work/Tappify/extension-sdk`, then its focused tests or `pnpm test`.

  Expected: FAIL on removed root UI exports or old compound markup.

- [ ] **Step 3: Migrate source, fixtures, and text fixtures**

  Change component imports to `/ui`, stylesheet imports to `/ui/styles.css`, convert monolithic cards/tables/fields to the approved compound API, and preserve broken-on-purpose failures unrelated to styling.

- [ ] **Step 4: Verify every affected package**

  For each of the five package directories, run `pnpm test`, `pnpm typecheck`, and `pnpm build`.

  Expected: PASS in all five packages.

- [ ] **Step 5: Prove the entire lab has no legacy UI references and commit**

  Run:

  ```bash
  rg -n "\b(TapButton|TapCard|TapPageHeader|TapSkeleton|TapEmptyState|TapErrorState|TapStat|TapInput|TapSelect|TapTable|TapDialog|TapForm|formFields)\b|@tappify/extension-sdk/styles\.css" ../extensions-lab --glob '!**/node_modules/**' --glob '!**/dist/**'
  ```

  Expected: no matches. Then commit all and only the affected lab files with `git -C ../extensions-lab commit -m "refactor(ui): migrate lab extensions to One UI"`.

### Task 11: Regenerate and rewrite extension documentation

**Files:**

- Modify: `scripts/build-api-reference.ts`
- Modify: `typedoc.frontend.json`
- Create: `test/docs/api-reference.test.ts`
- Modify: `../documentation/extensions/build/add-a-page.mdx`
- Modify: `../documentation/extensions/build/add-a-row-action.mdx`
- Modify: `../documentation/extensions/build/add-a-settings-panel.mdx`
- Modify: `../documentation/extensions/build/add-a-tab.mdx`
- Modify: `../documentation/extensions/build/add-a-widget.mdx`
- Modify: `../documentation/extensions/build/add-actions.mdx`
- Modify: `../documentation/extensions/build/fetch-data-with-hooks.mdx`
- Modify: `../documentation/extensions/build/forms-from-schemas.mdx`
- Modify: `../documentation/extensions/build/hosted-storage.mdx`
- Modify: `../documentation/extensions/build/share-state.mdx`
- Modify: `../documentation/extensions/build/style-with-host-tokens.mdx`
- Regenerate: `../documentation/extensions/reference/frontend-api.mdx`
- Regenerate: `../documentation/extensions/reference/frontend-api/`
- Regenerate: `../documentation/extensions/reference/_generated.json`
- Regenerate: `../documentation/docs.json`

**Interfaces:**

- The Frontend API reference consumes both `src/index.ts` and `src/ui.ts` so non-UI client contracts and `/ui` components appear in one generated reference group.
- Authored examples import UI from `/ui`, CSS from `/ui/styles.css`, and hooks/types from the package root.

- [ ] **Step 1: Write a failing generated-reference integration test**

  In `test/docs/api-reference.test.ts`, create a temporary documentation root with the required `docs.json`, run `scripts/build-api-reference.ts` against it, and assert the produced frontend page list contains `Function.Button` and `Function.SchemaForm` and does not contain `Function.TapButton` or `Function.TapForm`.

- [ ] **Step 2: Run the integration test and verify RED**

  Run: `pnpm vitest run test/docs/api-reference.test.ts`

  Expected: FAIL because the generator and TypeDoc configuration only read `src/index.ts`, where UI is no longer exported.

- [ ] **Step 3: Teach TypeDoc and the generator about both frontend entries**

  Change `typedoc.frontend.json` to read `src/index.ts` and `src/ui.ts`. Change the generator `Entry` model from one `entryPoint` to `entryPoints: string[]` and pass every frontend entry to TypeDoc. Rerun `pnpm vitest run test/docs/api-reference.test.ts` and expect PASS.

- [ ] **Step 4: Regenerate references and verify authored docs still fail the dead-reference check**

  Run from the SDK: `pnpm docs:reference ../documentation`, then run the final legacy `rg` over `../documentation/extensions`.

  Expected: generated legacy symbol pages disappear, but authored build guides still match and must be migrated.

- [ ] **Step 5: Migrate authored guides and sync navigation**

  Rewrite imports and examples using the compound API without changing guide outcomes. Run `node scripts/sync-reference-nav.mjs` from the documentation repository after generation.

- [ ] **Step 6: Verify SDK docs and the documentation repository**

  Run:

  ```bash
  pnpm docs:examples
  pnpm docs:validate
  node ../documentation/scripts/check-docs.mjs --strict
  rg -n "\b(TapButton|TapCard|TapPageHeader|TapSkeleton|TapEmptyState|TapErrorState|TapStat|TapInput|TapSelect|TapTable|TapDialog|TapForm|formFields)\b|@tappify/extension-sdk/styles\.css" ../documentation/extensions
  ```

  Expected: validation commands PASS and `rg` returns no matches except non-UI names such as `TapError`, `Tap`, and `TapForm` nowhere.

- [ ] **Step 7: Commit generator and documentation changes in their own repositories**

  ```bash
  git add scripts/build-api-reference.ts typedoc.frontend.json test/docs/api-reference.test.ts
  git commit -m "docs: generate One UI component reference"
  git -C ../documentation add docs.json extensions
  git -C ../documentation commit -m "docs: migrate extension UI guides to One UI"
  ```

### Task 12: Run cross-repository removal and release verification

**Files:**

- Modify only files required to correct failures caused by Tasks 1–11; do not perform unrelated cleanup.

**Interfaces:**

- Verifies the complete public and consumer contract; produces no new API.

- [ ] **Step 1: Run the full SDK quality gate**

  From `extension-sdk`, run:

  ```bash
  pnpm test
  pnpm type-check
  pnpm format:check
  pnpm lint
  pnpm build
  pnpm docs:examples
  pnpm docs:validate
  ```

  Expected: every command PASS with no warnings introduced by this migration.

- [ ] **Step 2: Run downstream verification**

  Run starter tests/typecheck/build, all five affected lab packages' tests/typecheck/build, the two focused web test files plus web typecheck, and documentation strict checks.

  Expected: PASS; record any unrelated pre-existing failure by command and file.

- [ ] **Step 3: Run the repository-wide dead-code audit**

  From `/Users/vulakh/Desktop/Work/Tappify`, run:

  ```bash
  rg -n "\b(TapButton|TapCard|TapPageHeader|TapSkeleton|TapEmptyState|TapErrorState|TapStat|TapInput|TapSelect|TapTable|TapDialog|TapForm|formFields)\b|\.tap-(btn|card|page-header|skeleton|state|stat|field|control|table|dialog|form)\b|@tappify/extension-sdk/styles\.css" extension-sdk extension-starter extensions-lab documentation web --glob '!**/node_modules/**' --glob '!**/dist/**' --glob '!**/coverage/**' --glob '!**/.next/**' --glob '!**/.git/**' --glob '!extension-sdk/docs/superpowers/**'
  ```

  Expected: no matches outside the approved design/implementation-plan historical record. The removed source files do not exist, and `dist/` contains `ui` declarations/bundles plus `ui/styles.css` but no root `styles.css`.

- [ ] **Step 4: Compare the rendered reference states**

  Use the local preview to render button variants, the starter summary card, schema settings form, dialog, table, loading, empty, and error states. Compare them at the reference viewport and at a 360 pixel mount against the LocalFigma nodes in Global Constraints; verify focus, hover, pressed, disabled, invalid, and reduced-motion states.

- [ ] **Step 5: Review repository status and commit only causal verification fixes**

  Check `git status --short` separately in `extension-sdk`, `extension-starter`, `extensions-lab`, `documentation`, and `web`. Do not stage unrelated user changes. If verification required causal fixes, commit them in the owning repository with a scoped conventional commit; otherwise make no empty commit.
