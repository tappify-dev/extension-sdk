# One UI Extension SDK Components Design

**Date:** 2026-10-14
**Status:** Approved; implementation pending

## Purpose

Replace the extension SDK's current `Tap*` frontend component kit with a
clean-break, SDK-owned One UI component API. Extensions should look native to
Tappify by default, including when mounted in a shadow root or rendered in the
local preview.

This migration includes every in-repository consumer. The old UI components,
selectors, exports, tests, examples, and generated documentation are removed;
there are no deprecated aliases or compatibility wrappers.

## Sources of truth

LocalFigma is the visual source of truth and the existing repositories are the
functional source of truth. The implementation uses these LocalFigma nodes:

- `19607:821` — `Tappify / Extensions / RevenueCat`, the canonical extension
  composition;
- `19610:8654` — the connected RevenueCat extension as rendered on Home;
- `19191:1004` — `Tappify / Button`, including interaction variants;
- `18802:7270` — the current editable input treatment;
- `19162:13200` — the current dialog composition;
- `18785:7062` — the current semantic table treatment.

The relevant One UI foundations are Inter typography; 4, 8, 12, 16, 24, 32,
and 40 pixel spacing; 8 pixel control radius; 14 pixel card radius; 18 pixel
panel radius; 36 pixel default control height; paper `#fdfdfd`; canvas
`#f2f3ee`; light gray `#edf1f5`; main text `#121212`; secondary text
`#121212` at 70% opacity; divider `#d5d7da`; lime `#b4d773`; and deep green
`#234e20`.

## Package boundary

UI moves to two explicit exports:

```tsx
import {
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  Input,
  Table,
} from '@tappify/extension-sdk/ui';

import '@tappify/extension-sdk/ui/styles.css';
```

The package root no longer exports frontend components. Hooks, bridge types,
errors, formatters, manifest APIs, host APIs, testing APIs, and other non-UI
contracts remain unchanged. The existing top-level `styles.css` export is
removed in favor of `ui/styles.css`.

The UI implementation remains owned by the SDK rather than importing private
web application code. It uses React, semantic HTML, and scoped portable CSS so
it works inside extension shadow roots without a Tailwind build. It may use a
small runtime dependency only when that dependency materially improves an
accessible composite primitive; ordinary layout and styling do not add a
framework dependency.

## Public component surface

### Actions and surfaces

- `Button` supports `primary`, `secondary`, `tertiary`, `inverse`, and
  `destructive` variants; One UI control sizes; native button attributes; and
  a `loading` state that disables repeat activation and sets `aria-busy`.
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`,
  `CardContent`, and `CardFooter` provide a composable paper surface. The
  default extension card uses a 14 pixel radius, 24 pixel padding, and 16 pixel
  internal spacing to match the Home extension composition.
- `PageHeader` renders the title, description, and actions for page, tab, and
  settings contributions while respecting the host-owned page heading level.
- `Stack` and `Inline` provide tokenized vertical and horizontal layout without
  exposing global utility classes.

### Fields and forms

- `Input`, `Textarea`, `Checkbox`, and `Select` expose native control behavior
  and refs.
- `Field`, `FieldLabel`, `FieldDescription`, and `FieldError` compose labels,
  guidance, and validation messages. They generate or accept stable IDs and
  wire `aria-describedby` and `aria-invalid` correctly.
- `SchemaForm` and `schemaFields` replace `TapForm` and `formFields`. They retain
  the current JSON Schema mapping, required-field handling, Zod validation,
  number and boolean coercion, cleaned submission values, busy submission, and
  optional cancellation. Their rendered controls use the new field primitives.

### Dialogs and data display

- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`,
  `DialogDescription`, `DialogBody`, `DialogFooter`, and `DialogClose` form a
  controlled compound API. Dialog content renders into the extension mount's
  host portal, traps focus, returns focus on close, handles Escape and scrim
  dismissal, and continues to respond to the host close event.
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, and `TableCell`
  are semantic composable primitives. Consumers own row mapping. Interactive
  rows remain focusable and keyboard operable when a consumer makes them an
  action.
- `Metric` replaces `TapStat` with One UI number, label, delta, and supporting
  text hierarchy.
- `Skeleton`, `EmptyState`, and `ErrorState` cover loading, empty, and failure
  states. Skeleton animation respects reduced motion; errors remain live
  alerts; retry actions use `Button`.

## Styling contract

All selectors are scoped under the extension UI root and all components expose
stable `data-slot` attributes. Consumers can add a class without needing to
know internal selectors.

The stylesheet defines `--tappify-*` fallback values for standalone preview
and testing. When the host supplies the same tokens, host values win. Legacy
tokens such as `--tap-accent`, `--tap-radius`, `--fg-default`, `--fg-muted`,
`--bg-raised`, and `--bg-subtle` are not part of the new UI contract.

Static presentation stays in the SDK stylesheet. Inline styles are reserved
for data-driven values such as an explicitly supplied skeleton width. Controls
include hover, active, disabled, invalid, and keyboard focus-visible states.
Narrow mounts use container queries to stack actions and keep dialogs and
tables usable without widening the host surface.

## Behavior preservation

The migration changes the UI API and visual system, not the extension runtime:

- query, mutation, storage, state, theme, size, filter, and context hooks keep
  their current behavior;
- schema submission values and validation semantics remain unchanged;
- host portal and host-driven dialog close behavior remain unchanged;
- keyboard, focus, and screen-reader behavior are preserved or strengthened;
- loading, empty, error, partial, disabled, and narrow-layout states remain
  available even when a specific LocalFigma frame only shows the happy path;
- extensions continue to run in the current shadow-root isolation model and in
  the fixture-based local preview.

## Removal and migration

The SDK removes the old UI implementation rather than retaining dead code:

- delete the old monolithic primitives implementation and `TapDialog` and
  `TapForm` component modules after their replacements are active;
- remove every `TapButton`, `TapCard`, `TapPageHeader`, `TapSkeleton`,
  `TapEmptyState`, `TapErrorState`, `TapStat`, `TapInput`, `TapSelect`,
  `TapTable`, `TapDialog`, `TapForm`, and `formFields` export and type;
- remove all legacy `.tap-btn`, `.tap-card`, `.tap-page-header`,
  `.tap-skeleton`, `.tap-state`, `.tap-stat`, `.tap-field`, `.tap-control`,
  `.tap-table`, `.tap-dialog`, and `.tap-form` selectors;
- remove old component tests after equivalent new API coverage exists;
- remove generated reference pages for deleted symbols rather than leaving
  redirects to APIs that no longer exist.

All source consumers in `extension-starter`, `extensions-lab`, SDK fixtures,
and authored documentation migrate in the same change set. Generated API
reference files are regenerated from the new source declarations. Repository
searches for the removed symbols and selectors must return no live source,
test, example, or documentation references.

## Testing strategy

Implementation follows red-green-refactor cycles. The first tests establish
the new `ui` and `ui/styles.css` package exports and prove the old root UI
exports are absent. Component tests then cover:

- variants, sizes, busy and disabled behavior for actions;
- composable card and page-header structure;
- field labeling, descriptions, errors, refs, checkbox indeterminate state,
  and native control events;
- schema field mapping, validation, coercion, submission, and cancellation;
- dialog portal placement, naming, focus trap, focus restoration, Escape,
  scrim dismissal, and host close events;
- semantic table composition and consumer-provided row interaction;
- metric formatting and loading, empty, error, retry, and reduced-motion
  states;
- narrow mount layout contracts and the key One UI token/data-slot contract.

Verification covers SDK unit tests and coverage, typecheck, lint/format checks,
and production build. It also covers the starter, each affected Extensions Lab
package, SDK fixture builds, documentation examples and generated references,
and a final dead-code search. Existing unrelated failures are reported by name
and do not weaken the removal requirement.

## Release impact

This is an intentional breaking frontend API release. Release notes must list
the removed `Tap*` symbols, the new `/ui` import path, the new stylesheet path,
and representative before/after imports. No runtime or server API breaking
change is included.
