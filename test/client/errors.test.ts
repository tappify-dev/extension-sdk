import { describe, expect, it } from 'vitest';
import {
  TAP_ERROR_CODES,
  TapError,
  TapServerError,
} from '../../src/client/errors';

describe('TapError', () => {
  it('carries a code and an actionable message', () => {
    const error = new TapError(
      'TAP_OUTSIDE_HOST',
      'useTap() ran outside a Tappify mount. Render this component through a contribution entry declared in tappify.extension.json.',
    );

    expect(error.code).toBe('TAP_OUTSIDE_HOST');
    expect(error.name).toBe('TapError');
    expect(error.message).toContain('tappify.extension.json');
    expect(error).toBeInstanceOf(Error);
  });

  it('recognises its own instances across bundle copies', () => {
    const copy = { name: 'TapError', code: 'TAP_OUTSIDE_HOST', message: 'x' };
    const real = new TapError('TAP_OUTSIDE_HOST', 'x');

    expect(TapError.is(real)).toBe(true);
    expect(TapError.is(copy)).toBe(false);
    expect(TapError.is(new Error('x'))).toBe(false);
  });

  it('lists every code it can throw', () => {
    expect(TAP_ERROR_CODES).toContain('TAP_OUTSIDE_HOST');
    expect(new Set(TAP_ERROR_CODES).size).toBe(TAP_ERROR_CODES.length);
  });
});

describe('TapServerError', () => {
  it('serialises to the wire shape the host relays', () => {
    const error = new TapServerError(
      'FUNNEL_UNAVAILABLE',
      'The funnel needs at least one shipped release. Ship a release, then retry.',
      503,
    );

    expect(error.status).toBe(503);
    expect(error.toJSON()).toEqual({
      error: {
        code: 'FUNNEL_UNAVAILABLE',
        message:
          'The funnel needs at least one shipped release. Ship a release, then retry.',
      },
    });
  });

  it('recognises an instance thrown by another copy of the class', () => {
    class Other extends Error {
      readonly code = 'X';
      constructor() {
        super('x');
        this.name = 'TapServerError';
      }
    }

    expect(TapServerError.is(new Other())).toBe(true);
    expect(TapServerError.is(new TapError('TAP_OUTSIDE_HOST', 'x'))).toBe(
      false,
    );
  });
});
