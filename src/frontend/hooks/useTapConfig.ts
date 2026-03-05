import type { TapAppConfig } from '../../types/app-config';
import { useTapContext } from '../context/tap-context';

export function useTapConfig(): TapAppConfig {
  return useTapContext().config;
}
