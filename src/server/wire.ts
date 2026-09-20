import type { TapServerErrorCode } from './codes';

export const INTERNAL_MESSAGE =
  'The extension server failed to handle this call. Check your own logs; Tappify records the failure against your extension.';

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export function wireError(
  code: string,
  message: string,
  status: number,
): Response {
  return json({ error: { code, message } }, status);
}

export function failure(
  code: TapServerErrorCode,
  message: string,
  status: number,
): Response {
  return wireError(code, message, status);
}

export function readUnknown(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  return (value as Record<string, unknown>)[key];
}

export function readRecord(
  value: unknown,
  key: string,
): Record<string, unknown> {
  const nested = readUnknown(value, key);
  return typeof nested === 'object' && nested !== null
    ? (nested as Record<string, unknown>)
    : {};
}

export function readText(value: unknown, key: string): string | null {
  const nested = readUnknown(value, key);
  return typeof nested === 'string' ? nested : null;
}
