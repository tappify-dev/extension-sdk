import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TapClient } from '../../../src/frontend/client/TapClient';
import { TapSdkError } from '../../../src/types/common';

function mockFetch(data: unknown = {}, status = 200, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  });
}

describe('TapClient', () => {
  const clientConfig = {
    baseUrl: 'https://api.example.com',
    token: 'test-token',
    installationId: 'inst-123',
  };

  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('strips trailing slash from baseUrl', () => {
    const client = new TapClient({
      ...clientConfig,
      baseUrl: 'https://api.example.com/',
    });
    globalThis.fetch = mockFetch({ ok: true });
    void client.get('/test');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://api.example.com/test'),
      expect.anything(),
    );
  });

  describe('get()', () => {
    it('sends GET request with correct URL, auth header, and installation header', async () => {
      const fetchMock = mockFetch({ result: 'ok' });
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      const response = await client.get('/users');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({ method: 'GET' }),
      );
      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.get('Authorization')).toBe('Bearer test-token');
      expect(headers.get('X-Tap-Installation-Id')).toBe('inst-123');
      expect(response.data).toEqual({ result: 'ok' });
      expect(response.status).toBe(200);
    });
  });

  describe('post()', () => {
    it('sends JSON body', async () => {
      const fetchMock = mockFetch({ id: 1 });
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.post('/users', { name: 'Alice' });

      expect(fetchMock).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ name: 'Alice' }),
        }),
      );
    });
  });

  describe('put()', () => {
    it('sends PUT request', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.put('/users/1', { name: 'Bob' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  describe('patch()', () => {
    it('sends PATCH request', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.patch('/users/1', { name: 'Carol' });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('delete()', () => {
    it('sends DELETE request', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.delete('/users/1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('query params', () => {
    it('appends params to URL', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.get('/users', { params: { page: '1', limit: '10' } });

      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('page=1');
      expect(url).toContain('limit=10');
    });
  });

  describe('custom headers', () => {
    it('merges custom headers', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      await client.get('/test', {
        headers: { 'X-Custom': 'value' },
      });

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.get('X-Custom')).toBe('value');
    });
  });

  describe('updateToken()', () => {
    it('subsequent requests use the new token', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);

      client.updateToken('new-token');
      await client.get('/test');

      const headers = fetchMock.mock.calls[0][1].headers;
      expect(headers.get('Authorization')).toBe('Bearer new-token');
    });
  });

  describe('error handling', () => {
    it('throws TapSdkError on non-ok response', async () => {
      globalThis.fetch = mockFetch(
        { code: 'NOT_FOUND', message: 'User not found' },
        404,
        false,
      );
      const client = new TapClient(clientConfig);

      await expect(client.get('/users/999')).rejects.toThrow(TapSdkError);
      await expect(client.get('/users/999')).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found',
        statusCode: 404,
      });
    });

    it('falls back to defaults on non-JSON error body', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new Error('not json')),
      });
      const client = new TapClient(clientConfig);

      await expect(client.get('/fail')).rejects.toMatchObject({
        code: 'REQUEST_FAILED',
        message: 'Request failed with status 500',
        statusCode: 500,
      });
    });
  });

  describe('signal forwarding', () => {
    it('passes abort signal to fetch', async () => {
      const fetchMock = mockFetch({});
      globalThis.fetch = fetchMock;
      const client = new TapClient(clientConfig);
      const controller = new AbortController();

      await client.get('/test', { signal: controller.signal });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });
});
