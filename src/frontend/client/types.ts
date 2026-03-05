export interface TapClientConfig {
  baseUrl: string;
  token: string;
  installationId: string;
}

export interface TapRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  signal?: AbortSignal;
}

export interface TapResponse<T = unknown> {
  data: T;
  status: number;
}
