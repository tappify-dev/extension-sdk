import { render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TapAppProvider } from '../../../src/frontend/context/TapAppProvider';
import { useTapContext } from '../../../src/frontend/context/tap-context';
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

describe('TapAppProvider', () => {
  it('renders children', () => {
    render(
      <TapAppProvider auth={mockAuth} config={mockConfig}>
        <div data-testid="child">Hello</div>
      </TapAppProvider>,
    );
    expect(screen.getByTestId('child')).toHaveTextContent('Hello');
  });

  it('provides auth, config, client, and environment via context', () => {
    function Consumer() {
      const ctx = useTapContext();
      return (
        <div>
          <span data-testid="user">{ctx.auth.user.id}</span>
          <span data-testid="config">{ctx.config.name}</span>
          <span data-testid="env">{ctx.environment}</span>
          <span data-testid="client">{ctx.client ? 'exists' : 'none'}</span>
        </div>
      );
    }

    render(
      <TapAppProvider auth={mockAuth} config={mockConfig}>
        <Consumer />
      </TapAppProvider>,
    );

    expect(screen.getByTestId('user')).toHaveTextContent('user-1');
    expect(screen.getByTestId('config')).toHaveTextContent('Test App');
    expect(screen.getByTestId('env')).toHaveTextContent('production');
    expect(screen.getByTestId('client')).toHaveTextContent('exists');
  });

  it('defaults environment to production', () => {
    function Consumer() {
      const ctx = useTapContext();
      return <span data-testid="env">{ctx.environment}</span>;
    }

    render(
      <TapAppProvider auth={mockAuth} config={mockConfig}>
        <Consumer />
      </TapAppProvider>,
    );

    expect(screen.getByTestId('env')).toHaveTextContent('production');
  });

  it('useTapContext() throws outside provider', () => {
    expect(() => {
      renderHook(() => useTapContext());
    }).toThrow('useTapContext must be used within a <TapAppProvider>');
  });
});
