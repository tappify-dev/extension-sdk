import React, { useMemo } from 'react';
import type { TapAppConfig } from '../../types/app-config';
import type { TapAuthContext } from '../../types/auth';
import type { TapEnvironment } from '../../types/common';
import { TapClient } from '../client/TapClient';
import { TapContext } from './tap-context';

export interface TapAppProviderProps {
  auth: TapAuthContext;
  config: TapAppConfig;
  environment?: TapEnvironment;
  children: React.ReactNode;
}

export function TapAppProvider({
  auth,
  config,
  environment = 'production',
  children,
}: TapAppProviderProps) {
  const client = useMemo(
    () =>
      new TapClient({
        baseUrl: config.baseUrl,
        token: auth.token,
        installationId: auth.installationId,
      }),
    [config.baseUrl, auth.token, auth.installationId],
  );

  const value = useMemo(
    () => ({ auth, config, client, environment }),
    [auth, config, client, environment],
  );

  return <TapContext.Provider value={value}>{children}</TapContext.Provider>;
}
