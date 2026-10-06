import {
  createLocalJWKSet,
  createRemoteJWKSet,
  jwtVerify,
  type JWTPayload,
  type JWTVerifyGetKey,
} from 'jose';
import { TapError } from '../client/errors';
import type { TappifyClaims, VerifyTokenOptions } from './types';

/**
 * The key set `verifyTappifyToken` fetches when no `jwksUrl` or `jwks` is given.
 *
 * @remarks
 * This is production. Point `jwksUrl` at the environment that is calling you when
 * you run against another one, and pass `jwks` in tests.
 */
export const DEFAULT_JWKS_URL =
  'https://api.tappify.ai/api/v1/extensions/.well-known/jwks.json';

const CLOCK_TOLERANCE_SECONDS = 60;

const remoteSets = new Map<string, JWTVerifyGetKey>();

function keySet(options: VerifyTokenOptions): JWTVerifyGetKey {
  if (options.jwks) return createLocalJWKSet(options.jwks);

  const url = options.jwksUrl ?? DEFAULT_JWKS_URL;
  const cached = remoteSets.get(url);
  if (cached) return cached;

  const created = createRemoteJWKSet(new URL(url));
  remoteSets.set(url, created);
  return created;
}

function readString(payload: JWTPayload, key: string): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

function toClaims(payload: JWTPayload, audience: string): TappifyClaims {
  const aud = payload.aud;
  const matches =
    aud === audience || (Array.isArray(aud) && aud.includes(audience));

  if (!matches) {
    throw new TapError(
      'TAP_TOKEN_AUDIENCE',
      `This install token was issued for a different extension. Create the handler with the same extensionId as the "id" in tappify.extension.json, so its audience is "${audience}".`,
    );
  }

  const installId = readString(payload, 'installId');
  const extensionId = readString(payload, 'extensionId');
  const organizationId = readString(payload, 'organizationId');

  if (
    installId === undefined ||
    extensionId === undefined ||
    organizationId === undefined
  ) {
    throw new TapError(
      'TAP_TOKEN_INVALID',
      `The install token is missing the installId, extensionId or organizationId claim. Verify against ${DEFAULT_JWKS_URL} and do not reuse tokens across environments.`,
    );
  }

  const scopes = payload.scopes;
  const userId = readString(payload, 'userId');

  const claims: TappifyClaims = {
    iss: readString(payload, 'iss') ?? '',
    aud: audience,
    exp: typeof payload.exp === 'number' ? payload.exp : 0,
    iat: typeof payload.iat === 'number' ? payload.iat : 0,
    installId,
    extensionId,
    projectId: readString(payload, 'projectId') ?? null,
    organizationId,
    scopes: Array.isArray(scopes)
      ? scopes.filter((scope): scope is string => typeof scope === 'string')
      : [],
  };

  if (userId !== undefined) claims.userId = userId;
  return claims;
}

/**
 * Verifies an install token against Tappify's signing keys and returns its
 * claims.
 *
 * @remarks
 * Checks the RS256 signature, the expiry with 60 seconds of clock tolerance, and
 * that the audience is `ext:<extensionId>`. Rejects with a `TapError` carrying
 * `TAP_TOKEN_INVALID` when the signature, the expiry or a required claim is wrong,
 * and `TAP_TOKEN_AUDIENCE` when the token was issued for another extension. A
 * remote key set is fetched once per url and cached for the process, so calling
 * this per request costs nothing after the first. `createTappifyHandler` already
 * verifies every route but health, so call this only outside the handler, or
 * where you accept a Tappify token on a route of your own.
 *
 * @example
 * ```ts
 * import { verifyTappifyToken } from '@tappify/extension-sdk/server';
 *
 * async function whoCalled(request: Request): Promise<string> {
 *   const token = (request.headers.get('authorization') ?? '').replace('Bearer ', '');
 *   const claims = await verifyTappifyToken(token, { extensionId: 'starter' });
 *   return claims.installId;
 * }
 * ```
 */
export async function verifyTappifyToken(
  token: string,
  options: VerifyTokenOptions,
): Promise<TappifyClaims> {
  const audience = `ext:${options.extensionId}`;

  let payload: JWTPayload;
  try {
    const verified = await jwtVerify(token, keySet(options), {
      algorithms: ['RS256'],
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
    payload = verified.payload;
  } catch {
    throw new TapError(
      'TAP_TOKEN_INVALID',
      'The install token did not verify. Check that your server reads the Authorization header unchanged, that its clock is correct, and that jwksUrl points at the Tappify environment that called you.',
    );
  }

  return toClaims(payload, audience);
}
