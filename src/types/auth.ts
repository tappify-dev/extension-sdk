export interface TapUser {
  id: string;
  organizationId: string;
  role?: 'admin' | 'member';
}

export interface TapOrganization {
  id: string;
  name?: string;
}

export interface TapAuthContext {
  user: TapUser;
  organization: TapOrganization;
  token: string;
  installationId: string;
}
