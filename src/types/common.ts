export type TapEnvironment = 'development' | 'staging' | 'production';

export const TAP_ENVIRONMENT_URLS: Record<
  TapEnvironment,
  { api: string; app: string }
> = {
  development: {
    api: 'http://localhost:3001',
    app: 'http://localhost:3000',
  },
  staging: {
    api: 'https://api.staging.tap.security',
    app: 'https://staging.tap.security',
  },
  production: {
    api: 'https://api.tap.security',
    app: 'https://app.tap.security',
  },
};

export interface TapError {
  code: string;
  message: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

export class TapSdkError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, unknown>;

  constructor(error: TapError) {
    super(error.message);
    this.name = 'TapSdkError';
    this.code = error.code;
    this.statusCode = error.statusCode;
    this.details = error.details;
  }
}
