import type { TapLambdaResponse } from '../middleware/types';

export class TapApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'TapApiError';
  }

  toResponse(): TapLambdaResponse {
    return {
      statusCode: this.statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: this.code,
        message: this.message,
        ...(this.details && { details: this.details }),
      }),
    };
  }
}

export function notFound(message = 'Not found'): TapApiError {
  return new TapApiError(404, 'NOT_FOUND', message);
}

export function badRequest(message = 'Bad request'): TapApiError {
  return new TapApiError(400, 'BAD_REQUEST', message);
}

export function forbidden(message = 'Forbidden'): TapApiError {
  return new TapApiError(403, 'FORBIDDEN', message);
}

export function internalError(message = 'Internal server error'): TapApiError {
  return new TapApiError(500, 'INTERNAL_ERROR', message);
}
