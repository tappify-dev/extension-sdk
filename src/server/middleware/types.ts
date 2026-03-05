export interface TapAuthenticatedRequest {
  headers: Record<string, string | string[] | undefined>;
  tapUser?: {
    sub: string;
    orgId: string;
    role?: string;
    installationId?: string;
  };
}

export interface TapLambdaEvent {
  headers: Record<string, string | undefined>;
  body?: string | null;
  pathParameters?: Record<string, string | undefined> | null;
  queryStringParameters?: Record<string, string | undefined> | null;
  httpMethod: string;
  path: string;
}

export interface TapLambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body: string;
}

export type TapLambdaHandler = (
  event: TapLambdaEvent,
) => Promise<TapLambdaResponse>;
