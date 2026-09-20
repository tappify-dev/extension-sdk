const HOST_THEME: Record<string, string> = {
  '--bg-base': '#ffffff',
  '--bg-subtle': 'rgba(18, 18, 18, 0.04)',
  '--bg-raised': '#ffffff',
  '--fg-default': '#121212',
  '--fg-muted': 'rgba(18, 18, 18, 0.6)',
  '--fg-inverse': '#ffffff',
  '--tap-accent': '#4f46e5',
  '--tap-accent-fg': '#ffffff',
  '--tap-danger': '#b42318',
  '--tap-scrim': 'rgba(18, 18, 18, 0.7)',
  '--tap-radius': '6px',
  '--tap-space': '8px',
  '--font-sans': 'system-ui, -apple-system, sans-serif',
  '--font-mono': 'ui-monospace, SFMono-Regular, monospace',
  '--divider': 'rgba(18, 18, 18, 0.12)',
};

/**
 * Sets the host's fifteen CSS variables on an element, so a component renders in
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
