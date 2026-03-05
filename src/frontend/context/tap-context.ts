import { createContext, useContext } from 'react';
import type { TapAppConfig } from '../../types/app-config';
import type { TapAuthContext } from '../../types/auth';
import type { TapClient } from '../client/TapClient';

export interface TapContextValue {
  auth: TapAuthContext;
  config: TapAppConfig;
  client: TapClient;
  environment: 'development' | 'staging' | 'production';
}

export const TapContext = createContext<TapContextValue | null>(null);

export function useTapContext(): TapContextValue {
  const context = useContext(TapContext);
  if (!context) {
    throw new Error('useTapContext must be used within a <TapAppProvider>');
  }
  return context;
}
