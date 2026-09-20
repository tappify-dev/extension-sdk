import { TapError } from '../client/errors';
import type { TapMock } from './mock';

/** What each matcher returns, in the shape vitest and jest both read. */
export interface MatcherResult {
  pass: boolean;
  /** Built only when the runner reports, and worded for both `expect` and `not`. */
  message(): string;
}

/** The part of a runner's `expect` that `registerTapMatchers` needs. */
export interface MatcherTarget {
  /** Both runners take a map of matcher functions keyed by matcher name. */
  extend(matchers: Record<string, unknown>): void;
}

function isMock(value: unknown): value is TapMock {
  return (
    typeof value === 'object' &&
    value !== null &&
    'calls' in value &&
    'documents' in value &&
    typeof value.documents === 'function'
  );
}

function requireMock(value: unknown, matcher: string): TapMock {
  if (isMock(value)) return value;
  throw new TapError(
    'TAP_TEST_TARGET_INVALID',
    `${matcher}() takes the mock renderWithTap() returned. Call it as expect(mock).${matcher}(…), not on the component or the tap object.`,
  );
}

function tagOf(value: unknown): string {
  return Object.prototype.toString.call(value);
}

function sameList(left: unknown[], right: unknown[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => same(item, right[index]))
  );
}

function bytesOf(view: ArrayBufferView): number[] {
  return [...new Uint8Array(view.buffer, view.byteOffset, view.byteLength)];
}

function same(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;

  const tag = tagOf(left);
  if (tag !== tagOf(right)) return false;

  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  ) {
    return false;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.valueOf() === right.valueOf();
  }
  if (left instanceof RegExp && right instanceof RegExp) {
    return left.source === right.source && left.flags === right.flags;
  }
  if (left instanceof Map && right instanceof Map) {
    return sameList([...left.entries()], [...right.entries()]);
  }
  if (left instanceof Set && right instanceof Set) {
    return sameList([...left.values()], [...right.values()]);
  }
  if (ArrayBuffer.isView(left) && ArrayBuffer.isView(right)) {
    return sameList(bytesOf(left), bytesOf(right));
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return sameList(left, right);
  }
  if (tag !== '[object Object]') return false;

  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      key =>
        key in right && same(Reflect.get(left, key), Reflect.get(right, key)),
    )
  );
}

/**
 * The four matchers that assert on what a component asked the host to do.
 *
 * @remarks
 * Each takes the mock `renderWithTap` returns, so the assertion is
 * `expect(mock).toHaveToasted(…)` rather than `expect(component)`; anything else
 * throws a `TapError` carrying `TAP_TEST_TARGET_INVALID`. A failure names every
 * call that was recorded, so a wrong path or message reads without a debugger. The
 * vitest and jest presets register these, and both declare the four on the runner's
 * own `Matchers` interface, so `expect(mock).toHaveToasted` typechecks once the
 * preset is in the setup files.
 *
 * @example
 * ```ts
 * import '@tappify/extension-sdk/testing/vitest';
 * import { createTapMock } from '@tappify/extension-sdk/testing';
 * import { expect, it } from 'vitest';
 *
 * it('toasts when a release ships', () => {
 *   const mock = createTapMock();
 *   mock.tap.ui.toast('A release shipped', 'neutral');
 *   expect(mock).toHaveToasted('A release shipped');
 * });
 * ```
 */
export const tapMatchers = {
  /** Passes when `tap.nav.push` was called with exactly that path. */
  toHaveNavigatedTo(received: unknown, path: string): MatcherResult {
    const mock = requireMock(received, 'toHaveNavigatedTo');
    const pass = mock.calls.navigations.includes(path);
    return {
      pass,
      message: () =>
        pass
          ? `Expected no navigation to ${path}, but tap.nav.push was called with it.`
          : `Expected a navigation to ${path}. tap.nav.push was called with: ${
              mock.calls.navigations.length === 0
                ? 'nothing'
                : mock.calls.navigations.join(', ')
            }.`,
    };
  },

  /** Passes when a toast matched the string exactly, or the pattern anywhere. */
  toHaveToasted(received: unknown, expected: string | RegExp): MatcherResult {
    const mock = requireMock(received, 'toHaveToasted');
    const messages = mock.calls.toasts.map(toast => toast.message);
    const pass = messages.some(message =>
      typeof expected === 'string'
        ? message === expected
        : expected.test(message),
    );
    return {
      pass,
      message: () =>
        pass
          ? `Expected no toast matching ${String(expected)}, but one was shown.`
          : `Expected a toast matching ${String(expected)}. Toasts shown: ${
              messages.length === 0 ? 'none' : messages.join(' | ')
            }.`,
    };
  },

  /**
   * Passes when `tap.actions.run` was called with that action, and with input
   * deep-equal to `input` when one is given.
   */
  toHaveRunAction(
    received: unknown,
    actionId: string,
    input?: unknown,
  ): MatcherResult {
    const mock = requireMock(received, 'toHaveRunAction');
    const runs = mock.calls.actions.filter(run => run.actionId === actionId);
    const pass =
      input === undefined
        ? runs.length > 0
        : runs.some(run => same(run.input, input));
    return {
      pass,
      message: () =>
        pass
          ? `Expected tap.actions.run("${actionId}") not to be called.`
          : `Expected tap.actions.run("${actionId}"${
              input === undefined ? '' : `, ${JSON.stringify(input)}`
            }). Runs recorded: ${
              mock.calls.actions.length === 0
                ? 'none'
                : JSON.stringify(mock.calls.actions)
            }.`,
    };
  },

  /**
   * Passes when the mock's storage holds a document deep-equal to that one in
   * that collection.
   */
  toHaveStored(
    received: unknown,
    collection: string,
    document: unknown,
  ): MatcherResult {
    const mock = requireMock(received, 'toHaveStored');
    const stored = mock.documents(collection);
    const pass = stored.some(candidate => same(candidate, document));
    return {
      pass,
      message: () =>
        pass
          ? `Expected "${collection}" not to hold ${JSON.stringify(document)}.`
          : `Expected "${collection}" to hold ${JSON.stringify(document)}. It holds: ${
              stored.length === 0 ? 'nothing' : JSON.stringify(stored)
            }.`,
    };
  },
};

/**
 * Registers the four matchers on a runner's `expect`.
 *
 * @remarks
 * The vitest and jest presets call this, so a suite that loads
 * `@tappify/extension-sdk/testing/vitest` or `.../testing/jest` as a setup file
 * needs nothing else. Call it yourself only in a suite that does not use a preset,
 * and once — registering twice replaces the same four names. It adds no types of
 * its own, so a suite without a preset declares the four on the runner's `Matchers`
 * interface itself.
 *
 * @example
 * ```ts
 * import { registerTapMatchers } from '@tappify/extension-sdk/testing';
 * import { expect } from 'vitest';
 *
 * registerTapMatchers(expect);
 * ```
 */
export function registerTapMatchers(target: MatcherTarget): void {
  target.extend(tapMatchers);
}
