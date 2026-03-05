import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TapServiceClient } from '../../src/server/TapServiceClient';
import { TapApiError } from '../../src/server/helpers/errors';

function mockFetch(data: unknown = {}, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  });
}

describe('TapServiceClient', () => {
  const config = {
    apiBaseUrl: 'https://api.tap.security',
    serviceToken: 'svc-token-123',
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('strips trailing slash from apiBaseUrl', () => {
    const fetchMock = mockFetch({});
    globalThis.fetch = fetchMock;
    const client = new TapServiceClient({
      ...config,
      apiBaseUrl: 'https://api.tap.security/',
    });
    void client.getInstallation('inst-1');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('https://api.tap.security/marketplace'),
      expect.anything(),
    );
  });

  describe('getInstallation()', () => {
    it('calls correct URL with auth header and returns data', async () => {
      const installation = {
        id: 'inst-1',
        integrationId: 'int-1',
        organizationId: 'org-1',
        metadata: {},
        status: 'active',
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      };
      const fetchMock = mockFetch(installation);
      globalThis.fetch = fetchMock;
      const client = new TapServiceClient(config);

      const result = await client.getInstallation('inst-1');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.tap.security/marketplace/installations/inst-1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            Authorization: 'Bearer svc-token-123',
          }),
        }),
      );
      expect(result).toEqual(installation);
    });
  });

  describe('getInstallationSecret()', () => {
    it('calls correct URL with fieldName', async () => {
      const fetchMock = mockFetch({ value: 'secret-val' });
      globalThis.fetch = fetchMock;
      const client = new TapServiceClient(config);

      const result = await client.getInstallationSecret('inst-1', 'api_key');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.tap.security/marketplace/installations/inst-1/secrets/api_key',
        expect.anything(),
      );
      expect(result).toEqual({ value: 'secret-val' });
    });
  });

  describe('error handling', () => {
    it('throws TapApiError on non-ok response', async () => {
      globalThis.fetch = mockFetch(
        { code: 'NOT_FOUND', message: 'Not found' },
        404,
        false,
      );
      const client = new TapServiceClient(config);

      await expect(client.getInstallation('bad-id')).rejects.toThrow(
        TapApiError,
      );
      await expect(client.getInstallation('bad-id')).rejects.toMatchObject({
        statusCode: 404,
        code: 'NOT_FOUND',
      });
    });

    it('falls back to defaults on non-JSON error body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('not json')),
      });
      const client = new TapServiceClient(config);

      await expect(client.getInstallation('x')).rejects.toMatchObject({
        code: 'REQUEST_FAILED',
        statusCode: 500,
      });
    });
  });
});
