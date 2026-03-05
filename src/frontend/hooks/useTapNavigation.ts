/**
 * Navigation hook stub for v0.1.
 * Will be implemented with shell postMessage protocol in a future version.
 */
/* eslint-disable no-console */
export function useTapNavigation() {
  return {
    navigate: (_path: string) => {
      console.warn('[TapSDK] useTapNavigation.navigate is not yet implemented');
    },
    goBack: () => {
      console.warn('[TapSDK] useTapNavigation.goBack is not yet implemented');
    },
  };
}
/* eslint-enable no-console */
