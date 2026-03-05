import { TapSdkError } from '../../types/common';
import type { TapClientConfig, TapRequestOptions, TapResponse } from './types';

export class TapClient {
  private baseUrl: string;
  private token: string;
  private installationId: string;

  constructor(config: TapClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.token = config.token;
    this.installationId = config.installationId;
  }

  updateToken(token: string) {
    this.token = token;
  }

  private buildHeaders(options?: TapRequestOptions): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.token}`,
      'X-Tap-Installation-Id': this.installationId,
      ...options?.headers,
    });
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
    }
    return url.toString();
  }

  private async request<T>(
    method: string,
    path: string,
    options?: TapRequestOptions & { body?: unknown },
  ): Promise<TapResponse<T>> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options);

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: options?.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new TapSdkError({
        code: error.code ?? 'REQUEST_FAILED',
        message:
          error.message ?? `Request failed with status ${response.status}`,
        statusCode: response.status,
        details: error,
      });
    }

    const data = (await response.json()) as T;
    return { data, status: response.status };
  }

  async get<T>(
    path: string,
    options?: TapRequestOptions,
  ): Promise<TapResponse<T>> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(
    path: string,
    body?: unknown,
    options?: TapRequestOptions,
  ): Promise<TapResponse<T>> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T>(
    path: string,
    body?: unknown,
    options?: TapRequestOptions,
  ): Promise<TapResponse<T>> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async patch<T>(
    path: string,
    body?: unknown,
    options?: TapRequestOptions,
  ): Promise<TapResponse<T>> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  async delete<T>(
    path: string,
    options?: TapRequestOptions,
  ): Promise<TapResponse<T>> {
    return this.request<T>('DELETE', path, options);
  }
}
