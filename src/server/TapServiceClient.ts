import { TapApiError } from './helpers/errors';

export interface TapServiceClientConfig {
  apiBaseUrl: string;
  serviceToken: string;
}

export interface TapInstallation {
  id: string;
  integrationId: string;
  organizationId: string;
  metadata: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export class TapServiceClient {
  private baseUrl: string;
  private token: string;

  constructor(config: TapServiceClientConfig) {
    this.baseUrl = config.apiBaseUrl.replace(/\/$/, '');
    this.token = config.serviceToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.token}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new TapApiError(
        response.status,
        (error as Record<string, string>).code ?? 'REQUEST_FAILED',
        (error as Record<string, string>).message ??
          `Request failed: ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async getInstallation(installationId: string): Promise<TapInstallation> {
    return this.request<TapInstallation>(
      'GET',
      `/marketplace/installations/${installationId}`,
    );
  }

  async getInstallationSecret(
    installationId: string,
    fieldName: string,
  ): Promise<{ value: string }> {
    return this.request<{ value: string }>(
      'GET',
      `/marketplace/installations/${installationId}/secrets/${fieldName}`,
    );
  }
}
