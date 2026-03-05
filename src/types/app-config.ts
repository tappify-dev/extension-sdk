export interface TapConfigField {
  name: string;
  encrypted: boolean;
  is_required: boolean;
  html_field_type: 'text' | 'file' | 'password' | 'textarea';
  description?: string;
  file_accept?: Record<string, string[]>;
  multiple?: boolean;
}

export interface TapAppConfig {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon?: string;
  type: 'appstore' | 'ads' | 'code_storage';
  documentationUrl?: string;
  auth: {
    method: 'jwt' | 'oauth';
    fields?: TapConfigField[];
    oauthConfig?: {
      authorizationUrl: string;
      tokenUrl: string;
      scopes: string[];
    };
  };
  baseUrl: string;
}

export function defineAppConfig(config: TapAppConfig): TapAppConfig {
  return config;
}
