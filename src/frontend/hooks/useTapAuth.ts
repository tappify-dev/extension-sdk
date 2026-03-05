import type { TapAuthContext } from '../../types/auth';
import { useTapContext } from '../context/tap-context';

export function useTapAuth(): TapAuthContext {
  return useTapContext().auth;
}
