import type { TapClient } from '../client/TapClient';
import { useTapContext } from '../context/tap-context';

export function useTapClient(): TapClient {
  return useTapContext().client;
}
