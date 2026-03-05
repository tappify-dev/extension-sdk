import type {
  TapLambdaEvent,
  TapLambdaHandler,
  TapLambdaResponse,
} from './types';

interface JwksKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg?: string;
  use?: string;
}

interface WithTapAuthOptions {
  workosClientId: string;
  workosBaseUrl?: string;
  jwksCacheTtlMs?: number;
}

let cachedJwks: { keys: JwksKey[]; fetchedAt: number } | null = null;

async function fetchJwks(
  baseUrl: string,
  clientId: string,
): Promise<JwksKey[]> {
  const now = Date.now();
  if (cachedJwks && now - cachedJwks.fetchedAt < 300_000) {
    return cachedJwks.keys;
  }

  const response = await fetch(`${baseUrl}/sso/jwks/${clientId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch JWKS: ${response.status}`);
  }

  const data = (await response.json()) as { keys: JwksKey[] };
  cachedJwks = { keys: data.keys, fetchedAt: now };
  return data.keys;
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function importJwk(jwk: JwksKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: jwk.alg ?? 'RS256' },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

async function verifyToken(
  token: string,
  options: WithTapAuthOptions,
): Promise<Record<string, unknown>> {
  const baseUrl = options.workosBaseUrl ?? 'https://api.workos.com';
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [headerB64, payloadB64, signatureB64] = parts as [
    string,
    string,
    string,
  ];
  const header = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(headerB64)),
  ) as { kid?: string };

  const keys = await fetchJwks(baseUrl, options.workosClientId);
  const jwk = header.kid ? keys.find(k => k.kid === header.kid) : keys[0];

  if (!jwk) throw new Error('No matching JWK found');

  const key = await importJwk(jwk);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signature.buffer as ArrayBuffer,
    data,
  );

  if (!valid) throw new Error('Invalid token signature');

  const payload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  ) as Record<string, unknown>;

  const expectedIssuer = `${baseUrl}/user_management/${options.workosClientId}`;
  if (payload.iss !== expectedIssuer) {
    throw new Error('Invalid token issuer');
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    throw new Error('Token expired');
  }

  return payload;
}

export function withTapAuth(
  handler: (
    event: TapLambdaEvent & {
      tapUser: {
        sub: string;
        orgId: string;
        role?: string;
        installationId?: string;
      };
    },
  ) => Promise<TapLambdaResponse>,
  options: WithTapAuthOptions,
): TapLambdaHandler {
  return async (event: TapLambdaEvent): Promise<TapLambdaResponse> => {
    const authHeader =
      event.headers['authorization'] ?? event.headers['Authorization'];

    if (!authHeader?.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        }),
      };
    }

    const token = authHeader.slice(7);

    try {
      const payload = await verifyToken(token, options);

      const installationId =
        event.headers['x-tap-installation-id'] ??
        event.headers['X-Tap-Installation-Id'];

      const authenticatedEvent = Object.assign(event, {
        tapUser: {
          sub: payload.sub as string,
          orgId: payload.org_id as string,
          role: payload.role as string | undefined,
          installationId,
        },
      });

      return handler(authenticatedEvent);
    } catch (error) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 'UNAUTHORIZED',
          message:
            error instanceof Error ? error.message : 'Authentication failed',
        }),
      };
    }
  };
}
