import type { TapLambdaResponse } from '../middleware/types';
import { TapApiError } from './errors';

export function jsonResponse<T>(data: T, statusCode = 200): TapLambdaResponse {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(data),
  };
}

export function errorResponse(error: unknown): TapLambdaResponse {
  if (error instanceof TapApiError) {
    return error.toResponse();
  }

  // eslint-disable-next-line no-console
  console.error('[TapSDK] Unhandled error:', error);

  return {
    statusCode: 500,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    }),
  };
}
