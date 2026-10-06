import { createContext, useContext, type Context } from 'react';
import { TapError } from './errors';
import type { Tap } from './types';

const REGISTRY_KEY = '__tappifyExtensionSdkTapContextV2__';

interface ContextRegistry {
  [REGISTRY_KEY]?: Context<Tap | null>;
}

const registry: typeof globalThis & ContextRegistry = globalThis;

function resolveContext(): Context<Tap | null> {
  const existing = registry[REGISTRY_KEY];
  if (existing) return existing;

  const created = createContext<Tap | null>(null);
  created.displayName = 'TapContext';
  registry[REGISTRY_KEY] = created;
  return created;
}

export const TapContext: Context<Tap | null> = resolveContext();

/**
 * Returns the whole bridge the host mounted this component with.
 *
 * @remarks
 * Throws `TapError` with code `TAP_OUTSIDE_HOST` when no Tappify mount is above
 * the component. The object it returns does not re-render the component when the
 * host changes a member; read through `useTapFilters`, `useTapTheme` and the
 * other slice hooks where that matters.
 *
 * @example
 * ```tsx
 * import { TapButton, useTap } from '@tappify/extension-sdk';
 *
 * function CopyId() {
 *   const tap = useTap();
 *   return (
 *     <TapButton onClick={() => void tap.ui.copy(tap.project.id)}>
 *       Copy project id
 *     </TapButton>
 *   );
 * }
 * ```
 */
export function useTap(): Tap {
  const tap = useContext(TapContext);
  if (tap === null) {
    throw new TapError(
      'TAP_OUTSIDE_HOST',
      'useTap() ran outside a Tappify mount. Render this component from an entry declared in tappify.extension.json, or wrap it in renderWithTap() from @tappify/extension-sdk/testing.',
    );
  }
  return tap;
}
