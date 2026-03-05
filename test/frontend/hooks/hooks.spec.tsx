import { renderHook } from '@testing-library/react';
import React from 'react';
import { describe, expect, it } from 'vitest';
import { TapAppProvider } from '../../../src/frontend/context/TapAppProvider';
import { useTapAuth } from '../../../src/frontend/hooks/useTapAuth';
import { useTapClient } from '../../../src/frontend/hooks/useTapClient';
import { useTapConfig } from '../../../src/frontend/hooks/useTapConfig';
import type { TapAppConfig } from '../../../src/types/app-config';
import type { TapAuthContext } from '../../../src/types/auth';

const mockAuth: TapAuthContext = {
  user: { id: 'user-1', organizationId: 'org-1' },
  organization: { id: 'org-1', name: 'Test Org' },
  token: 'test-token',
  installationId: 'inst-1',
};

const mockConfig: TapAppConfig = {
  id: 'app-1',
  name: 'Test App',
  slug: 'test-app',
  description: 'Test',
  type: 'appstore',
  auth: { method: 'jwt' },
  baseUrl: 'https://api.example.com',
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <TapAppProvider auth={mockAuth} config={mockConfig}>
      {children}
    </TapAppProvider>
  );
}

describe('useTapAuth', () => {
  it('returns auth from context', () => {
    const { result } = renderHook(() => useTapAuth(), { wrapper });
    expect(result.current).toEqual(mockAuth);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useTapAuth())).toThrow(
      'useTapContext must be used within a <TapAppProvider>',
    );
  });
});

describe('useTapClient', () => {
  it('returns client from context', () => {
    const { result } = renderHook(() => useTapClient(), { wrapper });
    expect(result.current).toBeDefined();
    expect(typeof result.current.get).toBe('function');
    expect(typeof result.current.post).toBe('function');
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useTapClient())).toThrow(
      'useTapContext must be used within a <TapAppProvider>',
    );
  });
});

describe('useTapConfig', () => {
  it('returns config from context', () => {
    const { result } = renderHook(() => useTapConfig(), { wrapper });
    expect(result.current).toEqual(mockConfig);
  });

  it('throws when used outside provider', () => {
    expect(() => renderHook(() => useTapConfig())).toThrow(
      'useTapContext must be used within a <TapAppProvider>',
    );
  });
});
