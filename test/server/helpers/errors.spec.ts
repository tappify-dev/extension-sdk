import { describe, expect, it } from 'vitest';
import {
  TapApiError,
  badRequest,
  forbidden,
  internalError,
  notFound,
} from '../../../src/server/helpers/errors';

describe('TapApiError', () => {
  it('constructs with statusCode, code, message, and details', () => {
    const error = new TapApiError(400, 'BAD_REQUEST', 'Invalid input', {
      field: 'email',
    });
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Invalid input');
    expect(error.details).toEqual({ field: 'email' });
  });

  it('extends Error with name TapApiError', () => {
    const error = new TapApiError(500, 'ERR', 'fail');
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('TapApiError');
  });

  describe('toResponse()', () => {
    it('returns correct Lambda response shape', () => {
      const error = new TapApiError(404, 'NOT_FOUND', 'Not found');
      const response = error.toResponse();

      expect(response.statusCode).toBe(404);
      expect(response.headers).toEqual({ 'Content-Type': 'application/json' });
      expect(JSON.parse(response.body)).toEqual({
        code: 'NOT_FOUND',
        message: 'Not found',
      });
    });

    it('includes details when present', () => {
      const error = new TapApiError(400, 'BAD_REQUEST', 'Bad', {
        field: 'name',
      });
      const body = JSON.parse(error.toResponse().body);
      expect(body.details).toEqual({ field: 'name' });
    });

    it('omits details when not present', () => {
      const error = new TapApiError(400, 'BAD_REQUEST', 'Bad');
      const body = JSON.parse(error.toResponse().body);
      expect(body).not.toHaveProperty('details');
    });
  });
});

describe('error factory functions', () => {
  it('notFound() creates 404 error', () => {
    const error = notFound();
    expect(error.statusCode).toBe(404);
    expect(error.code).toBe('NOT_FOUND');
    expect(error.message).toBe('Not found');
  });

  it('notFound() accepts custom message', () => {
    const error = notFound('User not found');
    expect(error.message).toBe('User not found');
  });

  it('badRequest() creates 400 error', () => {
    const error = badRequest();
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('BAD_REQUEST');
    expect(error.message).toBe('Bad request');
  });

  it('forbidden() creates 403 error', () => {
    const error = forbidden();
    expect(error.statusCode).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Forbidden');
  });

  it('internalError() creates 500 error', () => {
    const error = internalError();
    expect(error.statusCode).toBe(500);
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toBe('Internal server error');
  });
});
