import { describe, expect, it } from 'vitest';
import { collectStyles } from '../../src/host/collect-styles';

describe('collectStyles', () => {
  it('reads the styles export the Vite plugin generates', () => {
    expect(
      collectStyles({ default: () => null, styles: ['.a{}', '.b{}'] }),
    ).toEqual(['.a{}', '.b{}']);
  });

  it('returns nothing for a remote that exports no styles', () => {
    expect(collectStyles({ default: () => null })).toEqual([]);
    expect(collectStyles(null)).toEqual([]);
    expect(collectStyles('not a module')).toEqual([]);
    expect(collectStyles({ styles: 'one-string' })).toEqual([]);
    expect(collectStyles({ styles: ['.a{}', 7] })).toEqual(['.a{}']);
  });
});
