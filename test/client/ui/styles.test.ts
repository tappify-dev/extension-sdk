import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  resolve(__dirname, '../../../src/client/ui/styles.css'),
  'utf8',
);

describe('One UI stylesheet', () => {
  it('ships the canonical color, spacing, radius, and control tokens', () => {
    for (const declaration of [
      '--tappify-bg-paper: var(--bg-paper, #fdfdfd)',
      '--tappify-bg-canvas: var(--bg-canvas, #f2f3ee)',
      '--tappify-bg-light-gray: var(--bg-light-gray, #edf1f5)',
      '--tappify-fg-primary: var(--fg-primary, #121212)',
      '--tappify-fg-sub: var(--fg-sub, rgb(18 18 18 / 70%))',
      '--tappify-divider: var(--divider, #d5d7da)',
      '--tappify-lime: var(--lime, #b4d773)',
      '--tappify-deep-green: var(--deep-green, #234e20)',
      '--tappify-space-4: 4px',
      '--tappify-space-40: 40px',
      '--tappify-radius-control: 8px',
      '--tappify-radius-card: 14px',
      '--tappify-radius-panel: 18px',
      '--tappify-control-height: 36px',
    ]) {
      expect(css).toContain(declaration);
    }
  });

  it('styles tokenized Stack and Inline layouts', () => {
    expect(css).toContain("[data-slot='stack']");
    expect(css).toContain("[data-slot='inline']");
    expect(css).toContain("[data-gap='24']");
    expect(css).toContain("[data-justify='between']");
  });
});
