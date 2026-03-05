import { afterEach, describe, expect, it, vi } from 'vitest';
import { TapApiError } from '../../../src/server/helpers/errors';
import {
  errorResponse,
  jsonResponse,
} from '../../../src/server/helpers/response';

describe('jsonResponse', () => {
  it('returns statusCode 200 by default', () => {
    const response = jsonResponse({ ok: true });
    expect(response.statusCode).toBe(200);
  });

  it('serializes data as JSON body', () => {
    const response = jsonResponse({ id: 1, name: 'test' });
    expect(JSON.parse(response.body)).toEqual({ id: 1, name: 'test' });
  });

  it('includes Content-Type and CORS headers', () => {
    const response = jsonResponse({});
    expect(response.headers).toEqual({
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
  });

  it('accepts a custom status code', () => {
    const response = jsonResponse({ created: true }, 201);
    expect(response.statusCode).toBe(201);
  });
});

describe('errorResponse', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('delegates to toResponse() for TapApiError', () => {
    const error = new TapApiError(404, 'NOT_FOUND', 'Not found');
    const response = errorResponse(error);

    expect(response.statusCode).toBe(404);
    expect(JSON.parse(response.body)).toEqual({
      code: 'NOT_FOUND',
      message: 'Not found',
    });
  });

  it('returns 500 with generic message for unknown errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = errorResponse(new Error('something broke'));

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body)).toEqual({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    });
  });

  it('handles non-Error values', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = errorResponse('string error');

    expect(response.statusCode).toBe(500);
    expect(JSON.parse(response.body).code).toBe('INTERNAL_ERROR');
  });
});
