import { afterEach, expect } from 'vitest';
import { clearTapPortals, installHostTheme } from './environment';
import { registerTapMatchers } from './matchers';

export type { MatcherResult } from './matchers';

/* eslint-disable @typescript-eslint/no-explicit-any -- an augmentation has to repeat vitest's own `Matchers<T = any>` parameter list verbatim */
declare module 'vitest' {
  interface Matchers<T = any> {
    toHaveNavigatedTo(path: string): T;
    toHaveToasted(expected: string | RegExp): T;
    toHaveRunAction(actionId: string, input?: unknown): T;
    toHaveStored(collection: string, document: unknown): T;
  }
}

/* eslint-disable @typescript-eslint/no-namespace -- Chai exposes its matcher contract as a global namespace */
declare global {
  namespace Chai {
    interface Assertion {
      toHaveNavigatedTo(path: string): void;
      toHaveToasted(expected: string | RegExp): void;
      toHaveRunAction(actionId: string, input?: unknown): void;
      toHaveStored(collection: string, document: unknown): void;
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */
/* eslint-enable @typescript-eslint/no-explicit-any */

installHostTheme(document.documentElement);
registerTapMatchers(expect);

afterEach(() => {
  clearTapPortals();
});
