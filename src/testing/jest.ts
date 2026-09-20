import { clearTapPortals, installHostTheme } from './environment';
import { registerTapMatchers, type MatcherTarget } from './matchers';

export type { MatcherResult } from './matchers';

declare global {
  /* eslint-disable-next-line @typescript-eslint/no-namespace -- Jest's own matcher types live in the global `jest` namespace, so an augmentation has to declare one */
  namespace jest {
    interface Matchers<R> {
      toHaveNavigatedTo(path: string): R;
      toHaveToasted(expected: string | RegExp): R;
      toHaveRunAction(actionId: string, input?: unknown): R;
      toHaveStored(collection: string, document: unknown): R;
    }
  }
}

interface JestGlobal {
  expect?: MatcherTarget;
  afterEach?: (hook: () => void) => void;
}

const jestGlobal: typeof globalThis & JestGlobal = globalThis;

installHostTheme(document.documentElement);

if (jestGlobal.expect !== undefined) {
  registerTapMatchers(jestGlobal.expect);
}

jestGlobal.afterEach?.(() => {
  clearTapPortals();
});
