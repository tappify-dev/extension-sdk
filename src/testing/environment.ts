const HOST_THEME: Record<string, string> = {
  '--bg-paper': '#fdfdfd',
  '--bg-canvas': '#f2f3ee',
  '--bg-light-gray': '#edf1f5',
  '--fg-primary': '#121212',
  '--fg-sub': 'rgba(18, 18, 18, 0.7)',
  '--divider': '#d5d7da',
  '--lime': '#b4d773',
  '--deep-green': '#234e20',
  '--danger': '#b42318',
  '--on-accent': '#ffffff',
  '--font-one-ui': "'Inter Variable', 'Inter', system-ui, sans-serif",
};

/**
 * Sets the host's eleven One UI CSS variables on an element, so a component renders in
 * a test the way it renders in the host.
 *
 * @remarks
 * Sets the light values as inline custom properties, which inherit into everything
 * below the element. The vitest and jest presets call it on
 * `document.documentElement` for you, so call it yourself only in a test that
 * renders outside `renderWithTap` or wants the variables on one subtree. It sets
 * no dark values; drive the mode through `renderWithTap`'s `theme` option, which
 * is what `useTapTheme` reads.
 *
 * @example
 * ```ts
 * import { installHostTheme } from '@tappify/extension-sdk/testing';
 *
 * function mountRoot(): HTMLElement {
 *   const root = document.createElement('div');
 *   installHostTheme(root);
 *   document.body.append(root);
 *   return root;
 * }
 * ```
 */
export function installHostTheme(root: HTMLElement): void {
  for (const [name, value] of Object.entries(HOST_THEME)) {
    root.style.setProperty(name, value);
  }
}

export function clearTapPortals(root: ParentNode = document): void {
  for (const node of root.querySelectorAll('[data-tap-portal]')) node.remove();
}
