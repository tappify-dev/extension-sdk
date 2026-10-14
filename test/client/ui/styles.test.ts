import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  resolve(__dirname, '../../../src/client/ui/styles.css'),
  'utf8',
);

function rule(selector: string) {
  const start = css.indexOf(`${selector} {`);
  const end = start === -1 ? -1 : css.indexOf('}', start);

  expect(start, `missing CSS rule for ${selector}`).not.toBe(-1);
  return end === -1 ? '' : css.slice(start, end);
}

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
      '--tappify-inverse: var(--inverse, #181920)',
      '--tappify-fg-disabled: var(--fg-disabled, #6f757d)',
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
    expect(css).toContain('.tap-stack');
    expect(css).toContain('.tap-inline');
    expect(css).toContain("[data-gap='24']");
    expect(css).toContain("[data-justify='between']");
  });

  it('matches the LocalFigma button variants and interaction states', () => {
    expect(rule('.tap-button')).toContain('gap: 6px');
    expect(rule('.tap-button')).toContain('padding: 0 var(--tappify-space-12)');
    expect(rule('.tap-button')).toContain('font-weight: 500');
    expect(rule('.tap-button:hover:not(:disabled)')).toContain('opacity: 0.88');
    expect(rule('.tap-button:active:not(:disabled)')).toContain(
      'opacity: 0.74',
    );
    expect(rule(".tap-button[data-variant='primary']")).toContain(
      'color: var(--tappify-deep-green)',
    );
    expect(rule(".tap-button[data-variant='primary']")).toContain(
      'background: var(--tappify-lime)',
    );
    expect(rule(".tap-button[data-variant='inverse']")).toContain(
      'color: var(--tappify-bg-paper)',
    );
    expect(rule(".tap-button[data-variant='inverse']")).toContain(
      'background: var(--tappify-inverse)',
    );
    expect(rule('.tap-button:disabled')).toContain(
      'color: var(--tappify-fg-disabled)',
    );
    expect(rule('.tap-button:disabled')).toContain('opacity: 0.8');
  });

  it('matches the LocalFigma card surface and semantic table row heights', () => {
    expect(rule('.tap-ui-card')).not.toContain('border:');
    expect(rule(".tap-table__row[data-variant='header']")).toContain(
      'height: 44px',
    );
    expect(rule(".tap-table__row[data-variant='body']")).toContain(
      'height: 48px',
    );
  });
});
