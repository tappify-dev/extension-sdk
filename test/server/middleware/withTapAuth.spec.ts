/* cspell:words AQAB */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TapLambdaEvent } from '../../../src/server/middleware/types';
import { withTapAuth } from '../../../src/server/middleware/withTapAuth';

// Helper to create base64url encoded string
function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  const base64 = btoa(json);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeEvent(overrides: Partial<TapLambdaEvent> = {}): TapLambdaEvent {
  return {
    headers: {},
    httpMethod: 'GET',
    path: '/test',
    ...overrides,
  };
}

const authOptions = {
  workosClientId: 'client_test123',
  workosBaseUrl: 'https://api.workos.com',
};

describe('withTapAuth', () => {
  let originalFetch: typeof globalThis.fetch;
  const handler = vi.fn().mockResolvedValue({
    statusCode: 200,
    body: '{"ok":true}',
  });

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    handler.mockClear();
    // Reset the module-level JWKS cache by re-importing
    // Since we can't easily reset the module cache, we just mock fetch per test
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns 401 when no Authorization header', async () => {
    const middleware = withTapAuth(handler, authOptions);
    const result = await middleware(makeEvent());

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).code).toBe('UNAUTHORIZED');
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const middleware = withTapAuth(handler, authOptions);
    const result = await middleware(
      makeEvent({ headers: { authorization: 'Basic abc123' } }),
    );

    expect(result.statusCode).toBe(401);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token format (not 3 parts)', async () => {
    const middleware = withTapAuth(handler, authOptions);
    const result = await middleware(
      makeEvent({ headers: { authorization: 'Bearer not-a-valid-jwt' } }),
    );

    expect(result.statusCode).toBe(401);
    const body = JSON.parse(result.body);
    expect(body.message).toContain('Invalid token format');
  });

  it('returns 401 for expired token', async () => {
    const header = base64UrlEncode({ alg: 'RS256', kid: 'key-1' });
    const payload = base64UrlEncode({
      sub: 'user-1',
      org_id: 'org-1',
      iss: `https://api.workos.com/user_management/${authOptions.workosClientId}`,
      exp: Math.floor(Date.now() / 1000) - 3600, // expired 1 hour ago
    });
    const fakeSignature = base64UrlEncode('fake-sig');
    const token = `${header}.${payload}.${fakeSignature}`;

    // Mock JWKS fetch
    const mockKey = {
      kid: 'key-1',
      kty: 'RSA',
      n: 'test-n',
      e: 'AQAB',
      alg: 'RS256',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: [mockKey] }),
    });

    // Mock crypto.subtle to make importKey and verify succeed
    const mockCryptoKey = {} as CryptoKey;
    const originalSubtle = globalThis.crypto.subtle;
    const mockSubtle = {
      ...originalSubtle,
      importKey: vi.fn().mockResolvedValue(mockCryptoKey),
      verify: vi.fn().mockResolvedValue(true), // signature "valid"
    };
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: mockSubtle,
      writable: true,
      configurable: true,
    });

    const middleware = withTapAuth(handler, authOptions);
    const result = await middleware(
      makeEvent({ headers: { authorization: `Bearer ${token}` } }),
    );

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toContain('Token expired');

    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: originalSubtle,
      writable: true,
      configurable: true,
    });
  });

  it('returns 401 for wrong issuer', async () => {
    const header = base64UrlEncode({ alg: 'RS256', kid: 'key-1' });
    const payload = base64UrlEncode({
      sub: 'user-1',
      org_id: 'org-1',
      iss: 'https://evil.com/user_management/wrong',
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const fakeSignature = base64UrlEncode('fake-sig');
    const token = `${header}.${payload}.${fakeSignature}`;

    const mockKey = {
      kid: 'key-1',
      kty: 'RSA',
      n: 'test-n',
      e: 'AQAB',
      alg: 'RS256',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: [mockKey] }),
    });

    const originalSubtle = globalThis.crypto.subtle;
    const mockSubtle = {
      ...originalSubtle,
      importKey: vi.fn().mockResolvedValue({} as CryptoKey),
      verify: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: mockSubtle,
      writable: true,
      configurable: true,
    });

    const middleware = withTapAuth(handler, authOptions);
    const result = await middleware(
      makeEvent({ headers: { authorization: `Bearer ${token}` } }),
    );

    expect(result.statusCode).toBe(401);
    expect(JSON.parse(result.body).message).toContain('Invalid token issuer');

    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: originalSubtle,
      writable: true,
      configurable: true,
    });
  });

  it('calls handler with tapUser on valid token', async () => {
    const header = base64UrlEncode({ alg: 'RS256', kid: 'key-1' });
    const payload = base64UrlEncode({
      sub: 'user-1',
      org_id: 'org-1',
      role: 'admin',
      iss: `https://api.workos.com/user_management/${authOptions.workosClientId}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const fakeSignature = base64UrlEncode('fake-sig');
    const token = `${header}.${payload}.${fakeSignature}`;

    const mockKey = {
      kid: 'key-1',
      kty: 'RSA',
      n: 'test-n',
      e: 'AQAB',
      alg: 'RS256',
    };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ keys: [mockKey] }),
    });

    const originalSubtle = globalThis.crypto.subtle;
    const mockSubtle = {
      ...originalSubtle,
      importKey: vi.fn().mockResolvedValue({} as CryptoKey),
      verify: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: mockSubtle,
      writable: true,
      configurable: true,
    });

    const middleware = withTapAuth(handler, authOptions);
    await middleware(
      makeEvent({
        headers: {
          authorization: `Bearer ${token}`,
          'x-tap-installation-id': 'inst-99',
        },
      }),
    );

    expect(handler).toHaveBeenCalledOnce();
    const calledEvent = handler.mock.calls[0][0];
    expect(calledEvent.tapUser).toEqual({
      sub: 'user-1',
      orgId: 'org-1',
      role: 'admin',
      installationId: 'inst-99',
    });

    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: originalSubtle,
      writable: true,
      configurable: true,
    });
  });

  it('passes installationId from headers', async () => {
    const header = base64UrlEncode({ alg: 'RS256', kid: 'key-1' });
    const payload = base64UrlEncode({
      sub: 'user-1',
      org_id: 'org-1',
      iss: `https://api.workos.com/user_management/${authOptions.workosClientId}`,
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const fakeSignature = base64UrlEncode('fake-sig');
    const token = `${header}.${payload}.${fakeSignature}`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        keys: [
          { kid: 'key-1', kty: 'RSA', n: 'test-n', e: 'AQAB', alg: 'RS256' },
        ],
      }),
    });

    const originalSubtle = globalThis.crypto.subtle;
    const mockSubtle = {
      ...originalSubtle,
      importKey: vi.fn().mockResolvedValue({} as CryptoKey),
      verify: vi.fn().mockResolvedValue(true),
    };
    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: mockSubtle,
      writable: true,
      configurable: true,
    });

    const middleware = withTapAuth(handler, authOptions);
    await middleware(
      makeEvent({
        headers: {
          authorization: `Bearer ${token}`,
          'X-Tap-Installation-Id': 'install-abc',
        },
      }),
    );

    expect(handler.mock.calls[0][0].tapUser.installationId).toBe('install-abc');

    Object.defineProperty(globalThis.crypto, 'subtle', {
      value: originalSubtle,
      writable: true,
      configurable: true,
    });
  });
});
