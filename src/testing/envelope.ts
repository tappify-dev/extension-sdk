import { TapServerError } from '../client/errors';
import type { TapFilters } from '../client/types';
import { SERVER_ERROR_CODES } from '../server/codes';
import type { TappifyCallContext, TappifyInstall } from '../server/types';
import { readRecord, readText } from '../server/wire';

export const DEFAULT_FILTERS: TapFilters = {
  range: { from: '2026-09-01', to: '2026-09-08', preset: '7d' },
  platform: 'all',
  country: 'all',
};

export interface CallEnvelope {
  install: TappifyInstall;
  filters: TapFilters;
  input: unknown;
  credentials?: Record<string, unknown>;
  documents?: Record<string, unknown>;
  event?: unknown;
}

export function callEnvelope(envelope: CallEnvelope): string {
  const context: TappifyCallContext = {
    projectId: envelope.install.projectId,
    platform: envelope.filters.platform,
    from: envelope.filters.range.from,
    to: envelope.filters.range.to,
    filters: envelope.filters,
  };

  return JSON.stringify({
    install: envelope.install,
    context,
    input: envelope.input,
    credentials: envelope.credentials ?? {},
    documents: envelope.documents ?? {},
    event: envelope.event,
  });
}

function parseJson(text: string): { parsed: boolean; value: unknown } {
  try {
    return { parsed: true, value: JSON.parse(text) as unknown };
  } catch {
    return { parsed: false, value: undefined };
  }
}

export async function readEnvelopeResponse(
  response: Response,
  call: string,
): Promise<unknown> {
  const text = await response.text();
  const body = parseJson(text);
  const status = String(response.status);

  if (response.ok) {
    if (body.parsed) return body.value;
    if (text.trim() === '') return undefined;

    throw new TapServerError(
      SERVER_ERROR_CODES.INTERNAL_ERROR,
      `The extension server answered ${status} for ${call} with a body that is not JSON. Every Tappify route answers JSON, or 204 with no body.`,
      response.status,
    );
  }

  const error = readRecord(body.value, 'error');

  throw new TapServerError(
    readText(error, 'code') ?? SERVER_ERROR_CODES.INTERNAL_ERROR,
    readText(error, 'message') ??
      `The extension server answered ${status} for ${call} without a JSON error body.`,
    response.status,
  );
}
